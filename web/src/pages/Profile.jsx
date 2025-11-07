// filepath: d:\dev\orbyt\web\src\pages\Profile.jsx
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserApi, TweetsApi } from '../services/api'
import TweetCard from '../components/TweetCard'
import Empty from '../components/Empty'
import Loader from '../components/Loader'
import ErrorMessage from '../components/ErrorMessage'
import Avatar from '../components/Avatar'
import { parseListResponse } from '../utils/normalize'

export default function Profile() {
  const [me, setMe] = useState(null)
  const [tweets, setTweets] = useState([])
  const [followersCount, setFollowersCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await UserApi.profile()
        const user = data?.user || data || null
        if (!mounted) return
        setMe(user)

        const myId = user?.id || user?._id || null
        const myUsername = (user?.username || user?.handle || '').toLowerCase()

        // Tweets
        let list = []
        if (myId) {
          const res = await TweetsApi.byUser(myId)
          const { items } = parseListResponse(res.data)
          list = items || []
        }
        const filtered = (list || [])
          .filter((tw) => {
            const a = tw?.author || tw?.user || tw?.owner || {}
            const aid = a?.id || a?._id || tw?.userId || tw?.authorId
            const aun = (a?.username || a?.handle || '').toLowerCase()
            return (myId && String(aid) === String(myId)) || (myUsername && aun === myUsername)
          })
          .filter(t => !(t.parentId || t.parent || t.replyTo || t.inReplyToId || t.isReply)) // exclude replies
        setTweets(filtered)

        // Counts
        try {
          const [rf, rng] = await Promise.allSettled([
            UserApi.followers(myUsername),
            UserApi.following(myUsername)
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
  }, [])

  if (loading) return <Loader />
  if (error) return <ErrorMessage error={error} />
  if (!me) return <Empty>Profile not found.</Empty>

  const name = me.name || me.displayName || me.username || me.handle || me.email || 'User'
  const userId = me.id || me._id
  const username = (me.username || me.handle || '').toLowerCase()
  const avatar = me.avatar || me.avatarUrl || me.photoURL || ''

  return (
    <div>
      <div className="card profile-header">
        <Avatar size={64} src={avatar} alt={name} />
        <div className="profile-header__info">
          <div className="profile-header__name">{name}</div>
          <div className="muted">@{username} · #{String(userId || '').slice(-6)}</div>
          <div className="profile-header__actions">
            <Link className="button small" to={`/followers?username=${encodeURIComponent(username)}`}>
              Followers{typeof followersCount === 'number' ? ` (${followersCount})` : ''}
            </Link>
            <Link className="button small" to={`/following?username=${encodeURIComponent(username)}`}>
              Following{typeof followingCount === 'number' ? ` (${followingCount})` : ''}
            </Link>
          </div>
        </div>
      </div>

      {tweets.length === 0 ? <Empty>No posts yet.</Empty> : tweets.map((t, i) => {
        const k = t.id || t._id || `${t.createdAt || t.date || ''}-${i}`
        return <TweetCard key={String(k)} tweet={t} />
      })}
    </div>
  )
}