// filepath: d:\dev\x-clone\web copy\src\pages\PublicProfile.jsx
import React, { useEffect, useState, useCallback } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Avatar from '../components/Avatar'
import FollowButton from '../components/FollowButton'
import TweetCard from '../components/TweetCard'
import { UserApi, TweetsApi } from '../services/api'
import Loader from '../components/Loader'
import Empty from '../components/Empty'
import ErrorMessage from '../components/ErrorMessage'
import { parseListResponse } from '../utils/normalize'
import { extractTotalFromListResponse } from '../services/api'

export default function PublicProfile() {
  const { username: paramUsername } = useParams()
  const { user: me } = useAuth()
  const meUsername = (me?.username || me?.handle || (me?.email ? me.email.split('@')[0] : '')).toLowerCase()
  const targetUsername = (paramUsername || '').toLowerCase()
  const isMe = !!meUsername && meUsername === targetUsername

  const qs = new URLSearchParams(useLocation().search)
  const qId = qs.get('id') || ''

  const [profile, setProfile] = useState(null)

  // pagination for tweets
  const PAGE_LIMIT = 10
  const [tweets, setTweets] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingTweets, setLoadingTweets] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const [followersCount, setFollowersCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        let prof = null

        if (paramUsername) {
          try {
            const r = await UserApi.byUsername(paramUsername)
            prof = r?.data?.user ?? r?.data ?? null
            if (Array.isArray(prof)) prof = prof[0] || null
          } catch (err) {
            prof = null
          }
        }

        if (!prof && qId) {
          try {
            const r = await UserApi.byId(qId)
            prof = r?.data?.user ?? r?.data ?? null
            if (Array.isArray(prof)) prof = prof[0] || null
          } catch (err) {
            prof = null
          }
        }

        // last attempt (permissive)
        if (!prof && paramUsername) {
          try {
            const r = await UserApi.byUsername(paramUsername)
            prof = r?.data?.user ?? r?.data ?? null
            if (Array.isArray(prof)) prof = prof[0] || null
          } catch (err) {
            prof = null
          }
        }

        if (!mounted) return

        if (!prof) {
          throw new Error('User not found')
        }

        setProfile(prof)

        // counts (prefer values embedded in profile)
        const pFollowers = prof?.followersCount ?? prof?.followers ?? prof?.followers_count ?? prof?.followerCount ?? null
        const pFollowing = prof?.followingCount ?? prof?.following ?? prof?.following_count ?? null
        if (pFollowers !== null) setFollowersCount(Number(pFollowers))
        if (pFollowing !== null) setFollowingCount(Number(pFollowing))

        // if not present, try to fetch from followers/following endpoints and extract totals
        const needFollowers = pFollowers === null
        const needFollowing = pFollowing === null

        if (needFollowers || needFollowing) {
          try {
            const [fSett, fgSett] = await Promise.allSettled([
              needFollowers ? UserApi.followers(targetUsername, { page: 1, limit: 1 }) : Promise.resolve({ data: { items: [], total: pFollowers }, headers: {} }),
              needFollowing ? UserApi.following(targetUsername, { page: 1, limit: 1 }) : Promise.resolve({ data: { items: [], total: pFollowing }, headers: {} })
            ])
            const fCount = extractTotalFromListResponse(fSett.status === 'fulfilled' ? fSett.value : null)
            const fgCount = extractTotalFromListResponse(fgSett.status === 'fulfilled' ? fgSett.value : null)
            if (fCount !== null) setFollowersCount(fCount)
            if (fgCount !== null) setFollowingCount(fgCount)
          } catch {}
        }

        // initial tweets load (reset pagination)
        setPage(1)
        setTweets([])
        setHasMore(true)
        try {
          await loadTweets(1, mounted)
        } catch {}
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || e?.message || 'Failed to load profile')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [paramUsername, qId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadTweets = useCallback(async (p = 1, mountedFlag = true) => {
    if (!targetUsername) return
    setLoadingTweets(true)
    try {
      const { data } = await TweetsApi.byUsername(targetUsername, { page: p, limit: PAGE_LIMIT * 2 })
      const { items: rows = [], nextCursor } = parseListResponse(data)

      // keep only top-level tweets (exclude replies/comments)
      const topLevel = (rows || []).filter(t =>
        !(t.parentId || t.parent || t.replyTo || t.inReplyToId || t.isReply)
      )

      const pageItems = topLevel.slice(0, PAGE_LIMIT)
      setTweets(prev => (p === 1 ? pageItems : [...prev, ...pageItems]))

      if (nextCursor) {
        setHasMore(true)
      } else {
        setHasMore(topLevel.length > PAGE_LIMIT || (rows || []).length >= PAGE_LIMIT)
      }
    } catch (e) {
      // non-fatal for tweets; surface only if no profile error
      console.debug('Failed to load tweets', e)
    } finally {
      if (mountedFlag) setLoadingTweets(false)
    }
  }, [targetUsername])

  const handleLoadMore = async () => {
    if (loadingTweets || !hasMore) return
    const next = page + 1
    await loadTweets(next)
    setPage(next)
  }

  if (loading) return <Loader />
  if (error) return <ErrorMessage error={error} />
  if (!profile) return <Empty>User not found</Empty>

  // safe to derive display values now (after profile exists)
  const name = profile.name || profile.displayName || profile.username || profile.handle || 'User'
  const targetId = profile.id || profile._id || qId
  const avatar = profile.avatar || profile.avatarUrl || profile.photoURL || ''

  function onFollowToggle(next) {
    // keep local counts in sync when FollowButton toggles
    if (typeof followersCount === 'number' && next === 'followed') setFollowersCount(followersCount + 1)
    if (typeof followersCount === 'number' && next === 'unfollowed') setFollowersCount(Math.max(0, followersCount - 1))
  }

  return (
    <div>
      <div className="card profile-header">
        <Avatar size={64} src={avatar} alt={name} />
        <div className="profile-header__info">
          <div className="profile-header__name">{name}</div>
          <div className="muted">@{targetUsername} · #{String(targetId || '').slice(-6)}</div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <Link className="button small" to={`/followers?username=${encodeURIComponent(targetUsername)}`}>
              Followers{typeof followersCount === 'number' ? ` (${followersCount})` : ''}
            </Link>

            <Link className="button small" to={`/following?username=${encodeURIComponent(targetUsername)}`}>
              Following{typeof followingCount === 'number' ? ` (${followingCount})` : ''}
            </Link>

            <div style={{ marginLeft: 'auto' }}>
              {!isMe && (
                <FollowButton targetUsername={targetUsername} size="small" onChange={onFollowToggle} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {tweets.map((t, i) => <TweetCard key={t._id || t.id || i} tweet={t} />)}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          {hasMore ? (
            <button onClick={handleLoadMore} className="button" disabled={loadingTweets}>
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