import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { createProfile } from '../services/api' // use createProfile (backend sync that accepts ID token)
import { getAuth, updateProfile } from 'firebase/auth'

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()

  const [fullname, setFullname] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const name = String(fullname || '').trim()
    let uname = String(username || '').trim().toLowerCase().replace(/^@+/, '')
    const mail = String(email || '').trim()
    const pass = String(password || '')

    if (!name) return setError('Full name required')
    if (!uname) return setError('Username required')
    if (!mail) return setError('Email required')
    if (!pass || pass.length < 6) return setError('Password (min 6 chars) required')
    // basic username validation: 3-30 chars, letters/numbers/underscore/dot/hyphen
    if (!/^[a-z0-9._-]{3,30}$/.test(uname)) return setError('Username must be 3–30 characters, lowercase letters, numbers, . _ or -')

    setLoading(true)
    try {
      // create Firebase auth user
      const cred = await register(mail, pass) // createUserWithEmailAndPassword via useAuth

      // set display name in Firebase profile
      try {
        const auth = getAuth()
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: name })
        } else if (cred?.user) {
          await updateProfile(cred.user, { displayName: name })
        }
      } catch (err) {
        console.debug('updateProfile failed', err)
      }

      // create / sync user in backend DB using createProfile (sends fresh ID token)
      try {
        // Prefer the token from the created credential's user (cred.user) to ensure it's fresh
        const auth = getAuth()
        const token = (cred?.user && typeof cred.user.getIdToken === 'function')
          ? await cred.user.getIdToken(true)
          : (auth?.currentUser ? await auth.currentUser.getIdToken(true) : null)

        const result = await createProfile({ idToken: token, fullName: name, username: uname })
        console.debug('createProfile result', result)
        if (!result || !result.user) {
          // backend failed to create the DB user
          setError('Failed to create user in backend')
          setLoading(false)
          return
        }
        // optional: cache username for UI like mobile does
        localStorage.setItem('username', uname)
      } catch (err) {
        console.debug('backend create user failed', err)
        setError(err?.message || 'Backend create user failed')
        setLoading(false)
        return
      }

      // navigate to home
      nav('/')
    } catch (err) {
      setError(err?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>Register</h2>
      <form onSubmit={onSubmit}>
        <input
          className="input"
          placeholder="Full name"
          value={fullname}
          onChange={(e) => setFullname(e.target.value)}
          autoFocus
        />
        <br /><br />
        <input
          className="input"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <br /><br />
        <input
          className="input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br /><br />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br /><br />
        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Register'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
      <p>Already have an account? <Link to="/login">Login</Link></p>
    </div>
  )
}