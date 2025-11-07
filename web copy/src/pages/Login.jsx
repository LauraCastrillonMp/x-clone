import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { UserApi } from '../services/api'

export default function Login() {
  const { login, loginWithGoogle } = useAuth()
  const nav = useNavigate()
  const [username, setUsername] = useState('') // now only username
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const uname = String(username || '').trim()
    if (!uname) {
      setError('Username required')
      return
    }
    try {
      // resolve username -> email using backend user endpoint
      let email = null
      try {
        const r = await UserApi.byUsername(uname)
        const u = r?.data?.user ?? r?.data ?? (Array.isArray(r?.data) ? r.data[0] : null)
        email = u?.email || u?.emailAddress || null
      } catch (err) {
        email = null
      }

      if (!email) {
        setError('User not found or no email associated')
        return
      }

      await login(email, password)
      nav('/')
    } catch (err) {
      setError(err?.message || 'Login failed')
    }
  }

  // Open backend OAuth flow in a popup and reload when it completes.
  async function onGoogleSignIn() {
    setError('')
    setLoadingGoogle(true)
    try {
      // use the firebase/google flow implemented in useAuth (creates/syncs backend profile)
      await loginWithGoogle()
      nav('/')
    } catch (err) {
      // fallback: keep original popup message if needed (but prefer the firebase flow)
      setError(err?.message || 'Google sign-in failed')
    } finally {
      setLoadingGoogle(false)
    }
  }

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={onSubmit}>
        <input
          className="input"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoFocus
        />
        <br /><br />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <br /><br />
        <button className="button" type="submit">Login</button>
        <button
          type="button"
          className="button"
          onClick={onGoogleSignIn}
          style={{ marginLeft: 8 }}
          disabled={loadingGoogle}
        >
          {loadingGoogle ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
      <p>Don’t have an account? <Link to="/register">Register</Link></p>
    </div>
  )
}