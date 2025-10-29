import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.BACKEND_FIREBASE_API_KEY,
  authDomain: process.env.BACKEND_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.BACKEND_FIREBASE_PROJECT_ID,
  storageBucket: process.env.BACKEND_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.BACKEND_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.BACKEND_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app); // already initialized
}

export async function signOutAndClear() {
  try { await signOut(auth); } finally { await AsyncStorage.removeItem('idToken'); }
}

export { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
