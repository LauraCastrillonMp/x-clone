import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onIdTokenChanged } from 'firebase/auth'
import api, { createProfile } from '../services/api' // createProfile is a named export we call below

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const auth = getAuth()
    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u || null)
      setInitialized(true)
    })
    return () => unsub && unsub()
  }, [])

  const auth = getAuth()

  const value = useMemo(() => ({
    user,
    initialized,
    // existing helpers
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    register: async (email, password, displayName) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      try {
        const u = cred?.user
        if (u) {
          const name = displayName || u.displayName || undefined
          const username = (name || u.email || '').split('@')[0].replace(/\s+/g, '').toLowerCase() || undefined

          // ensure we have a fresh ID token for this user
          const token = await u.getIdToken(/* forceRefresh = */ true).catch(() => null)
          if (token) {
              // call backend helper to create/sync user record
              await createProfile({ idToken: token, fullName: name, username }).catch(() => null)
            } else {
            console.error('No ID token available for backend user sync (register)')
          }
        }
      } catch (err) {
        console.debug('backend sync failed', err)
      }
      return cred
    },
    logout: () => signOut(auth),

    // changed: google popup sign in + backend sync (sends explicit ID token)
    loginWithGoogle: async () => {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      try {
        const u = cred?.user
        if (u) {
          const name = u.displayName || undefined
          const username = (u.displayName || u.email || '').split('@')[0].replace(/\s+/g, '').toLowerCase() || undefined

          const token = await u.getIdToken(/* forceRefresh = */ true).catch(() => null)
          if (token) {
            await createProfile({ idToken: token, fullName: name, username }).catch(() => null)
          } else {
            console.error('No ID token available for backend user sync (google)')
          }
        }
      } catch (err) {
        console.debug('backend sync failed', err)
      }
      return cred
    }
  }), [user, initialized, auth])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export default useAuth