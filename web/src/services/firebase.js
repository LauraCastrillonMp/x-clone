// filepath: d:\dev\orbyt\web\src\services\firebase.js
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'

const firebaseConfig = {

  apiKey: "AIzaSyDOHjmVuIQ9PSw8wc_x1yu-hnmMra6ql1k",

  authDomain: "orbyt-bae72.firebaseapp.com",

  projectId: "orbyt-bae72",

  storageBucket: "orbyt-bae72.firebasestorage.app",

  messagingSenderId: "574404750139",

  appId: "1:574404750139:web:1978167cc8d3ef2c73a51e"

};

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export { onIdTokenChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut }