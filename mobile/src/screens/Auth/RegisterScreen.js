import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { auth, createUserWithEmailAndPassword } from "../../services/firebase";
import { createProfile } from '../../services/api';
import { getIdToken } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function handleRegister() {
    if (!fullName || !username || !email || !password) return Alert.alert('Missing fields');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const token = await getIdToken(cred.user, true);

      // create profile in backend
      const result = await createProfile({ idToken: token, fullName, username });
      if (result.user) {
        // persist for the Profile tab wrapper
        await AsyncStorage.setItem('username', username);

        // optional: also cache id token for API calls
        await AsyncStorage.setItem('idToken', token);

        Alert.alert('Registered', 'Profile created successfully');
        navigation.replace('HomeMain');
      } else {
        Alert.alert('Error', JSON.stringify(result));
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Register error', err.message || 'Error');
    }
  }
  function handleGoogle() {
    Alert.alert('Unavailable', 'Google sign-in is disabled in this build.');
  }
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput placeholder="Full name" value={fullName} onChangeText={setFullName} style={styles.input}/>
      <TextInput placeholder="Username" value={username} onChangeText={setUsername} style={styles.input}/>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address"/>
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry/>
      <TouchableOpacity onPress={handleRegister} style={styles.btn}><Text style={styles.btnText}>Register</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.btn, { backgroundColor: '#DB4437' }]} onPress={handleGoogle}>
        <Text style={styles.btnText}>Continue with Google</Text>
      </TouchableOpacity>
      <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
        Already have an account? Sign in
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container:{ flex:1, padding:20, justifyContent:'center', backgroundColor:'#F8F4FF' },
  title:{ fontSize:24, fontWeight:'700', color:'#6A1B9A', marginBottom:16 },
  input:{ backgroundColor:'#fff', padding:12, borderRadius:8, marginVertical:8 },
  btn:{ backgroundColor:'#6A1B9A', padding:12, borderRadius:8, alignItems:'center', marginTop:12 },
  btnText:{ color:'#fff', fontWeight:'700' },
  link:{ color:'#6A1B9A', marginTop:12, textAlign:'center' }
});
