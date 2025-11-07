import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'


export default function Header() {
  const { user, logout } = useAuth()
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  // prefer explicit username/handle; fallback to email local-part or remote lookup
  const initialDisplay =
    (user && (user.username || user.handle || user.userName)) ||
    (user?.email ? user.email.split('@')[0] : (user?.name || user?.displayName || 'User'))

  const [displayUsername, setDisplayUsername] = useState(initialDisplay)

  useEffect(() => {
    let mounted = true
    async function lookupByEmail(email) {
      if (!email) return
      // try a few likely endpoints; adapt to your API
      const endpoints = [
        `/api/users/by-email?email=${encodeURIComponent(email)}`,
        `/api/users?email=${encodeURIComponent(email)}`,
        `/api/user?email=${encodeURIComponent(email)}`
      ]
      for (const url of endpoints) {
        try {
          const res = await fetch(url, { credentials: 'include' })
          if (!res.ok) continue
          const body = await res.json()
          // support different shapes: { username }, { user: { username } }, { data: { username } }
          const username =
            body?.username ||
            body?.user?.username ||
            body?.data?.username ||
            (Array.isArray(body?.users) && body.users[0]?.username)
          if (username && mounted) {
            setDisplayUsername(username)
            return
          }
        } catch (err) {
          // ignore and try next
        }
      }
      // fallback: local-part of email
      if (mounted && user?.email) setDisplayUsername(user.email.split('@')[0])
    }

    if (user) {
      // prefer already provided username, otherwise try lookup
      if (user.username || user.handle || user.userName) {
        setDisplayUsername(user.username || user.handle || user.userName)
      } else if (user.email) {
        lookupByEmail(user.email)
      } else {
        setDisplayUsername(user?.name || user?.displayName || 'User')
      }
    }

    return () => { mounted = false }
  }, [user])

  return (
    <header className="header">
      <Link to="/" style={{ fontWeight: 700, display: 'flex', alignItems: 'center' }}>
        <img src="/logo.png" alt="Orbyt" style={{ height: 32 }} />
        <span style={{ marginLeft: 8, color: 'var(--primary)' }}>Orbyt</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user ? (
          <>
            <span className="muted" style={{ fontSize: 13 }}>@{displayUsername}</span>
            <button className="button" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className="button">Login</Link>
            <Link to="/register" className="button">Register</Link>
          </>
        )}
      </div>
    </header>
  )
}