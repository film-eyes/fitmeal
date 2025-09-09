import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { PlusCircle, Edit, Trash2, BookOpen, Utensils, Calendar, XCircle, ShoppingCart, Users, Download, FileText, Copy, AlertTriangle, LogIn, LogOut } from 'lucide-react';

// --- НАСТРОЙКИ FIREBASE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// --- Инициализация Firebase ---
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (error) {
    console.error("Firebase initialization error:", error);
}

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const isFirebaseInitialized = !!app;

// --- Хелперы и утилиты ---
const calculateIngredientNutrition = (item, ingredient, portionMultiplier = 1) => {
    if (!item || !ingredient) return { kcal: 0, protein: 0, fat: 0, carbs: 0, price: 0, weight: 0 };
    const quantity = item.quantity * portionMultiplier;
    let weightInGrams = 0;
    if (item.unit === 'grams') { weightInGrams = quantity; } else { weightInGrams = quantity * (ingredient.gramsPerPiece || 0); }
    let price = 0;
    if (ingredient.unit === 'grams') { price = (ingredient.price / 1000) * weightInGrams; } else { if (ingredient.gramsPerPiece > 0) { const piecesUsed = weightInGrams / ingredient.gramsPerPiece; price = ingredient.price * piecesUsed; } }
    const nutritionMultiplier = weightInGrams / 100;
    return { kcal: (ingredient.kcal || 0) * nutritionMultiplier, protein: (ingredient.protein || 0) * nutritionMultiplier, fat: (ingredient.fat || 0) * nutritionMultiplier, carbs: (ingredient.carbs || 0) * nutritionMultiplier, price: price || 0, weight: weightInGrams };
};
const calculateTotalsForDish = (dish, ingredients, portionMultiplier = 1) => {
    if (!dish || !dish.ingredients) return { kcal: 0, protein: 0, fat: 0, carbs: 0, price: 0, totalWeight: 0 };
    return dish.ingredients.reduce((totals, item) => {
        const ing = ingredients.find(i => i.id === item.ingredientId);
        const nutrition = calculateIngredientNutrition(item, ing, portionMultiplier);
        totals.kcal += nutrition.kcal; totals.protein += nutrition.protein; totals.fat += nutrition.fat; totals.carbs += nutrition.carbs; totals.price += nutrition.price; totals.totalWeight += nutrition.weight;
        return totals;
    }, { kcal: 0, protein: 0, fat: 0, carbs: 0, price: 0, totalWeight: 0 });
};
const calculateBMR = (profile) => {
    const w = parseFloat(profile.weight), h = parseFloat(profile.height), a = parseFloat(profile.age);
    if (!w || !h || !a) return 0;
    return profile.gender === 'male' ? (10 * w + 6.25 * h - 5 * a + 5) : (10 * w + 6.25 * h - 5 * a - 161);
};
const getTargetNutrition = (profile) => {
    if (!profile) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    const bmr = calculateBMR(profile);
    const tdee = bmr * (profile.activity || 1.375);
    const mode = profile.nutritionMode || 'maintenance';
    let kcal = tdee; let proteinFactor = 2, fatFactor = 0.8;
    if (mode === 'cutting') { kcal *= 0.8; proteinFactor = 2; fatFactor = 0.8; }
    if (mode === 'bulking') { kcal *= 1.2; proteinFactor = 2.5; fatFactor = 0.7; }
    const protein = profile.weight * proteinFactor; const fat = profile.weight * fatFactor; const carbs = (kcal - (protein * 4) - (fat * 9)) / 4;
    return { kcal, protein, fat, carbs };
};
const getNutrientClass = (type, value, target, profile) => {
    if (!profile || target === 0) return 'text-white';
    const deviation = (value - target) / target; const weight = profile.weight; const mode = profile.nutritionMode;
    switch (mode) {
        case 'cutting':
            if (type === 'kcal') return deviation >= -0.15 && deviation <= 0.05 ? 'text-green-300' : 'text-red-400';
            if (type === 'protein') return deviation >= -0.05 && deviation <= 0.40 ? 'text-green-300' : 'text-red-400';
            if (type === 'fat') return deviation >= -0.10 && deviation <= 0.10 ? 'text-green-300' : 'text-red-400';
            if (type === 'carbs') return value >= 75 && deviation <= 0.10 ? 'text-green-300' : 'text-red-400';
            break;
        case 'bulking':
            if (type === 'kcal') return deviation >= -0.05 && deviation <= 0.15 ? 'text-green-300' : 'text-red-400';
            if (type === 'protein') return value >= 2.2 * weight && deviation <= 0.40 ? 'text-green-300' : 'text-red-400';
            if (type === 'fat') return deviation >= -0.10 && deviation <= 0.10 ? 'text-green-300' : 'text-red-400';
            if (type === 'carbs') return deviation >= -0.15 && deviation <= 0.15 ? 'text-green-300' : 'text-red-400';
            break;
        case 'maintenance': default:
            if (type === 'kcal') return deviation >= -0.20 && deviation <= 0.10 ? 'text-green-300' : 'text-red-400';
            if (type === 'protein') return value >= 1.8 * weight ? 'text-green-300' : 'text-red-400';
            if (type === 'fat') return deviation >= -0.10 && deviation <= 0.10 ? 'text-green-300' : 'text-red-400';
            if (type === 'carbs') return deviation >= -0.10 && deviation <= 0.10 ? 'text-green-300' : 'text-red-400';
            break;
    }
    return 'text-white';
};

// --- Основной компонент приложения ---
export default function App() {
    if (firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.apiKey) {
        return <FirebaseConfigErrorScreen />;
    }

    const [view, setView] = useState('menu');
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [ingredients, setIngredients] = useState([]);
    const [dishes, setDishes] = useState([]);
    const [weeklyMenu, setWeeklyMenu] = useState({});
    const [settings, setSettings] = useState(null);
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        const loadScript = (src, id) => { if (!document.getElementById(id)) { const s = document.createElement('script'); s.src = src; s.id = id; s.async = true; document.body.appendChild(s); }};
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf-script');
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', 'jspdf-autotable-script');
    }, []);
    
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    useEffect(() => {
    if (!isFirebaseInitialized) return;

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user); // Просто сохраняем пользователя (или null, если он вышел)
            setIsAuthReady(true);
        });
        return () => unsubscribe();
      })
      .catch((error) => {
        console.error("Error setting persistence:", error);
        setIsAuthReady(true);
      });
}, []);

    useEffect(() => {
    if (!isAuthReady || !user) {
        // Очищаем данные, если пользователь вышел
        setIngredients([]);
        setDishes([]);
        setWeeklyMenu({});
        setSettings(null);
        return;
    }

   const userId = user ? user.uid : null;
    // Используем имя из Google-аккаунта по умолчанию
    const defaultSettings = { profiles: [{ id: 1, name: user.displayName || 'Пользователь 1', weight: 70, height: 180, age: 30, gender: 'male', activity: 1.375, nutritionMode: 'maintenance' }], activeProfileIds: [1] };

    // ... (все пути остаются такими же, но теперь они работают для Google-пользователя)
    const settingsDocRef = doc(db, `users/${userId}/data/settings`);
    const unsubSettings = onSnapshot(settingsDocRef, (doc) => setSettings(doc.exists() ? { ...defaultSettings, ...doc.data() } : defaultSettings));

    const ingredientsQuery = collection(db, `users/${userId}/ingredients`);
    const unsubIngredients = onSnapshot(ingredientsQuery, snapshot => setIngredients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    const dishesQuery = collection(db, `users/${userId}/dishes`);
    const unsubDishes = onSnapshot(dishesQuery, snapshot => setDishes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    const menuDocRef = doc(db, `users/${userId}/data/weeklyMenu`);
    const unsubMenu = onSnapshot(menuDocRef, (doc) => setWeeklyMenu(doc.exists() ? doc.data() : {}));

    return () => { unsubSettings(); unsubIngredients(); unsubDishes(); unsubMenu(); };
}, [isAuthReady, user]); // Зависимость теперь от user

    const handleUpdateSettings = async (newSettings) => {
        if (!user) return;
        const settingsDocRef = doc(db, `users/${user.uid}/data/settings`);
        await setDoc(settingsDocRef, newSettings);
        setToastMessage('Настройки успешно сохранены!');
    };
    
    const handleUpdateMenu = async (newMenu) => {
        if (!user) return;
        await setDoc(doc(db, `users/${user.uid}/data/weeklyMenu`), newMenu, { merge: true });
    }

    const crudHandlers = useMemo(() => {
    // Эта проверка не дает коду сломаться, когда пользователь не вошел в систему.
    if (!user) return {};

    const userId = user.uid; // Здесь мы уже точно знаем, что user существует

    return {
        ingredients: {
            add: async (ing) => await addDoc(collection(db, `users/${userId}/ingredients`), ing),
            update: async (id, ing) => await updateDoc(doc(db, `users/${userId}/ingredients/${id}`), ing),
            delete: async (id) => await deleteDoc(doc(db, `users/${userId}/ingredients/${id}`)),
        },
        dishes: {
            add: async (d) => await addDoc(collection(db, `users/${userId}/dishes`), d),
            update: async (id, d) => await updateDoc(doc(db, `users/${userId}/dishes/${id}`), d),
            delete: async (id) => await deleteDoc(doc(db, `users/${userId}/dishes/${id}`)),
        }
    }
}, [user]); // ГЛАВНОЕ ИЗМЕНЕНИЕ: зависимость от всего объекта user, а не от user.uid

        // Handlers
    const handleGoogleSignIn = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Google Sign-In Error:", error);
    }
    };
    const handleSignOut = async () => {
    await signOut(auth);
    };

    
    if (!isAuthReady || !settings) return <div className="h-screen w-full flex items-center justify-center text-white bg-gradient-to-tr from-pink-500 to-blue-500">Загрузка...</div>;

    const renderView = () => {
    if (!user) return <SignInPrompt onSignIn={handleGoogleSignIn} />;
    if (!settings) return <div className="h-screen w-full flex items-center justify-center text-white">Загрузка данных пользователя...</div>;

    switch (view) {
        // ... остальная часть без изменений
    }
    } ;

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-[#FF00D9] to-[#0099FF] font-sans text-white p-4 sm:p-8">
            <div className="max-w-screen-2xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
    <div>
        <h1 className="text-4xl sm:text-5xl font-bold text-shadow">FitMeal</h1>
        <p className="text-lg text-white/80 text-shadow">Спортивный рацион без заеба</p>
    </div>
    {user && (
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="font-semibold">{user.displayName}</p>
                <p className="text-xs opacity-80">{user.email}</p>
            </div>
            <img src={user.photoURL} alt="User Avatar" className="w-12 h-12 rounded-full border-2 border-white/50" />
            <Button onClick={handleSignOut} className="bg-pink-500/80 hover:bg-pink-600/80"><LogOut size={20} /></Button>
        </div>
    )}
                </header>
                {user && (
                <nav className="flex justify-center flex-wrap items-center gap-2 sm:gap-4 mb-8 p-2 bg-white/20 backdrop-blur-sm rounded-full">
                    <NavButton icon={<Utensils size={20} />} text="Ингредиенты" isActive={view === 'ingredients'} onClick={() => setView('ingredients')} />
                    <NavButton icon={<BookOpen size={20} />} text="Блюда" isActive={view === 'dishes'} onClick={() => setView('dishes')} />
                    <NavButton icon={<Calendar size={20} />} text="Меню" isActive={view === 'menu'} onClick={() => setView('menu')} />
                    <NavButton icon={<Users size={20} />} text="Настройки" isActive={view === 'calculator'} onClick={() => setView('calculator')} />
                </nav>
                )}
                <main>{renderView()}</main>
                <Toast message={toastMessage} />
                <footer className="text-center mt-12 text-white/60 text-sm"><p>(Дизайн и разработка: Nikita Vedenyapin x Gemini)</p>{user && <p className="text-xs mt-1 opacity-50">User ID: {user.uid}</p>}</footer>
            </div>
        </div>

    );
}

const SignInPrompt = ({ onSignIn }) => (
    <div className="text-center py-20">
        <Card className="max-w-md mx-auto">
            <h2 className="text-3xl font-bold">Добро пожаловать!</h2>
            <p className="mt-2 text-white/80">Войдите, чтобы получить доступ к своему меню с любого устройства.</p>
            <Button onClick={onSignIn} className="mt-6 text-lg bg-blue-500/80 hover:bg-blue-600/80 w-full">
                <LogIn size={24} /> Войти через Google
            </Button>
        </Card>
    </div>
);

// --- UI Компоненты ---
const FirebaseConfigErrorScreen = () => (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FF00D9] to-[#0099FF] font-sans text-white p-4 sm:p-8 flex items-center justify-center">
        <div className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-center max-w-2xl shadow-2xl border border-white/30">
            <div className="flex justify-center items-center gap-4 mb-4">
                <AlertTriangle size={48} className="text-yellow-300" />
                <h1 className="text-3xl font-bold">Ошибка конфигурации Firebase</h1>
            </div>
            <p className="text-lg mb-6">Похоже, вы не добавили свои ключи для подключения к Firebase. Приложение не может работать без них.</p>
            <div className="text-left bg-black/20 p-4 rounded-lg">
                <p className="font-bold mb-2">Что нужно сделать:</p>
                <ol className="list-decimal list-inside mt-2 space-y-2">
                    <li>Откройте файл проекта: <code>src/App.jsx</code>.</li>
                    <li>Найдите объект <code>firebaseConfig</code> в самом верху файла.</li>
                    <li>Замените значения-заглушки (например, "YOUR_API_KEY") на ваши реальные ключи из <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-yellow-300 transition-colors">консоли Firebase</a>.</li>
                    <li>Сохраните файл, и эта страница автоматически перезагрузится.</li>
                </ol>
            </div>
        </div>
    </div>
);
const NavButton = ({ icon, text, isActive, onClick }) => (<button onClick={onClick} className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${isActive ? 'bg-white text-blue-600 shadow-lg' : 'bg-transparent text-white hover:bg-white/20'}`}>{icon}<span className="hidden sm:inline">{text}</span></button>);
const Card = ({ children, className = '' }) => (<div className={`bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-4 sm:p-6 border border-white/20 ${className}`}>{children}</div>);
const Input = (props) => (<input {...props} className={`w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition ${props.className}`} />);
const Select = (props) => (<select {...props} className={`w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition ${props.className}`}>{props.children}</select>);
const Button = ({ children, onClick, className = '', type = 'button' }) => (<button type={type} onClick={onClick} className={`px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-lg font-semibold transition-all duration-200 shadow-md flex items-center justify-center gap-2 ${className}`}>{children}</button>);
const Modal = ({ children, onClose, maxWidth = 'max-w-lg' }) => (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"><div className={`relative w-full ${maxWidth}`}><Card className="w-full">{children}</Card><button onClick={onClose} className="absolute -top-2 -right-2 text-white bg-pink-500 rounded-full p-1 hover:bg-pink-600 transition"><XCircle size={28} /></button></div></div>);
const Toast = ({ message }) => (<div className={`fixed bottom-5 right-5 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-300 ${message ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>{message}</div>);

// --- Компоненты разделов ---
function IngredientsManager({ ingredients, onAdd, onUpdate, onDelete }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIngredient, setEditingIngredient] = useState(null);
    const openAddModal = () => { setEditingIngredient(null); setIsModalOpen(true); };
    const openEditModal = (ing) => { setEditingIngredient(ing); setIsModalOpen(true); };
    const handleSave = (ing) => {
        if (editingIngredient) { onUpdate(editingIngredient.id, ing); } else { onAdd(ing); }
        setIsModalOpen(false);
    };
    const handleDelete = (id) => { if (window.confirm('Вы уверены?')) onDelete(id); };

    return (
        <div>
            <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-bold">Ингредиенты</h2><Button onClick={openAddModal}><PlusCircle size={20} /> Добавить</Button></div>
            {isModalOpen && <IngredientForm ingredient={editingIngredient} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ingredients.length > 0 ? ingredients.map(ing => (
                    <Card key={ing.id}>
                        <h3 className="text-xl font-bold mb-2">{ing.name}</h3>
                        <div className="text-sm space-y-1 text-white/90">
                            <p>КБЖУ на 100г: {ing.kcal} / {ing.protein} / {ing.fat} / {ing.carbs}</p>
                            <p>Цена: {ing.price} руб. за {ing.unit === 'grams' ? '1000г' : '1 шт'}</p>
                            {ing.unit === 'pieces' && <p>Вес 1 шт: {ing.gramsPerPiece} г</p>}
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button onClick={() => openEditModal(ing)} className="w-full"><Edit size={16} /> Редакт.</Button>
                            <Button onClick={() => handleDelete(ing.id)} className="w-full bg-pink-500/50 hover:bg-pink-600/50"><Trash2 size={16} /> Удалить</Button>
                        </div>
                    </Card>
                )) : <p className="col-span-full text-center text-white/80">Список ингредиентов пуст.</p>}
            </div>
        </div>
    );
}
function IngredientForm({ ingredient, onSave, onClose }) {
    const [formState, setFormState] = useState({ name: ingredient?.name || '', unit: ingredient?.unit || 'grams', price: ingredient?.price || '', gramsPerPiece: ingredient?.gramsPerPiece || '', kcal: ingredient?.kcal || '', protein: ingredient?.protein || '', fat: ingredient?.fat || '', carbs: ingredient?.carbs || '' });
    const handleChange = (e) => setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSave = { name: formState.name, unit: formState.unit, price: parseFloat(formState.price) || 0, kcal: parseFloat(formState.kcal) || 0, protein: parseFloat(formState.protein) || 0, fat: parseFloat(formState.fat) || 0, carbs: parseFloat(formState.carbs) || 0 };
        if (formState.unit === 'pieces') dataToSave.gramsPerPiece = parseFloat(formState.gramsPerPiece) || 0;
        onSave(dataToSave);
    };
    return (<Modal onClose={onClose}><form onSubmit={handleSubmit} className="space-y-4"><h3 className="text-2xl font-bold">{ingredient ? 'Редактировать' : 'Добавить'} ингредиент</h3><Input name="name" value={formState.name} onChange={handleChange} placeholder="Название" required /><div className="grid grid-cols-2 gap-4"><Input name="kcal" type="number" step="0.1" value={formState.kcal} onChange={handleChange} placeholder="Калории (на 100г)" required /><Input name="protein" type="number" step="0.1" value={formState.protein} onChange={handleChange} placeholder="Белки (на 100г)" required /><Input name="fat" type="number" step="0.1" value={formState.fat} onChange={handleChange} placeholder="Жиры (на 100г)" required /><Input name="carbs" type="number" step="0.1" value={formState.carbs} onChange={handleChange} placeholder="Углеводы (на 100г)" required /></div><div className="flex gap-4 items-center"><label>Единицы:</label><label className="flex items-center gap-2"><input type="radio" name="unit" value="grams" checked={formState.unit === 'grams'} onChange={handleChange} /> Граммы</label><label className="flex items-center gap-2"><input type="radio" name="unit" value="pieces" checked={formState.unit === 'pieces'} onChange={handleChange} /> Штуки</label></div>{formState.unit === 'pieces' && <Input name="gramsPerPiece" type="number" step="0.1" value={formState.gramsPerPiece} onChange={handleChange} placeholder="Вес одной штуки в граммах" required />}<Input name="price" type="number" step="0.01" value={formState.price} onChange={handleChange} placeholder={`Цена (руб. за ${formState.unit === 'grams' ? '1000г' : '1 шт'})`} required /><div className="flex justify-end gap-4"><Button onClick={onClose} type="button" className="bg-transparent border-none">Отмена</Button><Button type="submit" className="bg-blue-500/80 hover:bg-blue-600/80">Сохранить</Button></div></form></Modal>);
}

function DishesManager({ dishes, ingredients, onAdd, onUpdate, onDelete }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDish, setEditingDish] = useState(null);
    const openAddModal = () => { setEditingDish(null); setIsModalOpen(true); };
    const openEditModal = (dish) => { setEditingDish(dish); setIsModalOpen(true); };
    const handleSave = (dish) => {
        if (editingDish) { onUpdate(editingDish.id, dish); } else { onAdd(dish); }
        setIsModalOpen(false);
    };
    const handleDelete = (id) => { if (window.confirm('Вы уверены?')) onDelete(id); };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-bold">Блюда</h2><Button onClick={openAddModal}><PlusCircle size={20} /> Добавить</Button></div>
            {isModalOpen && <DishForm dish={editingDish} ingredients={ingredients} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dishes.length > 0 ? dishes.map(dish => {
                    const totals = calculateTotalsForDish(dish, ingredients);
                    const per100g = {
                        kcal: totals.totalWeight ? (totals.kcal / totals.totalWeight) * 100 : 0,
                        protein: totals.totalWeight ? (totals.protein / totals.totalWeight) * 100 : 0,
                        fat: totals.totalWeight ? (totals.fat / totals.totalWeight) * 100 : 0,
                        carbs: totals.totalWeight ? (totals.carbs / totals.totalWeight) * 100 : 0,
                        price: totals.totalWeight ? (totals.price / totals.totalWeight) * 100 : 0,
                    };
                    return (
                        <Card key={dish.id}>
                            <h3 className="text-xl font-bold mb-2">{dish.name}</h3>
                            <p className="text-sm text-white/80 mb-2">Время готовки: {dish.cookingTime}</p>
                            <div className="grid grid-cols-2 gap-2 text-sm space-y-1 bg-white/10 p-2 rounded-md mb-2">
                                <div>
                                    <p className="font-semibold">На порцию ({totals.totalWeight.toFixed(0)}г):</p>
                                    <p>К: {totals.kcal.toFixed(0)}, Б: {totals.protein.toFixed(1)}, Ж: {totals.fat.toFixed(1)}, У: {totals.carbs.toFixed(1)}</p>
                                    <p>Цена: {totals.price.toFixed(2)} ₽</p>
                                </div>
                                <div>
                                    <p className="font-semibold">На 100г:</p>
                                    <p>К: {per100g.kcal.toFixed(0)}, Б: {per100g.protein.toFixed(1)}, Ж: {per100g.fat.toFixed(1)}, У: {per100g.carbs.toFixed(1)}</p>
                                    <p>Цена: {per100g.price.toFixed(2)} ₽</p>
                                </div>
                            </div>
                            <details className="text-sm cursor-pointer"><summary className="font-semibold flex items-center gap-1">Ингредиенты <ChevronDown size={16}/></summary>
                                <ul className="mt-1 pl-2 text-white/90 space-y-2">
                                    {(dish.ingredients || []).map((item, index) => {
                                        const ing = ingredients.find(i => i.id === item.ingredientId);
                                        const ingTotals = calculateIngredientNutrition(item, ing);
                                        return <li key={index} className="text-xs p-1 bg-black/20 rounded">
                                            <p className="font-bold">{ing?.name || '?'}: {item.quantity} {item.unit === 'grams' ? 'г' : 'шт'}</p>
                                            <p>КБЖУ: {ingTotals.kcal.toFixed(0)}/{ingTotals.protein.toFixed(1)}/{ingTotals.fat.toFixed(1)}/{ingTotals.carbs.toFixed(1)}</p>
                                        </li>;
                                    })}
                                </ul>
                            </details>
                            <details className="text-sm cursor-pointer mt-2"><summary className="font-semibold flex items-center gap-1">Рецепт <ChevronDown size={16}/></summary><p className="mt-1 whitespace-pre-wrap text-white/90 bg-black/20 p-2 rounded">{dish.recipe || 'Нет рецепта'}</p></details>
                            <div className="flex gap-2 mt-4"><Button onClick={() => openEditModal(dish)} className="w-full"><Edit size={16} /> Редакт.</Button><Button onClick={() => handleDelete(dish.id)} className="w-full bg-pink-500/50 hover:bg-pink-600/50"><Trash2 size={16} /> Удалить</Button></div>
                        </Card>
                    )
                }) : <p className="col-span-full text-center text-white/80">Список блюд пуст.</p>}
            </div>
        </div>
    );
}
function DishForm({ dish, ingredients, onSave, onClose }) {
    const [formState, setFormState] = useState({ name: dish?.name || '', cookingTime: dish?.cookingTime || '', recipe: dish?.recipe || '', ingredients: dish?.ingredients || [] });
    const [newIngredient, setNewIngredient] = useState({ id: '', quantity: '', unit: 'grams' });
    const selectedIngredient = useMemo(() => ingredients.find(i => i.id === newIngredient.id), [newIngredient.id, ingredients]);
    useEffect(() => { if(selectedIngredient) { setNewIngredient(prev => ({...prev, unit: selectedIngredient.unit})); } }, [selectedIngredient]);
    const handleChange = (e) => setFormState(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleIngredientChange = (e) => setNewIngredient(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const addIngredientToDish = () => {
        if (!newIngredient.id || !newIngredient.quantity) return;
        setFormState(prev => ({ ...prev, ingredients: [...prev.ingredients, { ingredientId: newIngredient.id, quantity: parseFloat(newIngredient.quantity), unit: newIngredient.unit }] }));
        setNewIngredient({ id: '', quantity: '', unit: 'grams' });
    };
    const removeIngredientFromDish = (index) => setFormState(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) }));
    const handleSubmit = (e) => { e.preventDefault(); onSave(formState); };
    return (<Modal onClose={onClose}><form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2"><h3 className="text-2xl font-bold">{dish ? 'Редактировать' : 'Добавить'} блюдо</h3><Input name="name" value={formState.name} onChange={handleChange} placeholder="Название блюда" required /><Input name="cookingTime" value={formState.cookingTime} onChange={handleChange} placeholder="Время готовки" required /><textarea name="recipe" value={formState.recipe} onChange={handleChange} placeholder="Рецепт..." className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/60 h-24" /><div className="space-y-2"><h4 className="font-semibold">Ингредиенты блюда:</h4>{formState.ingredients.length > 0 ? <ul className="space-y-1">{formState.ingredients.map((item, index) => { const ing = ingredients.find(i => i.id === item.ingredientId); return (<li key={index} className="flex justify-between items-center bg-white/10 p-2 rounded-md"><span>{ing?.name || '?'}: {item.quantity} {item.unit}</span><button type="button" onClick={() => removeIngredientFromDish(index)} className="text-pink-400"><Trash2 size={16} /></button></li>); })}</ul> : <p className="text-sm text-white/70">Добавьте ингредиенты.</p>}</div><div className="space-y-2 p-3 bg-white/10 rounded-lg"><h4 className="font-semibold">Добавить ингредиент:</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Select name="id" value={newIngredient.id} onChange={handleIngredientChange}><option value="">Выберите...</option>{ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}</Select><Input name="quantity" type="number" step="0.1" value={newIngredient.quantity} onChange={handleIngredientChange} placeholder="Кол-во" /></div>{selectedIngredient?.unit === 'pieces' && (<div className="flex gap-4 items-center text-sm"><label>Единицы:</label><label className="flex items-center gap-2"><input type="radio" name="unit" value="pieces" checked={newIngredient.unit === 'pieces'} onChange={handleChange} /> Штуки</label><label className="flex items-center gap-2"><input type="radio" name="unit" value="grams" checked={newIngredient.unit === 'grams'} onChange={handleChange} /> Граммы</label></div>)}<Button onClick={addIngredientToDish} className="w-full"><PlusCircle size={16} /> Добавить в блюдо</Button></div><div className="flex justify-end gap-4 pt-4"><Button onClick={onClose} type="button" className="bg-transparent border-none">Отмена</Button><Button type="submit" className="bg-blue-500/80 hover:bg-blue-600/80">Сохранить</Button></div></form></Modal>);
}

// --- Раздел: Настройки и Калькулятор ---
function SettingsAndCalculator({ settings, onUpdateSettings }) {
    const [localSettings, setLocalSettings] = useState(settings);

    const handleProfileChange = (index, field, value) => {
        const newProfiles = [...localSettings.profiles];
        newProfiles[index][field] = value;
        setLocalSettings(prev => ({ ...prev, profiles: newProfiles }));
    };

    const addProfile = () => {
        if (localSettings.profiles.length < 2) {
            const newProfile = { id: Date.now(), name: `Пользователь ${localSettings.profiles.length + 1}`, weight: 60, height: 165, age: 25, gender: 'female', activity: 1.375, nutritionMode: 'maintenance' };
            setLocalSettings(prev => ({ ...prev, profiles: [...prev.profiles, newProfile] }));
        }
    };
    
    const removeProfile = (index) => {
        if (localSettings.profiles.length > 1) {
            const profileToRemove = localSettings.profiles[index];
            setLocalSettings(prev => ({ ...prev, profiles: prev.profiles.filter((_, i) => i !== index), activeProfileIds: prev.activeProfileIds.filter(id => id !== profileToRemove.id) }));
        }
    };

    const handleSave = () => onUpdateSettings(localSettings);
    
    return (
        <Card>
            <h2 className="text-3xl font-bold mb-6">Настройки пользователей</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold">Профили</h3>
                    {localSettings.profiles.map((profile, index) => (
                        <Card key={profile.id} className="bg-white/5">
                             <div className="flex justify-between items-center mb-4">
                                <Input className="!text-xl !font-bold !p-0 !bg-transparent !border-0" value={profile.name} onChange={e => handleProfileChange(index, 'name', e.target.value)} />
                                {localSettings.profiles.length > 1 && <Button onClick={() => removeProfile(index)} className="!p-2 bg-pink-500/50"><Trash2 size={16} /></Button>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Select value={profile.gender} onChange={e => handleProfileChange(index, 'gender', e.target.value)}><option value="male">Мужчина</option><option value="female">Женщина</option></Select>
                                <Input type="number" value={profile.age} onChange={e => handleProfileChange(index, 'age', e.target.value)} placeholder="Возраст" />
                                <Input type="number" value={profile.weight} onChange={e => handleProfileChange(index, 'weight', e.target.value)} placeholder="Вес (кг)" />
                                <Input type="number" value={profile.height} onChange={e => handleProfileChange(index, 'height', e.target.value)} placeholder="Рост (см)" />
                                <Select value={profile.activity} onChange={e => handleProfileChange(index, 'activity', e.target.value)}><option value="1.2">Сидячий</option><option value="1.375">Легкая активность</option><option value="1.55">Средняя</option><option value="1.725">Высокая</option><option value="1.9">Экстремальная</option></Select>
                                <Select value={profile.nutritionMode} onChange={e => handleProfileChange(index, 'nutritionMode', e.target.value)}><option value="maintenance">Поддержание</option><option value="cutting">Сушка</option><option value="bulking">Набор массы</option></Select>
                            </div>
                        </Card>
                    ))}
                    {localSettings.profiles.length < 2 && <Button onClick={addProfile}><Users size={16} /> Добавить профиль</Button>}
                </div>
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold">Расчетные цели КБЖУ</h3>
                    {localSettings.profiles.map((profile) => {
                        const target = getTargetNutrition(profile);
                        return (
                        <Card key={profile.id} className="bg-white/5">
                            <h4 className="text-xl font-bold mb-3">{profile.name}</h4>
                            <div className="space-y-2">
                                <p><strong>Цель ({profile.nutritionMode}):</strong></p>
                                <p className="text-2xl font-bold text-green-300">{target.kcal.toFixed(0)} <span className="text-base text-white/80">ккал/д</span></p>
                                <p>Белки: {target.protein.toFixed(0)} г</p>
                                <p>Жиры: {target.fat.toFixed(0)} г</p>
                                <p>Углеводы: {target.carbs.toFixed(0)} г</p>
                            </div>
                        </Card>
                    )})}
                     <Button onClick={handleSave} className="w-full bg-blue-500/80 hover:bg-blue-600/80 text-lg">Сохранить все настройки</Button>
                </div>
            </div>
        </Card>
    );
}

// --- Раздел: Меню ---
function MenuPlanner({ dishes, ingredients, weeklyMenu, onUpdateMenu, settings, onUpdateSettings, showToast }) {
    const [isAddDishModalOpen, setAddDishModalOpen] = useState(false);
    const [isShoppingListOpen, setShoppingListOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedProfileId, setSelectedProfileId] = useState(null);

    const daysOfWeek = { monday: 'Понедельник', tuesday: 'Вторник', wednesday: 'Среда', thursday: 'Четверг', friday: 'Пятница', saturday: 'Суббота', sunday: 'Воскресенье' };

    const handleActiveProfilesChange = (profileId) => {
        const currentActive = settings.activeProfileIds || [];
        const isActive = currentActive.includes(profileId);
        let newActive;
        if (isActive) {
            newActive = currentActive.length > 1 ? currentActive.filter(id => id !== profileId) : currentActive;
        } else {
            newActive = [...currentActive, profileId];
        }
        onUpdateSettings({ ...settings, activeProfileIds: newActive });
    };

    const addDishToDay = (dishId, portion) => {
        if (!selectedDay || !selectedProfileId) return;
        const profileMenu = weeklyMenu[selectedProfileId] || {};
        const dayDishes = profileMenu[selectedDay] || [];
        const newMeal = { id: Date.now(), dishId, portion: parseFloat(portion) || 1 };
        const newMenu = { ...weeklyMenu, [selectedProfileId]: { ...profileMenu, [selectedDay]: [...dayDishes, newMeal] } };
        onUpdateMenu(newMenu);
        setAddDishModalOpen(false);
    };

    const removeDishFromDay = (profileId, day, mealId) => {
        const profileMenu = weeklyMenu[profileId] || {};
        const updatedDishes = (profileMenu[day] || []).filter((meal) => meal.id !== mealId);
        onUpdateMenu({ ...weeklyMenu, [profileId]: { ...profileMenu, [day]: updatedDishes } });
    };

    const openAddDishModal = (profileId, day) => {
        setSelectedProfileId(profileId);
        setSelectedDay(day);
        setAddDishModalOpen(true);
    };
    
    const handleMenuExport = (format) => {
        const { jsPDF } = window.jspdf;
        const activeProfiles = settings.profiles.filter(p => settings.activeProfileIds.includes(p.id));
        
        if (format === 'pdf' && jsPDF) {
            const doc = new jsPDF();
            doc.addFont('Helvetica', 'normal');
            doc.setFont('Helvetica');
            let y = 15;
            Object.entries(daysOfWeek).forEach(([dayKey, dayName]) => {
                if (y > 270) { doc.addPage(); y = 15; }
                doc.text(dayName, 14, y);
                y += 7;
                const body = [];
                activeProfiles.forEach(profile => {
                    const dayMenu = (weeklyMenu[profile.id] || {})[dayKey] || [];
                    dayMenu.forEach(meal => {
                        const dish = dishes.find(d => d.id === meal.dishId);
                        if(dish) {
                            const totals = calculateTotalsForDish(dish, ingredients, meal.portion);
                            body.push([profile.name, `${dish.name} (${meal.portion}x)`, totals.kcal.toFixed(0), totals.protein.toFixed(0), totals.fat.toFixed(0), totals.carbs.toFixed(0)]);
                        }
                    });
                });
                if (body.length > 0) {
                    doc.autoTable({
                        startY: y,
                        head: [['Пользователь', 'Блюдо', 'Ккал', 'Б', 'Ж', 'У']],
                        body: body,
                        theme: 'grid',
                        styles: { font: 'Helvetica' }
                    });
                    y = doc.lastAutoTable.finalY + 10;
                } else {
                    y += 5;
                }
            });
            doc.save('weekly-menu.pdf');
        } else if (format === 'text') {
            let text = '';
            Object.entries(daysOfWeek).forEach(([dayKey, dayName]) => {
                text += `--- ${dayName.toUpperCase()} ---\n`;
                activeProfiles.forEach(profile => {
                    text += `\n** ${profile.name} **\n`;
                    const dayMenu = (weeklyMenu[profile.id] || {})[dayKey] || [];
                    if (dayMenu.length === 0) {
                        text += "Нет приемов пищи\n";
                    } else {
                        dayMenu.forEach(meal => {
                            const dish = dishes.find(d => d.id === meal.dishId);
                            if (dish) {
                                const totals = calculateTotalsForDish(dish, ingredients, meal.portion);
                                text += `- ${dish.name} (${meal.portion}x): К:${totals.kcal.toFixed(0)} Б:${totals.protein.toFixed(0)} Ж:${totals.fat.toFixed(0)} У:${totals.carbs.toFixed(0)}\n`;
                            }
                        });
                    }
                });
                text += '\n';
            });
            navigator.clipboard.writeText(text).then(() => showToast('Меню скопировано!'));
        }
    };

    const activeProfiles = settings.profiles.filter(p => settings.activeProfileIds.includes(p.id));

    return (
        <div>
            <MenuControls settings={settings} onActiveProfilesChange={handleActiveProfilesChange} onShoppingListClick={() => setShoppingListOpen(true)} onMenuExport={handleMenuExport} />
            
            {isAddDishModalOpen && <AddDishModal dishes={dishes} onAdd={addDishToDay} onClose={() => setAddDishModalOpen(false)} />}
            {isShoppingListOpen && <ShoppingList weeklyMenu={weeklyMenu} dishes={dishes} ingredients={ingredients} settings={settings} onClose={() => setShoppingListOpen(false)} showToast={showToast} />}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {Object.entries(daysOfWeek).map(([dayKey, dayName]) => (
                    <Card key={dayKey}>
                        <h3 className="text-2xl font-bold mb-3 text-center">{dayName}</h3>
                        <div className={`grid gap-4 ${activeProfiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {activeProfiles.map(profile => (
                                <DayCard
                                    key={profile.id}
                                    profile={profile}
                                    dayKey={dayKey}
                                    dishes={dishes}
                                    ingredients={ingredients}
                                    dayMenu={(weeklyMenu[profile.id] || {})[dayKey] || []}
                                    onAddDish={() => openAddDishModal(profile.id, dayKey)}
                                    onRemoveDish={(mealId) => removeDishFromDay(profile.id, dayKey, mealId)}
                                />
                            ))}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function MenuControls({ settings, onActiveProfilesChange, onShoppingListClick, onMenuExport }) {
    const [isExportOpen, setIsExportOpen] = useState(false);
    return (
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-4 bg-white/10 p-2 rounded-full">
                <h3 className="text-lg font-semibold pl-2">Показать меню для:</h3>
                {settings.profiles.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={settings.activeProfileIds.includes(p.id)} onChange={() => onActiveProfilesChange(p.id)} className="form-checkbox h-5 w-5" />
                        {p.name}
                    </label>
                ))}
            </div>
            <div className="flex gap-2">
                <Button onClick={onShoppingListClick} className="bg-green-500/80 hover:bg-green-600/80"><ShoppingCart size={20} /> Список покупок</Button>
                <div className="relative">
                    <Button onClick={() => setIsExportOpen(prev => !prev)}><Download size={20} /> Экспорт меню</Button>
                    {isExportOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-white/20 rounded-md shadow-lg z-20">
                            <a onClick={() => { onMenuExport('pdf'); setIsExportOpen(false); }} className="block px-4 py-2 text-sm text-white hover:bg-white/10 cursor-pointer">Экспорт в PDF</a>
                            <a onClick={() => { onMenuExport('text'); setIsExportOpen(false); }} className="block px-4 py-2 text-sm text-white hover:bg-white/10 cursor-pointer">Копировать текст</a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DayCard({ profile, dayKey, dishes, ingredients, dayMenu, onAddDish, onRemoveDish }) {
    const target = useMemo(() => getTargetNutrition(profile), [profile]);
    
    const dailyTotals = useMemo(() => {
        return dayMenu.reduce((totals, meal) => {
            const dish = dishes.find(d => d.id === meal.dishId);
            const dishTotals = calculateTotalsForDish(dish, ingredients, meal.portion);
            totals.kcal += dishTotals.kcal;
            totals.protein += dishTotals.protein;
            totals.fat += dishTotals.fat;
            totals.carbs += dishTotals.carbs;
            totals.price += dishTotals.price;
            return totals;
        }, { kcal: 0, protein: 0, fat: 0, carbs: 0, price: 0 });
    }, [dayMenu, dishes, ingredients]);

    return (
        <div className="bg-black/20 p-3 rounded-lg flex flex-col gap-3">
            <h4 className="font-bold text-center">{profile.name}</h4>
            <div className="text-xs text-center bg-black/20 p-1 rounded">
                <p className="font-semibold">Цель: <span className="text-yellow-300">{target.kcal.toFixed(0)}</span> / {target.protein.toFixed(0)} / {target.fat.toFixed(0)} / {target.carbs.toFixed(0)}</p>
            </div>
            <div className="space-y-2 min-h-[100px] flex-grow">
                {dayMenu.map((meal) => {
                    const dish = dishes.find(d => d.id === meal.dishId);
                    if (!dish) return null;
                    const dishTotals = calculateTotalsForDish(dish, ingredients, meal.portion);
                    return (
                        <div key={meal.id} className="text-xs bg-white/5 p-1.5 rounded-md">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">{dish.name} ({meal.portion}x)</span>
                                <button onClick={() => onRemoveDish(meal.id)} className="text-pink-400 hover:text-pink-300"><Trash2 size={14} /></button>
                            </div>
                            <p className="text-white/70">КБЖУ: {dishTotals.kcal.toFixed(0)}/{dishTotals.protein.toFixed(0)}/{dishTotals.fat.toFixed(0)}/{dishTotals.carbs.toFixed(0)}</p>
                        </div>
                    );
                })}
            </div>
            <div className="text-xs text-center bg-black/20 p-1 rounded mt-auto">
                <p className="font-semibold">Итог: 
                    <span className={getNutrientClass('kcal', dailyTotals.kcal, target.kcal, profile)}> {dailyTotals.kcal.toFixed(0)}</span> / 
                    <span className={getNutrientClass('protein', dailyTotals.protein, target.protein, profile)}> {dailyTotals.protein.toFixed(0)}</span> / 
                    <span className={getNutrientClass('fat', dailyTotals.fat, target.fat, profile)}> {dailyTotals.fat.toFixed(0)}</span> / 
                    <span className={getNutrientClass('carbs', dailyTotals.carbs, target.carbs, profile)}> {dailyTotals.carbs.toFixed(0)}</span>
                </p>
                <p className="font-semibold">Цена: {dailyTotals.price.toFixed(2)} ₽</p>
            </div>
            <Button onClick={onAddDish} className="w-full text-sm !py-1.5"><PlusCircle size={16} /> Добавить</Button>
        </div>
    );
}

function AddDishModal({ dishes, onAdd, onClose }) {
    const [selectedDish, setSelectedDish] = useState('');
    const [portion, setPortion] = useState(1);
    
    const handleSubmit = () => {
        if (selectedDish) {
            onAdd(selectedDish, portion);
        }
    };

    return (
        <Modal onClose={onClose}>
            <h3 className="text-2xl font-bold mb-4">Добавить блюдо в меню</h3>
            <div className="space-y-4">
                <Select value={selectedDish} onChange={e => setSelectedDish(e.target.value)}>
                    <option value="">Выберите блюдо...</option>
                    {dishes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <Input type="number" step="0.1" value={portion} onChange={e => setPortion(e.target.value)} placeholder="Количество порций (напр., 0.5, 1, 1.5)" />
                <Button onClick={handleSubmit} className="w-full bg-blue-500/80">Добавить</Button>
            </div>
        </Modal>
    );
}

function ShoppingList({ weeklyMenu, dishes, ingredients, settings, onClose, showToast }) {
    const shoppingList = useMemo(() => {
        const requiredIngredients = {};
        const activeProfileIds = settings.activeProfileIds || [];

        activeProfileIds.forEach(profileId => {
            const profileMenu = weeklyMenu[profileId] || {};
            Object.values(profileMenu).flat().forEach(meal => {
                const dish = dishes.find(d => d.id === meal.dishId);
                if (!dish || !dish.ingredients) return;
                dish.ingredients.forEach(item => {
                    const ing = ingredients.find(i => i.id === item.ingredientId);
                    if (!ing) return;
                    const { weight } = calculateIngredientNutrition(item, ing, meal.portion);
                    if (!requiredIngredients[ing.id]) {
                        requiredIngredients[ing.id] = { ...ing, totalGrams: 0 };
                    }
                    requiredIngredients[ing.id].totalGrams += weight;
                });
            });
        });

        let totalCost = 0;
        const list = Object.values(requiredIngredients).map(ing => {
            let toBuyAmount, toBuyUnit, remainder = 0, cost = 0;
            if (ing.unit === 'grams') {
                toBuyAmount = Math.ceil(ing.totalGrams / 10) * 10;
                toBuyUnit = 'г';
                cost = (ing.price / 1000) * toBuyAmount;
            } else {
                if (!ing.gramsPerPiece || ing.gramsPerPiece === 0) {
                    toBuyAmount = '?'; toBuyUnit = 'шт';
                } else {
                    toBuyAmount = Math.ceil(ing.totalGrams / ing.gramsPerPiece);
                    toBuyUnit = 'шт';
                    remainder = (toBuyAmount * ing.gramsPerPiece) - ing.totalGrams;
                    cost = ing.price * toBuyAmount;
                }
            }
            totalCost += cost;
            return { ...ing, toBuyAmount, toBuyUnit, remainder: remainder.toFixed(0), cost };
        });
        return { list, totalCost };
    }, [weeklyMenu, dishes, ingredients, settings.activeProfileIds]);
    
    const handleExport = (format) => {
        const { jsPDF } = window.jspdf;
        if (format === 'pdf' && jsPDF) {
            const doc = new jsPDF();
            doc.addFont('Helvetica', 'normal');
            doc.setFont('Helvetica');
            doc.text("Spisok pokupok", 14, 16);
            doc.autoTable({
                startY: 20,
                head: [['Nazvanie', 'Kupit', 'Tsena', 'Vsego nuzhno (g)']],
                body: shoppingList.list.map(i => [
                    i.name,
                    `${i.toBuyAmount} ${i.toBuyUnit}`, 
                    `${i.cost.toFixed(2)} RUB`, 
                    i.totalGrams.toFixed(0)
                ]),
                foot: [['Itogo', '', `${shoppingList.totalCost.toFixed(2)} RUB`, '']],
                styles: { font: "Helvetica" }
            });
            doc.save('shopping-list.pdf');
        } else if (format === 'text') {
            let textContent = shoppingList.list.map(i => `${i.name}: ${i.toBuyAmount} ${i.toBuyUnit}`).join('\n');
            textContent += `\n\nИтого: ${shoppingList.totalCost.toFixed(2)} ₽`;
            navigator.clipboard.writeText(textContent).then(() => showToast('Список скопирован!'));
        }
    };

    return (
        <Modal onClose={onClose} maxWidth="max-w-2xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold">Список покупок</h3>
                <div className="flex gap-2">
                    <Button onClick={() => handleExport('pdf')} className="!p-2"><Download size={16} /></Button>
                    <Button onClick={() => handleExport('text')} className="!p-2"><Copy size={16} /></Button>
                </div>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                {shoppingList.list.length > 0 ? shoppingList.list.map(ing => (
                    <div key={ing.id} className="bg-white/10 p-3 rounded-lg text-sm flex justify-between items-center">
                        <div>
                            <p className="font-bold text-base">{ing.name}</p>
                            <p>Купить: <span className="font-bold text-green-300">{ing.toBuyAmount} {ing.toBuyUnit}</span></p>
                            {ing.unit === 'pieces' && ing.remainder > 0 && <p className="text-xs text-white/70">Останется: {ing.remainder} г</p>}
                        </div>
                        <p className="font-bold text-lg">{ing.cost.toFixed(2)} ₽</p>
                    </div>
                )) : <p className="text-white/80">Меню пустое, список не сформирован.</p>}
            </div>
            <div className="mt-4 text-right font-bold text-xl">
                Итоговая стоимость: {shoppingList.totalCost.toFixed(2)} ₽
            </div>
        </Modal>
    );
}
