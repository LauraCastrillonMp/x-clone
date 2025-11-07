import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, signInWithEmailAndPassword as fbSignIn, createUserWithEmailAndPassword as fbSignUp, signOut as fbSignOut, signOutAndClear } from '../services/firebase';
import { onAuthStateChanged, getIdToken, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

// add native GoogleSignin
// import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);

  // backend URL (change to your production URL)
  const API_URL = process.env.BACKEND_URL || 'http://10.0.2.2:3000';

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
    // preferred: use service helper that revokes Google + signs out Firebase + clears storage
    try {
      if (typeof signOutAndClear === 'function') {
        await signOutAndClear();
      } else {
        // fallback: try Google SDK and Firebase signOut
        try {
          await GoogleSignin.revokeAccess();
          await GoogleSignin.signOut();
        } catch (gErr) {
          console.warn('Google signout/revoke failed (continuing):', gErr);
        }
        try {
          await fbSignOut(auth);
        } catch (fErr) {
          console.warn('Firebase signOut failed (continuing):', fErr);
        }
        try { await AsyncStorage.removeItem('idToken'); } catch (e) {}
        try { await AsyncStorage.removeItem('username'); } catch (e) {}
      }
    } catch (err) {
      console.warn('logout helper failed:', err);
      throw err;
    } finally {
      // clear local state
      setUser(null);
      setIdToken(null);
    }
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

  // new: native in-app Google Sign-In for Android (Google Play Services)
  async function loginWithGoogleNative() {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Force account chooser: revoke previous consent and sign out cached session
      try {
        await GoogleSignin.revokeAccess();
        console.log('GoogleSignin: revokeAccess done');
      } catch (e) {
        console.warn('GoogleSignin.revokeAccess() warning (ignorable):', e);
      }
      try {
        await GoogleSignin.signOut();
        console.log('GoogleSignin: signOut done (cache cleared)');
      } catch (e) {
        console.warn('GoogleSignin.signOut() warning (ignorable):', e);
      }

      // small pause to ensure native state is cleared
      await new Promise((r) => setTimeout(r, 250));

      const signInResult = await GoogleSignin.signIn();
      console.log('Google signInResult:', signInResult);

      const googleIdToken =
        signInResult?.idToken ??
        signInResult?.data?.idToken ??
        signInResult?.user?.idToken ??
        null;

      const serverAuthCode =
        signInResult?.serverAuthCode ?? signInResult?.data?.serverAuthCode ?? null;

      if (!googleIdToken) {
        if (serverAuthCode) {
          throw new Error('Google returned serverAuthCode but no idToken. Configure webClientId or exchange serverAuthCode on backend.');
        }
        throw new Error('Google sign-in returned no idToken. Check webClientId and SHA‑1 in Firebase.');
      }

      console.log('googleIdToken (truncated):', googleIdToken.slice(0, 80));
      const credential = GoogleAuthProvider.credential(googleIdToken);
      const result = await signInWithCredential(auth, credential);
      console.log('signInWithCredential result user:', result.user?.uid);

      const token = await getIdToken(result.user, true);
      setIdToken(token);
      await AsyncStorage.setItem('idToken', token);

      // backend upsert (non-blocking)
      fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uid: result.user.uid,
          email: result.user.email,
          name: result.user.displayName,
          photoURL: result.user.photoURL,
        }),
      }).catch(e => console.warn('backend /auth/google failed:', e));

      return result.user;
    } catch (e) {
      console.error('loginWithGoogleNative error:', e);
      throw e;
    }
  }

  return { user, idToken, login, loginWithGoogle, loginWithGoogleNative, register, logout };
}
