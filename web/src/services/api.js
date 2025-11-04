// filepath: d:\dev\orbyt\web\src\services\api.js
import axios from 'axios'
import { auth } from './firebase'

const baseURL = import.meta.env.VITE_API_URL || '/api'
export const api = axios.create({ baseURL, timeout: 15000 })

// Attach Firebase token
api.interceptors.request.use(async (config) => {
  const u = auth?.currentUser
  if (u?.getIdToken) {
    const t = await u.getIdToken()
    config.headers = { ...(config.headers || {}), Authorization: `Bearer ${t}` }
  }
  return config
})

// Tweets
export const TweetsApi = {
  list: (params = {}) => api.get('/tweets', { params: { ...params, excludeReplies: 1 } }),
  byUser: (userId, params = {}) => api.get('/tweets', { params: { ...(params || {}), userId } }),
  get: async (id) => {
    const tries = [
      { method: 'get', url: `/tweets/${id}` },
      { method: 'get', url: `/tweet/${id}` }
    ]
    let last
    for (const t of tries) { try { return await api.request(t) } catch (e) { last = e } }
    throw last
  },
  like: async (id) => {
    const tries = [
      { method: 'post', url: `/likes/${id}` },
      { method: 'post', url: `/tweets/${id}/like` },
      { method: 'post', url: `/likes`, data: { tweetId: String(id) } }
    ]
    let last
    for (const t of tries) { try { return await api.request(t) } catch (e) { last = e } }
    throw last
  },
  unlike: async (id) => {
    const tries = [
      { method: 'delete', url: `/likes/${id}` },
      { method: 'delete', url: `/tweets/${id}/like` },
      { method: 'post', url: `/likes/unlike`, data: { tweetId: String(id) } }
    ]
    let last
    for (const t of tries) { try { return await api.request(t) } catch (e) { last = e } }
    throw last
  },
  toggleLike: async (id) => {
    const tries = [
      { method: 'post', url: '/likes/toggle', data: { tweetId: String(id) } },
    ]
    let last
    for (const t of tries) { try { return await api.request(t) } catch (e) { last = e } }
    throw last
  },
  // Create a tweet
  create: (data) => api.post('/tweets', data),

  // Get replies to a tweet
  replies: async (id, params = {}) => {
    const pid = String(id)
    const tries = [
      { method: 'get', url: `/tweets/${pid}/comments`, params },
      { method: 'get', url: `/tweets`, params: { ...params, parentId: pid } }
    ]
    for (const t of tries) { try { return await api.request(t) } catch {} }
    return api.get(`/tweets/${pid}/comments`, { params })
  },

  // Create a reply (comment) to a tweet
  reply: async (id, text) => {
    const pid = String(id)
    const tries = [
      { method: 'post', url: `/tweets/${pid}/comments`, data: { text } },
      { method: 'post', url: `/tweets`, data: { text, parent: pid } }
    ]
    for (const t of tries) { try { return await api.request(t) } catch {} }
    return api.post(`/tweets/${pid}/comments`, { text })
  }
}

// Users + Follows (MOBILE-PARITY)
export const UserApi = {
  profile: () => api.get('/users/me'),
  byUsername: (username) => api.get(`/users/${encodeURIComponent(String(username).toLowerCase())}/profile`),

  followers: (username, params = {}) =>
    api.get('/follows/followers', { params: { username: String(username).toLowerCase(), ...params } }),
  following: (username, params = {}) =>
    api.get('/follows/following', { params: { username: String(username).toLowerCase(), ...params } }),

  follow: (targetUsername) =>
    api.post('/follows/follow', { targetUsername: String(targetUsername).toLowerCase() }),
  unfollow: (targetUsername) =>
    api.post('/follows/unfollow', { targetUsername: String(targetUsername).toLowerCase() }),
  followStatus: (targetUsername) =>
    api.get('/follows/status', { params: { targetUsername: String(targetUsername).toLowerCase() } })
}

export const NotificationsApi = {
  list: () => api.get('/notifications')
}

// Flexible search helpers (try common endpoints/params without changing backend)
export const SearchApi = {
  async searchTweets(q, cursor) {
    const params = {
      q,
      query: q,
      search: q,
      cursor,
      limit: 20,
    }
    return tryFirst([
      '/tweets/search',
      '/api/tweets/search',
      '/tweets',
      '/api/tweets',
    ], params)
  },

  async searchUsers(q, cursor) {
    const params = {
      q,
      query: q,
      search: q,
      cursor,
      limit: 20,
    }
    return tryFirst([
      '/users/search',
      '/api/users/search',
      '/users',
      '/api/users',
    ], params)
  },
}

// Reuse the configured axios instance named "api"
async function tryFirst(paths, params) {
  let lastErr
  for (const p of paths) {
    try {
      const r = await api.get(p, { params })
      if (r?.status >= 200 && r?.status < 300) return r
    } catch (e) {
      lastErr = e
      // continue to next path
    }
  }
  throw lastErr || new Error('No search endpoint matched')
}