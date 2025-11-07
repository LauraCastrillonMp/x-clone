import { GoogleSignin } from '@react-native-google-signin/google-signin';
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

let auth = getAuth(app);
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

// Configure Google Signin: use the Web client ID from Firebase console
GoogleSignin.configure({
  webClientId: '574404750139-fg9p0pcjdfn7g6s3cohki9hubdidhrch.apps.googleusercontent.com', // ensure this is the Web OAuth client id
  offlineAccess: true,
});

export async function signOutAndClear() {
  try {
    // try to revoke Google access and sign out of Google SDK (non-fatal)
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
      console.log('GoogleSignin: revokeAccess & signOut done');
    } catch (googleErr) {
      console.warn('GoogleSignin revoke/signOut failed (continuing):', googleErr);
    }

    // sign out from Firebase
    await signOut(auth);
  } finally {
    // clear client tokens/cached username
    try { await AsyncStorage.removeItem('idToken'); } catch (e) {}
    try { await AsyncStorage.removeItem('username'); } catch (e) {}
  }
}

export { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
