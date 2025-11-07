import React from 'react'
import { Link } from 'react-router-dom'
import Avatar from './Avatar'
import FollowButton from './FollowButton'
import { useAuth } from '../hooks/useAuth'

export default function UserRow({ user }) {
  if (!user) return null
  const id = user.id || user._id || user.uid || user.userId
  const username = (user.username || user.handle || (user.email ? user.email.split('@')[0] : 'user')).toLowerCase()
  const name = user.name || user.displayName || username
  const avatar = user.avatar || user.avatarUrl || user.photoURL || ''

  const { user: me } = useAuth()
  const meUsername = (me?.username || me?.handle || (me?.email ? me.email.split('@')[0] : '')).toLowerCase()
  const isMe = !!meUsername && meUsername === username

  return (
    <div className="card user-row">
      <Avatar size={42} src={avatar} alt={username} />
      <div className="user-row__info">
        <Link to={`/u/${encodeURIComponent(username)}${id ? `?id=${encodeURIComponent(id)}` : ''}`} className="user-row__name">
          {name}
        </Link>
        <div className="muted user-row__meta">@{username} · #{String(id || '').slice(-6)}</div>
      </div>

      {isMe ? (
        <Link to="/profile" className="button small">Edit profile</Link>
      ) : (
        <FollowButton
          targetUsername={username}
          initiallyFollowing={
            (typeof user.isFollowing === 'boolean') ? user.isFollowing
            : (typeof user.following === 'boolean') ? user.following
            : undefined
          }
          size="small"
        />
      )}
    </div>
  )
}