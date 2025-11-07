import React, { useCallback, useEffect, useState, useRef } from 'react'
import TweetCard from '../components/TweetCard'
import Loader from '../components/Loader'
import Empty from '../components/Empty'
import ErrorMessage from '../components/ErrorMessage'
import * as Api from '../services/api'
import { parseListResponse } from '../utils/normalize'

// resolve backend API base from Vite env or fallback to localhost backend
let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
if (!/^https?:\/\//i.test(API_URL)) {
  // eslint-disable-next-line no-console
  console.warn('[Home] VITE_API_URL invalid or missing protocol, falling back ->', API_URL)
  API_URL = 'http://localhost:4000/api'
}
// eslint-disable-next-line no-console
console.log('[Home] using API_URL =', API_URL)

export default function Home() {
  const PAGE_LIMIT = 10

  const [items, setItems] = useState([])
  const itemsRef = useRef(items)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'following'

  // deterministic followings/current user ids for robust filtering (web)
  const [followingIds, setFollowingIds] = useState(new Set())
  const [currentUserId, setCurrentUserId] = useState(null)

  // helpers: extract author id/handle from tweet shapes
  const getAuthorId = (t) =>
    (t.author && (t.author.id || t.author._id)) ||
    (t.user && (t.user.id || t.user._id)) ||
    (t.fromUser && (t.fromUser.id || t.fromUser._id)) ||
    t.creatorId ||
    t.ownerId ||
    t.userId ||
    t.user_id ||
    null

  const getAuthorHandle = (t) =>
    (t.author && (t.author.username || t.author.handle || t.author.userName)) ||
    (t.user && (t.user.username || t.user.handle || t.user.userName)) ||
    (t.fromUser && (t.fromUser.username || t.fromUser.handle || t.fromUser.userName)) ||
    t.username ||
    t.handle ||
    null

  // normalize ids/handles (strip leading @, lower-case)
  const normalizeKey = (v) => {
    if (v == null) return null
    return String(v).toLowerCase().replace(/^@/, '')
  }

  // Authentication helpers (mirror mobile behavior)
  const getStoredToken = () => {
    const tokenKeys = ['token','accessToken','authToken','idToken','jwt','auth','authorization','idtoken']
    let token = tokenKeys.map(k => localStorage.getItem(k)).find(Boolean)
    if (!token) {
      const objKeys = ['user','me','profile','currentUser','auth']
      for (const k of objKeys) {
        const raw = localStorage.getItem(k)
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw)
          token = parsed?.token || parsed?.idToken || parsed?.accessToken || parsed?.authToken || parsed?.jwt || parsed?.authorization
          if (token) break
        } catch (e) { /* not JSON */ }
      }
    }
    if (!token) return null
    token = String(token)
    if (token.startsWith('Bearer ')) token = token.slice(7)
    return token
  }

  const getAuthHeaders = () => {
    const token = getStoredToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const decodeJwt = (token) => {
    try {
      if (!token) return null
      const parts = token.split('.')
      if (parts.length < 2) return null
      let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      while (payload.length % 4) payload += '='
      const json = atob(payload)
      return JSON.parse(json)
    } catch (e) {
      return null
    }
  }

  const findMeInLocalStorage = () => {
    const prefer = ['me','user','profile','currentUser','auth','persist:root']
    const keys = Array.from(new Set([...prefer, ...Array.from({ length: localStorage.length }).map((_,i) => localStorage.key(i))]))
    for (const k of keys) {
      if (!k) continue
      const raw = localStorage.getItem(k)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw)
        const maybe = parsed?.user || parsed?.profile || parsed?.me || parsed
        if (!maybe) continue
        const hasId = maybe.id || maybe._id || maybe.userId || maybe.uid
        const hasName = maybe.username || maybe.handle || maybe.email
        if (hasId || hasName) return maybe
        if (parsed?.data && (parsed.data.id || parsed.data.username)) return parsed.data
      } catch (e) {
        const s = String(raw).trim()
        if (s && /^[0-9a-zA-Z-_@.]+$/.test(s)) return { id: s }
      }
    }
    return null
  }

  const getTweetTimestamp = (t) => {
    if (!t) return 0
    const v =
      t.createdAt ||
      t.created_at ||
      t.ts ||
      t.timestamp ||
      t.time ||
      t.date ||
      t._createdAt ||
      t._ts ||
      null
    if (!v) return 0
    if (typeof v === 'number') return v
    const n = Number(v)
    if (Number.isFinite(n)) return n
    const parsed = Date.parse(String(v))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const isFromFollowed = (t, usedFollowingIds = followingIds, usedCurrentUserId = currentUserId) => {
    const authorId = getAuthorId(t)
    if (authorId) {
      const sId = normalizeKey(authorId)
      if (usedCurrentUserId && sId === normalizeKey(usedCurrentUserId)) return true
      if (usedFollowingIds && typeof usedFollowingIds.has === 'function' && usedFollowingIds.has(sId)) return true
    }

    const authorHandle = normalizeKey(getAuthorHandle(t) || '')
    if (authorHandle && usedFollowingIds && typeof usedFollowingIds.has === 'function' && usedFollowingIds.has(authorHandle)) return true

    return Boolean(
      t.isMine ||
      t.mine ||
      t.ownedByCurrentUser ||
      t.isFollowing ||
      t.is_following ||
      t.author?.isFollowed ||
      t.author?.is_followed ||
      t.author?.isFollowing ||
      t.author?.is_following ||
      t.author?.followedByCurrentUser ||
      t.author?.followed_by_current_user ||
      t.author?.followed ||
      t.author?.following ||
      t.user?.isFollowed ||
      t.user?.is_followed ||
      t.user?.isFollowing ||
      t.fromUser?.isFollowed ||
      t.fromUser?.is_followed ||
      t.fromUser?.isFollowing ||
      t.viewerIsFollowing ||
      t.viewer_is_following
    )
  }

  // core loader: fetch tweets and apply client-side following filter if requested
  const loadPage = useCallback(async (pageNum = 1, localFollowingIds = null, localMeId = null) => {
    setLoading(true)
    setError(null)
    try {
      // If filter is following and we have no ids, avoid fetching full timeline unnecessarily
      if (filter === 'following' && (!localFollowingIds || localFollowingIds.size === 0)) {
        setItems([])
        setHasMore(false)
        setLoading(false)
        return
      }

      const qBase = new URLSearchParams()
      qBase.set('limit', String(PAGE_LIMIT))
      // request ordering newest first
      qBase.set('sort', '-createdAt')

      const toArray = (val) => {
        if (!val) return []
        if (Array.isArray(val)) return val
        if (Array.isArray(val.items)) return val.items
        if (Array.isArray(val.data)) return val.data
        if (Array.isArray(val.results)) return val.results
        return []
      }

      const headers = getAuthHeaders()

      // Helper to fetch one server page and return parsed array + serverHasMore flag
      const fetchServerPage = async (serverPage) => {
        const q = new URLSearchParams(qBase)
        q.set('page', String(serverPage))
        const r = await fetch(`${API_URL}/tweets?${q.toString()}`, { headers })
        if (!r.ok) return { arr: null, serverHasMore: false, status: r.status }
        const json = await r.json()
        const maybeList = parseListResponse(json) || json?.items || json || []
        const arr = toArray(maybeList)
        const serverHasMore = arr.length >= PAGE_LIMIT
        return { arr, serverHasMore, status: 200 }
      }

      // If not following filter, single fetch path (simple)
      if (filter !== 'following') {
        const { arr, serverHasMore, status } = await fetchServerPage(pageNum)
        if (arr === null) {
          // fallback to Api service if available
          if (Api.getTweets) {
            const res = await Api.getTweets({ page: pageNum, limit: PAGE_LIMIT })
            const data = res?.data ?? res
            const maybeList = parseListResponse(data) || data?.items || data || []
            const listArr = toArray(maybeList)
            const pageSlice = listArr.slice(0, PAGE_LIMIT)
            setItems(prev => (pageNum === 1 ? pageSlice : [...prev, ...pageSlice]))
-            setHasMore((listArr.length || 0) === PAGE_LIMIT)
+            setHasMore((listArr.length || 0) >= PAGE_LIMIT)
            setPage(pageNum)
            return
          }
          throw new Error(`Fetch failed: ${status}`)
        }
        // ensure we append at most PAGE_LIMIT items even if server returned more
        const pageSlice = arr.slice(0, PAGE_LIMIT)
        setItems(prev => (pageNum === 1 ? pageSlice : [...prev, ...pageSlice]))
-        setHasMore((arr.length || 0) === PAGE_LIMIT)
+        setHasMore(serverHasMore)
        setPage(pageNum)
        return
      }

      // FOLLOWING FILTER: fetch server pages until we collect PAGE_LIMIT matching tweets
      // or run out of server pages. This avoids tiny increments and duplicate/misleading "hasMore".
      const collected = []
      const seen = new Set()
      // register existing items to avoid duplicates when appending (use ref to avoid dependency loop)
      const existingItems = itemsRef.current || []
      for (const it of existingItems) {
        const id = normalizeKey(it?.id || it?._id || it?.userId || it?.username || it?.handle)
        if (id) seen.add(id)
      }

      let serverPage = pageNum
      let serverHasMore = true
      // safety cap to avoid infinite loops in pathological backends
      const MAX_PAGES_TO_SCAN = 10
      let scanned = 0

      while (collected.length < PAGE_LIMIT && serverHasMore && scanned < MAX_PAGES_TO_SCAN) {
        const { arr, serverHasMore: more, status } = await fetchServerPage(serverPage)
        scanned += 1
        // stop if server errored
        if (arr === null) break
        serverHasMore = more
        // filter by following deterministically
        const filteredThis = arr.filter(t => isFromFollowed(t, localFollowingIds || followingIds, localMeId || currentUserId))
        for (const t of filteredThis) {
          const id = normalizeKey(t?.id || t?._id || t?.userId || t?.username || t?.handle)
          if (!id) continue
          if (seen.has(id)) continue
          seen.add(id)
          collected.push(t)
          if (collected.length >= PAGE_LIMIT) break
        }
        serverPage += 1
        // if server returned less than a full page, no more pages
        if (!serverHasMore) break
      }

      // Append results and set hasMore based on whether server reported more and we didn't hit cap
      setItems(prev => (pageNum === 1 ? collected : [...prev, ...collected]))
      setHasMore(serverHasMore && scanned < MAX_PAGES_TO_SCAN)
      // set page to last server page we attempted - 1 (since serverPage was incremented after last fetch)
      setPage(Math.max(1, serverPage - 1))
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[Home] loadPage error', err)
      setError(err?.message || 'Failed to load tweets')
    } finally {
      setLoading(false)
    }
  }, [filter, followingIds, currentUserId])

  // load followings/current user id when user picks the "following" filter (web)
  useEffect(() => {
    if (filter !== 'following') return
    let mounted = true
    const loadFollowings = async () => {
      try {
        // prefer service helpers which handle auth/session shapes (mirror mobile)
        let me = null
        const helperFns = [
          Api.getMyProfile,
          Api.UserApi?.profile,
          Api.getProfile,
          Api.getCurrentUser,
          Api.me,
          Api.currentUser,
        ].filter(Boolean)
        for (const fn of helperFns) {
          try { const res = await fn(); if (!res) continue; me = res?.data ?? res; break } catch (e) { /*ignore*/ }
        }

        // if still null, attempt fetch to common endpoints (no credentials to avoid CORS issues)
        if (!me) {
          const headers = getAuthHeaders()
          const tryUrls = [`${API_URL}/me`, `${API_URL}/auth/me`, `${API_URL}/users/me`]
          for (const url of tryUrls) {
            try {
              const r = await fetch(url, { headers })
              // eslint-disable-next-line no-console
              console.log('[Home] fetch', url, 'status', r.status)
              if (r.ok) {
                try { me = await r.json(); break } catch (e) { /*ignore*/ }
              } else {
                try { const text = await r.text(); console.log('[Home] fetch body', url, text) } catch(e){/*ignore*/}
              }
            } catch (e) { /* ignore */ }
          }
        }

        // infer from token (JWT) if still missing
        if (!me) {
          const token = getStoredToken()
          if (token) {
            const payload = decodeJwt(token)
            if (payload) {
              me = payload.user || payload.sub || payload.uid || payload.id || payload
            }
          }
        }

        // last resort: scan localStorage for persisted profile
        if (!me) {
          const found = findMeInLocalStorage()
          if (found) me = found
        }

        // debug
        // eslint-disable-next-line no-console
        console.log('[Home] /me result:', me)
        if (!mounted) return
        const meUser = me?.user ?? me?.data?.user ?? me?.data ?? me
        // eslint-disable-next-line no-console
        console.log('[Home] resolved meUser:', meUser)
        const meId = meUser ? (meUser.id || meUser._id || meUser.userId || meUser.uid || null) : null
        if (meUser) setCurrentUserId(meId)

        // fetch followings: try multiple helpers (mirror mobile getFollowing)
        let followList = null
        const followFns = [
          Api.getFollowing,
          Api.getFollowings,
          Api.getMyFollowing,
          Api.getMyFollowings,
          Api.followingFor,
        ]
        if (Api.UserApi?.following) followFns.push((u) => Api.UserApi.following(u))
        for (const fn of followFns) {
          if (!fn) continue
          try {
            const res = await fn(meUser?.username || meId || undefined)
            const val = res?.data ?? res
            if (val) { followList = val; break }
          } catch (e) { /* ignore */ }
        }

        // fallback: try common endpoints directly (no credentials sent, rely on Authorization header token)
        if (!followList) {
          const headers = getAuthHeaders()
          const tryFollowUrls = []
          tryFollowUrls.push(`${API_URL}/me/following`, `${API_URL}/following`, `${API_URL}/follows/following`)
          if (meUser?.username) {
            tryFollowUrls.push(`${API_URL}/users/${encodeURIComponent(String(meUser.username).toLowerCase())}/following`)
            tryFollowUrls.push(`${API_URL}/follows/following?username=${encodeURIComponent(String(meUser.username).toLowerCase())}`)
          }
          if (meId) {
            tryFollowUrls.push(`${API_URL}/users/${encodeURIComponent(String(meId))}/following`)
            tryFollowUrls.push(`${API_URL}/follows/following?userId=${encodeURIComponent(String(meId))}`)
          }
          for (const url of tryFollowUrls) {
            try {
              const r = await fetch(url, { headers })
              // eslint-disable-next-line no-console
              console.log('[Home] fetch', url, 'status', r.status)
              if (r.ok) {
                try { followList = await r.json(); break } catch (e) { /*ignore*/ }
              } else {
                try { const text = await r.text(); console.log('[Home] fetch body', url, text) } catch(e){/*ignore*/}
              }
            } catch (e) { /* ignore */ }
          }
        }

        // final fallback: check localStorage for cached follow lists (mobile persists sometimes)
        if (!followList) {
          const lsKeys = ['following','followings','followingIds','followed','followedIds','followList','followings_list']
          for (const k of lsKeys) {
            const raw = localStorage.getItem(k)
            if (!raw) continue
            try {
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed)) { followList = parsed; break }
              if (parsed?.items) { followList = parsed; break }
              if (parsed?.data && Array.isArray(parsed.data)) { followList = parsed.data; break }
            } catch (e) {
              const parts = String(raw).split?.(',').map(s => s.trim()).filter(Boolean)
              if (parts && parts.length) { followList = parts; break }
            }
          }
        }

        if (!mounted) return
        const arr = Array.isArray(followList) ? followList : followList?.items || followList?.results || followList?.data || []
        // eslint-disable-next-line no-console
        console.log('[Home] followList raw:', followList, 'normalized count:', arr.length)

        const extractId = (u) => {
          if (!u) return null
          if (typeof u === 'string' || typeof u === 'number') return normalizeKey(u)
          const cand =
            u.id || u._id || u.userId || u.accountId ||
            u.user?.id || u.user?._id || u.user?.userId ||
            u.following?.id || u.following?._id ||
            u.to?.id || u.to?._id ||
            u.followed?.id || u.followed?._id ||
            u.username || u.handle
          return cand ? normalizeKey(cand) : null
        }
        const ids = new Set(arr.map(extractId).filter(Boolean))
        if (meId) ids.add(normalizeKey(meId))
        setFollowingIds(ids)

        // load first page using local ids to avoid race
        await loadPage(1, ids, meId)
      } catch (err) {
        console.warn('[Home] loadFollowings failed', err)
        setFollowingIds(new Set())
        loadPage(1).catch(() => {})
      }
    }
    loadFollowings()
    return () => { mounted = false }
  }, [filter])

  // initial load & reload when filter changes
  useEffect(() => {
    loadPage(1, followingIds, currentUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const onLoadMore = async () => {
    if (!hasMore || loading) return
    const next = page + 1
    await loadPage(next, followingIds, currentUserId)
  }

  // keep ref in sync without triggering loadPage re-creation
  useEffect(() => { itemsRef.current = items }, [items])

  // rendering
  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '8px 12px',
            borderRadius: 20,
            backgroundColor: filter === 'all' ? '#6A1B9A' : 'transparent',
            color: filter === 'all' ? '#fff' : '#333',
            border: '1px solid #ddd'
          }}
        >
          All
        </button>
        <button
          onClick={() => setFilter('following')}
          style={{
            padding: '8px 12px',
            borderRadius: 20,
            backgroundColor: filter === 'following' ? '#6A1B9A' : 'transparent',
            color: filter === 'following' ? '#fff' : '#333',
            border: '1px solid #ddd'
          }}
        >
          Following
        </button>
      </div>

      {error && <ErrorMessage error={error} />}

      {items.length === 0 && !loading && !error ? (
        <Empty message={filter === 'following' ? 'No tweets from people you follow' : 'No tweets yet'} />
      ) : (
        items.map((t) => <TweetCard key={t.id || t._id || getTweetTimestamp(t) || Math.random()} tweet={t} />)
      )}

      {loading && <Loader />}

      {!loading && hasMore && items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button
            onClick={onLoadMore}
            disabled={loading || !hasMore}
            aria-disabled={loading || !hasMore}
            style={{
              padding: '10px 16px',
              borderRadius: 20,
              backgroundColor: '#6A1B9A',
              color: '#fff',
              border: 'none',
              cursor: loading || !hasMore ? 'not-allowed' : 'pointer',
              opacity: loading || !hasMore ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {loading ? (
              // simple text spinner fallback
              <span>Loading…</span>
            ) : (
              <span>
                {filter === 'following' ? `Load more (${PAGE_LIMIT}) — following` : `Load ${PAGE_LIMIT} more`}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}