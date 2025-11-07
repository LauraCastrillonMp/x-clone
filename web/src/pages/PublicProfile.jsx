// filepath: d:\dev\orbyt\web\src\pages\PublicProfile.jsx
import React, { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { TweetsApi, UserApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import TweetCard from '../components/TweetCard'
import Empty from '../components/Empty'
import Loader from '../components/Loader'
import ErrorMessage from '../components/ErrorMessage'
import Avatar from '../components/Avatar'
import FollowButton from '../components/FollowButton'
import { parseListResponse } from '../utils/normalize'

export default function PublicProfile() {
  const { username: paramUsername } = useParams()
  const { user: me } = useAuth()
  const meUsername = (me?.username || me?.handle || (me?.email ? me.email.split('@')[0] : '')).toLowerCase()
  const targetUsername = (paramUsername || '').toLowerCase()
  const isMe = !!meUsername && meUsername === targetUsername

  const qs = new URLSearchParams(useLocation().search)
  const qId = qs.get('id') || ''

  const [profile, setProfile] = useState(null)
  const [tweets, setTweets] = useState([])
  const [followersCount, setFollowersCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        let u = null
        // Prefer username endpoint
        try {
          const r = await UserApi.byUsername(paramUsername)
          u = r?.data?.user || r?.data || null
          if (Array.isArray(u)) u = u[0] || null
        } catch {}
        // Fallback by id or search
        if (!u && qId) {
          try { const r = await UserApi.byId(qId); u = r?.data?.user || r?.data || null } catch {}
        }
        if (!u) {
          const s = await UserApi.search(paramUsername)
          const { items } = parseListResponse(s.data)
          u = items.find(x => (x.username || x.handle || '').toLowerCase() === String(paramUsername).toLowerCase()) || items[0] || null
        }
        if (!mounted) return
        setProfile(u)

        const targetId = u?.id || u?._id || qId || null
        const targetUsername = (u?.username || u?.handle || paramUsername || '').toLowerCase()

        // Tweets
        let list = []
        if (targetId) {
          const t = await TweetsApi.byUser(targetId)
          const { items } = parseListResponse(t.data)
          list = items || []
        }
        const filtered = (list || [])
          .filter((tw) => {
            const a = tw?.author || tw?.user || tw?.owner || {}
            const aid = a?.id || a?._id || tw?.userId || tw?.authorId
            const aun = (a?.username || a?.handle || '').toLowerCase()
            return (targetId && String(aid) === String(targetId)) || (aun && aun === targetUsername)
          })
          .filter(t => !(t.parentId || t.parent || t.replyTo || t.inReplyToId || t.isReply)) // exclude replies
        setTweets(filtered)

        // Counts
        try {
          const [rf, rng] = await Promise.allSettled([
            UserApi.followers(targetUsername),
            UserApi.following(targetUsername)
          ])
          const followers =
            (rf.value?.data?.items?.length) ?? (rf.value?.data?.users?.length) ?? (rf.value?.data?.results?.length) ?? null
          const following =
            (rng.value?.data?.items?.length) ?? (rng.value?.data?.users?.length) ?? (rng.value?.data?.results?.length) ?? null
          if (followers !== null) setFollowersCount(followers)
          if (following !== null) setFollowingCount(following)
        } catch {}
      } catch (e) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load profile')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [paramUsername, qId])

  if (loading) return <Loader />
  if (error) return <ErrorMessage error={error} />
  if (!profile) return <Empty>User not found.</Empty>

  const name = profile.name || profile.displayName || profile.username || profile.handle || 'User'
  const targetId = profile.id || profile._id || qId
  const avatar = profile.avatar || profile.avatarUrl || profile.photoURL || ''

  function onFollowToggle(next) {
    setFollowersCount(c => (typeof c === 'number' ? Math.max(0, c + (next ? 1 : -1)) : c))
  }

  return (
    <div className="container">
      <div className="card profile-header">
        <Avatar size={64} src={avatar} alt={name} />
        <div className="profile-header__info">
          <div className="profile-header__name">{name}</div>
          <div className="muted">@{targetUsername} · #{String(targetId || '').slice(-6)}</div>
          <div className="profile-header__actions">
            {isMe ? (
              <Link to="/profile" className="button">Edit profile</Link>
            ) : (
              <FollowButton targetUsername={targetUsername} size="small" onChange={onFollowToggle} />
            )}
          </div>
        </div>
      </div>

      {tweets.length === 0 ? <Empty>No posts yet.</Empty> : tweets.map((t, i) => (
        <TweetCard key={t.id || t._id || `${t.createdAt || t.date || ''}-${i}`} tweet={t} />
      ))}
    </div>
  )
}