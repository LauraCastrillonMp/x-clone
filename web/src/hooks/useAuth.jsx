import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  auth,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u || null)
      setInitialized(true)
    })
    return () => unsub()
  }, [])

  const value = useMemo(() => ({
    user,
    initialized,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    register: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth)
  }), [user, initialized])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}