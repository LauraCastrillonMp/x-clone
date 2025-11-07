import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile, saveIdToken, setAuthToken, createProfile, loginWithUsername } from '../../services/api';
import useAuth from '../../hooks/useAuth';

export default function LoginScreen({ navigation, onAuthSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { loginWithGoogleNative } = useAuth();

  async function ensureProfile(token, user) {
    try {
      const cachedUsername = (await AsyncStorage.getItem('username')) || '';
      const emailLocal = (user?.email || '').split('@')[0] || 'user';
      const baseName = (user?.displayName || emailLocal).toLowerCase().replace(/[^a-z0-9_]+/g, '');
      let uname = cachedUsername || baseName || emailLocal;
      const fullName = user?.displayName || emailLocal;

      try {
        const prof = await getProfile(uname);
        if (prof?.user?.username) {
          await AsyncStorage.setItem('username', prof.user.username.toLowerCase());
          return;
        }
      } catch {
        // fall through to create
      }

      let final = uname;
      for (let tries = 0; tries < 3; tries++) {
        const created = await createProfile({ idToken: token, fullName, username: final });
        if (created?.user?.username) {
          await AsyncStorage.setItem('username', created.user.username.toLowerCase());
          return;
        }
        if (created?.message?.toLowerCase?.().includes('in use')) {
          final = `${baseName}${Math.floor(Math.random() * 1000)}`;
        } else {
          break;
        }
      }
    } catch (e) {
      console.warn('ensureProfile error', e?.message || e);
    }
  }

  async function handleLogin() {
    try {
      const ident = (username || '').trim().toLowerCase();
      const passwd = (password || '').toString();
      if (!ident || !passwd) {
        Alert.alert('Login error', 'Please enter username and password');
        return;
      }

      let resp;
      try {
        resp = await loginWithUsername(ident, passwd);
      } catch (e) {
        console.error('Backend login failed', e.message || e);
        Alert.alert('Login error', e.message === 'Invalid credentials' ? 'Invalid username or password' : (e.message || 'Login failed'));
        return;
      }

      const token = resp.idToken;
      if (!token) {
        Alert.alert('Login error', 'Authentication failed');
        return;
      }
      await saveIdToken(token);
      setAuthToken(token);

      await ensureProfile(token, { email: resp.user.email, displayName: resp.user.fullName });

      // read the canonical username that ensureProfile saved (avoid overwriting it)
      const finalUsername = (await AsyncStorage.getItem('username')) || ident;

      await AsyncStorage.setItem('idToken', token);
      // ensure storage has canonical username
      await AsyncStorage.setItem('username', finalUsername);

      // notify navigator and pass canonical username so navigation updates immediately
      if (onAuthSuccess) onAuthSuccess(finalUsername);
      else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err) {
      console.error('Login unexpected error', err);
      Alert.alert('Login error', err?.message || 'Login failed');
    }
  }

  async function handleGoogle() {
    try {
      console.log('Starting native Google sign-in...');
      const user = await loginWithGoogleNative();
      console.log('loginWithGoogleNative returned user:', { uid: user?.uid, email: user?.email, idToken: user?.idToken });

      // if loginWithGoogleNative gave an idToken, persist it like username flow
      if (user?.idToken) {
        try {
          await saveIdToken(user.idToken);
          await AsyncStorage.setItem('idToken', user.idToken);
          setAuthToken(user.idToken);
        } catch (e) {
          console.warn('saving idToken failed', e);
        }
      }

      // try to ensure/profile creation (may depend on token)
      const token = await AsyncStorage.getItem('idToken');
      console.log('idToken from AsyncStorage present:', !!token);

      try {
        await ensureProfile(token, user);
        console.log('ensureProfile done');
      } catch (err) {
        console.warn('ensureProfile failed (continuing):', err);
      }

      // read the username set by ensureProfile (if any)
      let finalUsername = (await AsyncStorage.getItem('username')) || null;

      // fallback: derive a sane username from email/displayName and persist it
      if (!finalUsername) {
        const emailLocal = (user?.email || '').split('@')[0] || 'user';
        const baseName = (user?.displayName || emailLocal).toLowerCase().replace(/[^a-z0-9_]+/g, '') || emailLocal;
        const fallback = baseName;
        try {
          await AsyncStorage.setItem('username', fallback);
          finalUsername = fallback;
          console.log('Set fallback username:', fallback);
        } catch (e) {
          console.warn('Could not persist fallback username', e);
        }
      }

      console.log('Navigating to Main (reset). finalUsername=', finalUsername);
      if (typeof onAuthSuccess === 'function') onAuthSuccess(finalUsername);
      else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      console.log('Navigation reset called.');
    } catch (err) {
      console.error('Google sign-in error', err);
      Alert.alert('Google sign-in failed', err?.message || 'Try again');
    }
  }

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.png')} style={{ width: 64, height: 64, alignSelf: 'center', marginBottom: 16 }} />
      <Text style={styles.title}>Welcome back</Text>
      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <TouchableOpacity onPress={handleLogin} style={styles.btn}>
        <Text style={styles.btnText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, { backgroundColor: '#713a94ff' }]} onPress={handleGoogle}>
        <Text style={styles.btnText}>Continue with Google</Text>
      </TouchableOpacity>

      <Text style={styles.link} onPress={() => navigation.navigate('Register')}>Create account</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#eadeffff' },
  title: { fontSize: 24, fontWeight: '700', color: '#6A1B9A', marginBottom: 16 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginVertical: 8 },
  btn: { backgroundColor: '#6A1B9A', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
  link: { color: '#6A1B9A', marginTop: 12, textAlign: 'center' },
});
