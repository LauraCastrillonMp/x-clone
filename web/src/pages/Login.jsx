// filepath: d:\dev\orbyt\web\src\pages\Login.jsx
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      nav('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={onSubmit}>
        <input className="input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <br /><br />
        <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <br /><br />
        <button className="button" type="submit">Login</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
      <p>Don’t have an account? <Link to="/register">Register</Link></p>
    </div>
  )
}