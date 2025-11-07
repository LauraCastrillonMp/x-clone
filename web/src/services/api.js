// filepath: d:\dev\orbyt\web\src\services\api.js
import axios from 'axios'
import { auth } from './firebase'

const baseURL = 'http://localhost:4000/api'
export const api = axios.create({ baseURL, timeout: 15000 })

// add explicit env var fallback for cloud name
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || null

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
  let lastErr = null;

  for (const p of paths) {
    try {
      const candidates = [];

      // absolute URLs first
      if (/^https?:\/\//.test(p)) {
        candidates.push(p);
      } else {
        const clean = p.startsWith('/') ? p : `/${p}`;
        candidates.push(clean);
        // also try with /api prefix (common mismatch)
        if (!clean.startsWith('/api/')) candidates.push(`/api${clean}`);
      }

      for (const url of candidates) {
        try {
          // use configured axios instance (api) which already has baseURL
          const res = await api.get(url, { params });
          return res.data;
        } catch (e) {
          // if candidate was absolute, also try global axios in case api.baseURL interferes
          if (/^https?:\/\//.test(url)) {
            try {
              const absRes = await axios.get(url, { params });
              return absRes.data;
            } catch (_) {
              // fallthrough to try next candidate
            }
          }
          // otherwise continue to next candidate
        }
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('No search endpoint matched');
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';
console.log('[web] API_BASE =', API_BASE); // debug — remove after verifying

// replace manual fetch with axios so requests go to the same backend as the other api calls
export async function getCloudinarySignature(folder = 'tweets') {
  // use the configured axios instance (baseURL = http://localhost:4000/api)
  const res = await api.post('/media/cloudinary-signature', { folder })
  return res.data; // { signature, timestamp, apiKey, folder, cloudName }
}

export async function uploadToCloudinary(file /* File object from <input> */, folder = 'tweets') {
  if (!file) throw new Error('file required for uploadToCloudinary')
  const sig = await getCloudinarySignature(folder)

  // Basic validation of signature response
  if (!sig || !sig.signature || !sig.timestamp || !(sig.apiKey || sig.api_key)) {
    throw new Error('Invalid cloudinary signature response from backend')
  }

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sig.apiKey || sig.api_key)
  form.append('timestamp', String(sig.timestamp))
  form.append('signature', sig.signature)
  form.append('folder', sig.folder || folder)

  const cloudName = sig.cloudName || CLOUDINARY_CLOUD_NAME
  if (!cloudName) {
    throw new Error('Cloudinary cloud name is not set. Set VITE_CLOUDINARY_CLOUD_NAME in web/.env or return cloudName from backend signature.')
  }

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: form,
  })
  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '')
    throw new Error('Cloudinary upload failed: ' + uploadRes.status + ' ' + txt)
  }
  const json = await uploadRes.json()
  // return full response so caller can use secure_url, public_id, etc.
  return json
}