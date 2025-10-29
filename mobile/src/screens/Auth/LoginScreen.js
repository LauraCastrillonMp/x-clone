import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { setAuthToken, getProfile, createProfile, saveIdToken } from '../../services/api';

export default function LoginScreen({ navigation, onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function ensureProfile(token, user) {
    try {
      const cachedUsername = (await AsyncStorage.getItem('username')) || '';
      const emailLocal = (user?.email || '').split('@')[0] || 'user';
      const baseName = (user?.displayName || emailLocal).toLowerCase().replace(/[^a-z0-9_]+/g, '');
      let username = cachedUsername || baseName || emailLocal;
      const fullName = user?.displayName || emailLocal;

      // If profile exists, cache username; else try to create
      try {
        const prof = await getProfile(username);
        if (prof?.user?.username) {
          await AsyncStorage.setItem('username', prof.user.username.toLowerCase());
          return;
        }
      } catch {
        // fall through to create
      }

      let final = username;
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
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await cred.user.getIdToken(true);
      await saveIdToken(token); // ensures getAuthHeader works
      setAuthToken(token);
      await ensureProfile(token, cred.user);
      onAuthSuccess ? onAuthSuccess() : navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err) {
      Alert.alert(
        'Login error',
        err?.code === 'auth/network-request-failed'
          ? 'Network error. Try again.'
          : err?.message || 'Login failed'
      );
    }
  }

  function handleGoogle() {
    Alert.alert('Unavailable', 'Google sign-in is disabled in this build.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input}/>
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input}/>
      <TouchableOpacity onPress={handleLogin} style={styles.btn}><Text style={styles.btnText}>Login</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.btn, { backgroundColor: '#DB4437' }]} onPress={handleGoogle}>
        <Text style={styles.btnText}>Continue with Google</Text>
      </TouchableOpacity>
      <Text style={styles.link} onPress={() => navigation.navigate('Register')}>Create account</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:20, justifyContent:'center', backgroundColor:'#F8F4FF' },
  title:{ fontSize:24, fontWeight:'700', color:'#6A1B9A', marginBottom:16 },
  input:{ backgroundColor:'#fff', padding:12, borderRadius:8, marginVertical:8 },
  btn:{ backgroundColor:'#FF7043', padding:12, borderRadius:8, alignItems:'center', marginTop:12 },
  btnText:{ color:'#fff', fontWeight:'700' },
  link:{ color:'#6A1B9A', marginTop:12, textAlign:'center' }
});
