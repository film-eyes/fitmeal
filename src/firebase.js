import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

let app;
let auth;
let db;
let googleProvider;
let isFirebaseInitialized = false;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    isFirebaseInitialized = true;
    console.log('Firebase: успешно инициализирован');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  console.error('Firebase: конфиг не заполнен или использует заглушки');
}

export {
  app,
  auth,
  db,
  googleProvider,
  isFirebaseInitialized,
  firebaseConfig,
};