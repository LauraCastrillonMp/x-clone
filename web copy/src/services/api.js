import axios from 'axios';
import { getAuth, onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { auth as appAuth } from './firebase';

// Use the same auth instance everywhere
const auth = appAuth || getAuth();

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  timeout: 15000,
});

// Interceptor para añadir el token a cada petición
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token'); // Cambia esto si usas otro método para guardar el token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Cache + refresh Firebase ID token
let cachedToken = null;
let refreshing = null;

// Keep axios Authorization in sync whenever the ID token changes
onIdTokenChanged(auth, async (u) => {
  try {
    if (u) {
      const t = await u.getIdToken();
      cachedToken = t;
      api.defaults.headers.common = api.defaults.headers.common || {};
      api.defaults.headers.common.Authorization = `Bearer ${t}`;
    } else {
      cachedToken = null;
      if (api.defaults.headers.common?.Authorization) {
        delete api.defaults.headers.common.Authorization;
      }
    }
  } catch {
    // ignore
  }
});

// Reset cache on auth changes
onAuthStateChanged(auth, () => { cachedToken = null });

async function getToken(force = false) {
  try {
    const u = auth.currentUser;
    if (!u) { cachedToken = null; return null }
    if (force || !cachedToken) cachedToken = await u.getIdToken(force);
    return cachedToken;
  } catch {
    return null;
  }
}

api.interceptors.request.use(async (config) => {
  const token = cachedToken || (await (refreshing || getToken(false)));
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;
    if (status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        refreshing = getToken(true);
        const fresh = await refreshing;
        refreshing = null;
        if (fresh) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${fresh}`;
          return api(original);
        }
      } catch {}
    }
    return Promise.reject(error);
  }
);

// Helper APIs (named exports)
export const TweetsApi = {
  list: (params = {}) => api.get('/tweets', { params: { ...params, excludeReplies: 1 } }),
  byUserId: (userId, params = {}) => api.get('/tweets', { params: { ...(params || {}), userId } }),
  byUsername: (username, params = {}) =>
    api.get(`/tweets/user/${encodeURIComponent(String(username).toLowerCase())}`, { params }),

  byUser: (user, params = {}) => {
    const raw = typeof user === 'object'
      ? (user.username || user.handle || user.id || user._id || '')
      : String(user || '')
    const s = String(raw)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(s)
    if (isObjectId) {
      return api.get('/tweets', {
        params: { ...params, authorId: s, userId: s, excludeReplies: 1 },
      })
    }
    return api.get(`/tweets/user/${encodeURIComponent(s.toLowerCase())}`, { params: { ...params } })
  },

  get: async (id) => {
    const tries = [
      { method: 'get', url: `/tweets/${id}` },
      { method: 'get', url: `/tweet/${id}` },
    ]
    let last
    for (const t of tries) { try { return await api.request(t) } catch (e) { last = e } }
    throw last
  },
  toggleLike: (id) => api.post('/likes/toggle', { tweetId: String(id) }),
  replies: async (id, params = {}) => {
    const pid = String(id)
    const tries = [
      { method: 'get', url: `/tweets/${pid}/comments`, params },
      { method: 'get', url: `/tweets`, params: { ...params, parentId: pid } },
    ]
    for (const t of tries) { try { return await api.request(t) } catch {} }
    return api.get(`/tweets/${pid}/comments`, { params })
  },
  reply: async (id, text) => {
    const pid = String(id)
    const tries = [
      { method: 'post', url: `/tweets/${pid}/comments`, data: { text } },
      { method: 'post', url: `/tweets`, data: { text, parent: pid } },
    ]
    for (const t of tries) { try { return await api.request(t) } catch {} }
    return api.post(`/tweets/${pid}/comments`, { text })
  },
  create: (data) => api.post('/tweets', data),
}

export const UserApi = {
  profile: () => api.get('/users/me'),
  byUsername: (username) => {
    const u = String(username || '').toLowerCase().trim()
    if (!u) return Promise.reject(new Error('username required'))
    // try several paths (most backends expose one of these)
    const enc = encodeURIComponent(u)
    const paths = [
      `/users/${enc}`,              // /users/:username
      `/users/${enc}/profile`,      // /users/:username/profile
      `/user/${enc}`,               // /user/:username
      '/users',                     // /users?username=...
      '/users/search'               // /users/search?q=...
    ]
    // tryFirst will call api.get(path, { params }) so pass both username and q
    return tryFirst(paths, { username: u, q: u })
  },

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

export const NotificationsApi = { list: () => api.get('/notifications') }

export const SearchApi = {
  async searchTweets(q, cursor) {
    const params = { q, query: q, search: q, cursor, limit: 20 }
    return tryFirst(['/tweets/search', '/tweets'], params)
  },
  async searchUsers(q, cursor) {
    const params = { q, query: q, search: q, cursor, limit: 20 }
    return tryFirst(['/users/search', '/users'], params)
  },
}

async function tryFirst(paths, params) {
  let lastErr
  for (const p of paths) {
    try {
      const r = await api.get(p, { params })
      if (r?.status >= 200 && r?.status < 300) return r
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('No endpoint matched')
}

export const LikesApi = { toggle: (tweetId) => api.post('/likes/toggle', { tweetId }) }

// replaced/added: Cloudinary helpers + postTweet (web aligned with mobile implementation)
export function getMediaUrl(val) {
  if (!val) return null;
  if (typeof val !== 'string') val = val.url || val.public_id || '';
  if (!val) return null;
  if (val.startsWith('http')) return val;
  const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(val) || val.includes('/video/');
  const type = isVideo ? 'video' : 'image';
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
  if (!cloud) return val;
  return `https://res.cloudinary.com/${cloud}/${type}/upload/${val}`;
}

async function getCloudinarySignature({ folder } = {}) {
  // use axios instance so auth headers are included
  const res = await api.post('/media/cloudinary-signature', { folder });
  if (!res || (res.status < 200 || res.status >= 300)) {
    const txt = (res && res.data) ? JSON.stringify(res.data) : `status ${res?.status}`;
    throw new Error(`signature ${txt}`);
  }
  return res.data; // { signature, timestamp, apiKey, folder, publicId?, cloudName? }
}

export async function uploadToCloudinary(fileOrUri, options = {}) {
  // web expects a File object
  const cloud = options.cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  if (!cloud || cloud === 'YOUR_CLOUD_NAME') throw new Error('Cloudinary cloud name not configured');

  const form = new FormData();

  // Accept File (browser) or object with uri (compat), but Compose uses File
  if (fileOrUri instanceof File) {
    form.append('file', fileOrUri, fileOrUri.name || `upload_${Date.now()}`);
  } else if (typeof fileOrUri === 'string') {
    // If caller passed a remote/local URI string (rare on web), attempt to fetch it
    // and convert to Blob
    const resp = await fetch(fileOrUri);
    const blob = await resp.blob();
    form.append('file', blob, `upload_${Date.now()}`);
  } else if (fileOrUri && fileOrUri.uri) {
    // compatibility shape
    const resp = await fetch(fileOrUri.uri);
    const blob = await resp.blob();
    form.append('file', blob, fileOrUri.name || `upload_${Date.now()}`);
  } else {
    throw new Error('uploadToCloudinary expects a File or URI');
  }

  const preset = options.uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || null;
  const endpoint = `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`;

  if (preset) {
    // unsigned
    form.append('upload_preset', preset);
  } else {
    // signed -> ask backend for signature (backend should include apiKey, timestamp, signature, optional publicId)
    const folder = options.folder || 'tweets';
    const sig = await getCloudinarySignature({ folder });
    form.append('api_key', sig.apiKey || sig.api_key || '');
    form.append('timestamp', String(sig.timestamp));
    form.append('signature', sig.signature);
    form.append('folder', folder);
    if (sig.publicId) form.append('public_id', sig.publicId);
  }

  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Cloudinary upload failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function postTweet(payload) {
  const MAX_TWEET_CHARS = 280;
  const clean = String(payload?.text || '').trim();
  if (!clean || clean.length > MAX_TWEET_CHARS) {
    throw new Error(`Tweet must be 1–${MAX_TWEET_CHARS} characters`);
  }
  const body = { text: clean, media: Array.isArray(payload?.media) ? payload.media : [] };
  const res = await api.post('/tweets', body);
  return res.data;
}

/**
 * Extract a numeric total count from a list/paginated response.
 * Works with common shapes: { total }, { count }, { meta: { total } }, arrays,
 * or X-Total-Count / X-Total headers.
 */
export function extractTotalFromListResponse(res) {
  if (!res) return null
  const d = res.data ?? res
  const tryNum = v => {
    if (v === undefined || v === null) return NaN
    if (typeof v === 'number') return v
    const n = Number(v)
    return Number.isNaN(n) ? NaN : n
  }

  const candidates = [
    d?.total,
    d?.count,
    d?.totalCount,
    d?.total_items,
    d?.meta?.total,
    d?.meta?.count,
    d?.meta?.totalCount,
    d?.pagination?.total,
    d?.pagination?.count,
    Array.isArray(d?.items) ? d.items.length : null,
    Array.isArray(d?.results) ? d.results.length : null,
    Array.isArray(d?.users) ? d.users.length : null,
    Array.isArray(d) ? d.length : null,
    // headers
    res?.headers && (res.headers['x-total-count'] ?? res.headers['x-total']),
  ]

  for (const c of candidates) {
    const n = tryNum(c)
    if (!Number.isNaN(n)) return n
  }
  return null
}

// createProfile: ask backend to create/sync a user record (expects Firebase ID token)
export async function createProfile({ idToken, fullName, username }) {
  try {
    // use axios instance so baseURL and auth interceptors are applied
    const res = await api.post('/auth/createProfile', {
      fullName,
      username,
      idToken, // backend may not need idToken if Authorization header is set, but include for compatibility
    }, {
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
    });
    return res.data;
  } catch (err) {
    // surface useful message for debugging
    const msg = err?.response?.data || err?.message || String(err);
    throw new Error(`createProfile failed: ${JSON.stringify(msg)}`);
  }
}

export default api
