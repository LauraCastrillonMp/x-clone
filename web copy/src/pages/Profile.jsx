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

// pagination
const PAGE_LIMIT = 10

// add helper to reliably extract total from various list response shapes
const extractTotalFromListResponse = (resp) => {
  if (!resp) return null
  const data = resp?.data ?? resp
  if (!data) return null

  // common JSON shapes
  if (typeof data.total === 'number' && Number.isFinite(data.total)) return data.total
  if (typeof data.total === 'string' && !Number.isNaN(Number(data.total))) return Number(data.total)
  if (data?.meta?.total != null && !Number.isNaN(Number(data.meta.total))) return Number(data.meta.total)
  if (data?.pagination?.total != null && !Number.isNaN(Number(data.pagination.total))) return Number(data.pagination.total)
  if (typeof data.count === 'number') return data.count

  // common headers (axios style)
  const headers = resp?.headers ?? {}
  const headerTotal = headers['x-total-count'] || headers['x-total'] || headers['x-pagination-count'] || headers['X-Total-Count']
  if (headerTotal != null && !Number.isNaN(Number(headerTotal))) return Number(headerTotal)

  return null
}

export default function Profile() {
  const [me, setMe] = useState(null)
  const [tweets, setTweets] = useState([])
  const [page, setPage] = useState(1)
  const [loadingTweets, setLoadingTweets] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // load paginated tweets (keeps exactly PAGE_LIMIT items per page after filtering replies)
  async function loadTweets(p = 1, username, userId) {
    if (!username && !userId) return
    setLoadingTweets(true)
    try {
      // prefer username timeline, fallback to user id / list endpoint
      let res = null
      if (username) {
        try { res = await TweetsApi.byUsername(username, { page: p, limit: PAGE_LIMIT * 2 }) } catch (e) { res = null }
      }
      if (!res && userId) {
        try { res = await TweetsApi.byUserId(userId, { page: p, limit: PAGE_LIMIT * 2 }) } catch (e) { res = null }
      }
      if (!res && userId) {
        try { res = await TweetsApi.list({ authorId: userId, userId, page: p, limit: PAGE_LIMIT * 2 }) } catch (e) { res = null }
      }

      const raw = res?.data ?? res ?? []
      const { items: rows = [], nextCursor } = parseListResponse(raw)

      // exclude replies/comments so we display only top-level posts
      const topLevel = (rows || []).filter(t => !(t.parent || t.parentId || t.replyTo || t.inReplyToId || t.isReply))
      const pageItems = topLevel.slice(0, PAGE_LIMIT)

      setTweets(prev => (p === 1 ? pageItems : [...prev, ...pageItems]))

      // determine hasMore: trust cursor, otherwise if server returned >= PAGE_LIMIT assume more
      if (nextCursor) {
        setHasMore(true)
      } else {
        setHasMore((rows || []).length >= PAGE_LIMIT || topLevel.length > PAGE_LIMIT)
      }
    } catch (e) {
      console.debug('Failed to load tweets', e)
    } finally {
      setLoadingTweets(false)
    }
  }

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

        // initial tweets load (paginated)
        setPage(1)
        setTweets([])
        setHasMore(true)
        try {
          await loadTweets(1, myUsername, myId)
        } catch (e) {}
        // end tweets

        // Counts
        try {
          // request small page but read total from response metadata/headers
          const [rf, rng] = await Promise.allSettled([
            UserApi.followers(myUsername, { page: 1, limit: 1 }),
            UserApi.following(myUsername, { page: 1, limit: 1 })
          ])
          const fCount = extractTotalFromListResponse(rf.status === 'fulfilled' ? rf.value : null)
          const fgCount = extractTotalFromListResponse(rng.status === 'fulfilled' ? rng.value : null)
          if (fCount !== null) setFollowersCount(fCount)
          if (fgCount !== null) setFollowingCount(fgCount)
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

      <div style={{ marginTop: 12 }}>
        {tweets.length === 0 ? <Empty>No posts yet.</Empty> : tweets.map((t, i) => {
          const k = t.id || t._id || `${t.createdAt || t.date || ''}-${i}`
          return <TweetCard key={String(k)} tweet={t} />
        })}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          {hasMore ? (
            <button onClick={async () => {
              if (loadingTweets) return
              const next = page + 1
              await loadTweets(next, (me?.username || me?.handle || '').toLowerCase(), me?.id || me?._id)
              setPage(next)
            }} className="button" disabled={loadingTweets}>
              {loadingTweets ? 'Loading…' : 'See more'}
            </button>
          ) : (
            <div style={{ color: '#666', padding: '8px 0' }}>No more posts</div>
          )}
        </div>
      </div>
    </div>
  )
}