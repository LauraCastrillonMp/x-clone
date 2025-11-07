// filepath: d:\dev\orbyt\web\src\App.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Header from './components/Header'
import Sidebar from './components/Sidebar'

import Home from './pages/Home'
import TweetDetail from './pages/TweetDetail'
import Profile from './pages/Profile'
import PublicProfile from './pages/PublicProfile'
import Followers from './pages/Followers'
import Following from './pages/Following'
// import Search from './pages/Search'
// import Saved from './pages/Saved'
// import Notifications from './pages/Notifications'
import Compose from './pages/Compose'
import Login from './pages/Login'
import Register from './pages/Register'

function PrivateRoute({ children }) {
  const { user, initialized } = useAuth()
  if (!initialized) return <div className="container">Loading…</div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Header />
      <div className="shell">
        <Sidebar />
        <main className="main">
          <div className="container">
            <Routes>
              <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
              <Route path="/tweet/:id" element={<PrivateRoute><TweetDetail /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/u/:username" element={<PrivateRoute><PublicProfile /></PrivateRoute>} />
              <Route path="/followers" element={<PrivateRoute><Followers /></PrivateRoute>} />
              <Route path="/following" element={<PrivateRoute><Following /></PrivateRoute>} />
              {/* <Route path="/search" element={<PrivateRoute><Search /></PrivateRoute>} />
              <Route path="/saved" element={<PrivateRoute><Saved /></PrivateRoute>} /> */}
              {/* <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} /> */}
              <Route path="/compose" element={<PrivateRoute><Compose /></PrivateRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}