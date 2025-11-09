import React, { useEffect, useMemo, useState } from 'react';
import {
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { BookOpen, Utensils, Calendar as CalendarIcon, Users, LogOut } from 'lucide-react';

import {
  auth,
  db,
  googleProvider,
  isFirebaseInitialized,
  firebaseConfig,
} from './firebase';

import NavButton from './components/ui/NavButton';
import Button from './components/ui/Button';
import Toast from './components/ui/Toast';

import SignInPrompt from './components/auth/SignInPrompt';
import FirebaseConfigErrorScreen from './components/auth/FirebaseConfigErrorScreen';

import IngredientsManager from './features/ingredients/IngredientsManager';
import DishesManager from './features/dishes/DishesManager';
import SettingsAndCalculator from './features/settings/SettingsAndCalculator';
import MenuPlanner from './features/menu/MenuPlanner';

export default function App() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY') {
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

  // jsPDF скрипты
  useEffect(() => {
    const loadScript = (src, id) => {
      if (!document.getElementById(id)) {
        const s = document.createElement('script');
        s.src = src;
        s.id = id;
        s.async = true;
        document.body.appendChild(s);
      }
    };

    loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'jspdf-script',
    );
    loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
      'jspdf-autotable-script',
    );
  }, []);

  // автоскрытие тостов
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(''), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Auth
  useEffect(() => {
    if (!isFirebaseInitialized) {
      console.error('App: Firebase не инициализирован');
      return;
    }

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
          setUser(u);
          setIsAuthReady(true);
        });
        return () => unsub();
      })
      .catch((e) => {
        console.error('Ошибка установки persistence:', e);
        setIsAuthReady(true);
      });
  }, []);

  // Данные пользователя
  useEffect(() => {
    if (!isAuthReady || !user) {
      setIngredients([]);
      setDishes([]);
      setWeeklyMenu({});
      setSettings(null);
      return;
    }

    const userId = user.uid;

    const defaultSettings = {
      profiles: [
        {
          id: 1,
          name: user.displayName || 'Пользователь 1',
          weight: 70,
          height: 180,
          age: 30,
          gender: 'male',
          activity: 1.375,
          nutritionMode: 'maintenance',
        },
      ],
      activeProfileIds: [1],
    };

    const settingsRef = doc(db, `users/${userId}/data/settings`);
    const unsubSettings = onSnapshot(settingsRef, (d) =>
      setSettings(d.exists() ? { ...defaultSettings, ...d.data() } : defaultSettings),
    );

    const unsubIngredients = onSnapshot(
      collection(db, `users/${userId}/ingredients`),
      (snap) => setIngredients(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );

    const unsubDishes = onSnapshot(
      collection(db, `users/${userId}/dishes`),
      (snap) => setDishes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );

    const menuRef = doc(db, `users/${userId}/data/weeklyMenu`);
    const unsubMenu = onSnapshot(menuRef, (d) =>
      setWeeklyMenu(d.exists() ? d.data() : {}),
    );

    return () => {
      unsubSettings();
      unsubIngredients();
      unsubDishes();
      unsubMenu();
    };
  }, [isAuthReady, user]);

  const handleUpdateSettings = async (newSettings) => {
    if (!user) return;
    await setDoc(doc(db, `users/${user.uid}/data/settings`), newSettings);
    setToastMessage('Настройки успешно сохранены!');
  };

  const handleUpdateMenu = async (newMenu) => {
    if (!user) return;
    await setDoc(doc(db, `users/${user.uid}/data/weeklyMenu`), newMenu, { merge: true });
  };

  const crudHandlers = useMemo(() => {
    if (!user) return {};
    const userId = user.uid;
    return {
      ingredients: {
        add: (ing) => addDoc(collection(db, `users/${userId}/ingredients`), ing),
        update: (id, ing) =>
          updateDoc(doc(db, `users/${userId}/ingredients/${id}`), ing),
        delete: (id) =>
          deleteDoc(doc(db, `users/${userId}/ingredients/${id}`)),
      },
      dishes: {
        add: (d) => addDoc(collection(db, `users/${userId}/dishes`), d),
        update: (id, d) =>
          updateDoc(doc(db, `users/${userId}/dishes/${id}`), d),
        delete: (id) =>
          deleteDoc(doc(db, `users/${userId}/dishes/${id}`)),
      },
    };
  }, [user]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign-In Error:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  // ранние состояния
  if (!isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-white bg-gradient-to-tr from-pink-500 to-blue-500">
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return <SignInPrompt onSignIn={handleGoogleSignIn} />;
  }

  if (!settings) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-white bg-gradient-to-tr from-pink-500 to-blue-500">
        Загрузка данных пользователя...
      </div>
    );
  }

  // выбор контента
  let mainContent;
  switch (view) {
    case 'ingredients':
      mainContent = (
        <IngredientsManager
          ingredients={ingredients}
          onAdd={crudHandlers.ingredients.add}
          onUpdate={crudHandlers.ingredients.update}
          onDelete={crudHandlers.ingredients.delete}
        />
      );
      break;
    case 'dishes':
      mainContent = (
        <DishesManager
          dishes={dishes}
          ingredients={ingredients}
          onAdd={crudHandlers.dishes.add}
          onUpdate={crudHandlers.dishes.update}
          onDelete={crudHandlers.dishes.delete}
        />
      );
      break;
    case 'calculator':
      mainContent = (
        <SettingsAndCalculator
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      );
      break;
    default:
      mainContent = (
        <MenuPlanner
          dishes={dishes}
          ingredients={ingredients}
          weeklyMenu={weeklyMenu}
          onUpdateMenu={handleUpdateMenu}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          showToast={setToastMessage}
        />
      );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FF00D9] to-[#0099FF] font-sans text-white p-4 sm:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-shadow">FitMeal</h1>
            <p className="text-lg text-white/80 text-shadow">Спортивное меню без заеба</p>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold">{user.displayName}</p>
                <p className="text-xs opacity-80">{user.email}</p>
              </div>
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt="User Avatar"
                  className="w-12 h-12 rounded-full border-2 border-white/50"
                />
              )}
              <Button
                onClick={handleSignOut}
                className="bg-pink-500/80 hover:bg-pink-600/80"
              >
                <LogOut size={20} />
              </Button>
            </div>
          )}
        </header>

        {user && (
          <nav className="flex justify-center flex-wrap items-center gap-2 sm:gap-4 mb-8 p-2 bg-white/20 backdrop-blur-sm rounded-full">
            <NavButton
              icon={<Utensils size={20} />}
              text="Ингредиенты"
              isActive={view === 'ingredients'}
              onClick={() => setView('ingredients')}
            />
            <NavButton
              icon={<BookOpen size={20} />}
              text="Блюда"
              isActive={view === 'dishes'}
              onClick={() => setView('dishes')}
            />
            <NavButton
              icon={<CalendarIcon size={20} />}
              text="Меню"
              isActive={view === 'menu'}
              onClick={() => setView('menu')}
            />
            <NavButton
              icon={<Users size={20} />}
              text="Настройки"
              isActive={view === 'calculator'}
              onClick={() => setView('calculator')}
            />
          </nav>
        )}

        <main>{mainContent}</main>

        <Toast message={toastMessage} />

        <footer className="text-center mt-12 text-white/60 text-sm">
          <p>Дизайн и разработка: Nikita Vedenyapin</p>
          {user && (
            <p className="text-xs mt-1 opacity-50">User ID: {user.uid}</p>
          )}
        </footer>
      </div>
    </div>
  );
}