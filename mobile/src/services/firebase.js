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

  apiKey: "AIzaSyDOHjmVuIQ9PSw8wc_x1yu-hnmMra6ql1k",

  authDomain: "orbyt-bae72.firebaseapp.com",

  projectId: "orbyt-bae72",

  storageBucket: "orbyt-bae72.firebasestorage.app",

  messagingSenderId: "574404750139",

  appId: "1:574404750139:web:1978167cc8d3ef2c73a51e"

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
