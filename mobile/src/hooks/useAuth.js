import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, signInWithEmailAndPassword as fbSignIn, createUserWithEmailAndPassword as fbSignUp, signOut as fbSignOut, /* signInWithGoogle, */ signInWithGoogleWebFlow } from '../services/firebase';
import { onAuthStateChanged, getIdToken } from 'firebase/auth';
export default function useAuth() {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const token = await getIdToken(u, true);
        setIdToken(token);
        await AsyncStorage.setItem('idToken', token);
      } else {
        setUser(null);
        setIdToken(null);
        await AsyncStorage.removeItem('idToken');
      }
    });
    return unsubscribe;
  }, []);
  async function login(email, password) {
    const cred = await fbSignIn(auth, email, password);
    const token = await getIdToken(cred.user, true);
    setIdToken(token);
    await AsyncStorage.setItem('idToken', token);
    return cred.user;
  }
  async function register(email, password) {
    const cred = await fbSignUp(auth, email, password);
    const token = await getIdToken(cred.user, true);
    setIdToken(token);
    await AsyncStorage.setItem('idToken', token);
    return cred.user;
  }
  async function logout() {
    await fbSignOut(auth);
    await AsyncStorage.removeItem('idToken');
    await AsyncStorage.removeItem('username'); // add this
    setUser(null);
    setIdToken(null);
  }
  async function loginWithGoogle() {
    try {
      const cred = await signInWithGoogleWebFlow();
      const token = await getIdToken(cred.user); // no forced refresh
      setIdToken(token);
      await AsyncStorage.setItem('idToken', token);
      return cred.user;
    } catch (e) {
      throw e;
    }
  }
  return { user, idToken, login, loginWithGoogle, register, logout };
}
