import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Header() {
  const { user, logout } = useAuth()
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  function onSearch(e) {
    e.preventDefault()
    const term = q.trim()
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  return (
    <header className="header">
      <Link to="/" style={{ fontWeight: 700 }}>Orbyt</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <form onSubmit={onSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Search"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ width: 220 }}
          />
          <button className="button" type="submit">Go</button>
        </form>

        {user ? (
          <>
            <span className="muted" style={{ fontSize: 13 }}>{user.email}</span>
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