import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';

// Use 10.0.2.2 on Android emulator; use your PC LAN IP on a real device
const BASE_URL = 'http://10.0.2.2:4000/api'; // emulator
// const BASE_URL = 'http://10.194.71.216:4000/api'; 
const CLOUDINARY_CLOUD_NAME = 'dbewhbfnx'; // from backend .env
const CLOUDINARY_UPLOAD_PRESET = null; // null => use signed uploads via backend

let _manualToken = null;

export function setAuthToken(token) {
  _manualToken = token || null;
  return _manualToken;
}

// Use Firebase ID token saved in AsyncStorage (or _manualToken)
async function getAuthHeader() {
  try {
    if (_manualToken) return { Authorization: `Bearer ${_manualToken}` };

    const stored =
      (await AsyncStorage.getItem('authToken')) ||
      (await AsyncStorage.getItem('idToken')) ||
      (await AsyncStorage.getItem('firebaseIdToken'));

    let token = stored;
    if (!token && auth?.currentUser) {
      token = await auth.currentUser.getIdToken(true);
      if (token) await AsyncStorage.setItem('idToken', token);
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function saveIdToken(token) {
  try {
    if (token) await AsyncStorage.setItem('idToken', token);
  } catch {}
}

async function fetchWithAuth(url, opts = {}) {
  const authHeader = await getAuthHeader();
  const method = (opts.method || 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json',
    ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers || {}),
    ...authHeader,
  };
  return fetch(url, { ...opts, headers });
}

// CLOUDINARY
export function getMediaUrl(val) {
  if (!val) return null;
  if (typeof val !== 'string') val = val.url || val.public_id || '';
  if (val.startsWith('http')) return val;
  const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(val) || val.includes('/video/');
  const type = isVideo ? 'video' : 'image';
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/${type}/upload/${val}`;
}

// Ask your backend for a Cloudinary signature
async function getCloudinarySignature({ folder }) {
  const res = await fetchWithAuth(`${BASE_URL}/media/cloudinary-signature`, {
    method: 'POST',
    body: JSON.stringify({ folder }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`signature ${res.status} ${txt}`);
  }
  return res.json(); // { signature, timestamp, apiKey, folder, publicId? }
}

export async function uploadToCloudinary(fileUri, options = {}) {
  const cloud = options.cloudName || CLOUDINARY_CLOUD_NAME;
  if (!cloud || cloud === 'YOUR_CLOUD_NAME') throw new Error('Cloudinary cloud name not configured');

  const form = new FormData();
  form.append('file', {
    uri: typeof fileUri === 'string' ? fileUri : fileUri.uri,
    type: options.type || 'application/octet-stream',
    name: options.name || `upload_${Date.now()}`,
  });

  const preset = options.uploadPreset || CLOUDINARY_UPLOAD_PRESET;
  let endpoint = `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`;
  if (preset) {
    // Unsigned flow (if you later create a preset)
    form.append('upload_preset', preset);
  } else {
    // Signed flow via backend
    const folder = options.folder || 'tweets';
    const sig = await getCloudinarySignature({ folder });
    form.append('api_key', sig.apiKey);
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

// AUTH / PROFILE
export async function createProfile({ idToken, fullName, username }) {
  const res = await fetch(`${BASE_URL}/auth/createProfile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ idToken, fullName, username }),
  });
  return res.json();
}

async function tryGet(paths) {
  let lastErr = null;
  for (const p of paths) {
    try {
      const res = await fetchWithAuth(`${BASE_URL}${p}`);
      // If server returned HTML (404 page) treat as non-json failure and continue
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) {
        const msg = await res.text().catch(() => '');
        // Stop on auth errors
        if (res.status === 401 || res.status === 403) throw new Error(msg || `Auth ${res.status}`);
        throw new Error(msg || `${p} ${res.status}`);
      }
      // parse JSON (may throw)
      return await res.json();
    } catch (e) {
      lastErr = e;
      // try next path
    }
  }
  throw lastErr;
}

// Robust endpoints (fallbacks)
export async function getMyProfile() {
  const res = await fetchWithAuth(`${BASE_URL}/users/me`);
  if (!res.ok) throw new Error(`users/me ${res.status}`);
  return res.json(); // { user }
}

export async function getProfile(username) {
  const u = encodeURIComponent(String(username || '').toLowerCase());
  const res = await fetchWithAuth(`${BASE_URL}/users/${u}/profile`);
  if (!res.ok) throw new Error(`users/${u}/profile ${res.status}`);
  return res.json(); // { user }
}

export async function getUserTweets(username, page = 1, limit = 10, opts = {}) {
  const u = encodeURIComponent(username);
  const qsPage = `?page=${page}&limit=${limit}`;
  const qsCursor = opts?.beforeId ? `?before=${encodeURIComponent(opts.beforeId)}&limit=${limit}` : qsPage;

  const data = await tryGet([
    `/users/${u}/tweets${qsPage}`,
    `/tweets/user/${u}${qsPage}`,
    `/tweets/by/${u}${qsPage}`,
    `/user/${u}/tweets${qsPage}`,
    `/tweets/user/${u}${qsCursor}`, // cursor fallback
  ]);

  const tweets = Array.isArray(data?.tweets)
    ? data.tweets
    : Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];

  // optional: ensure newest first if backend doesn’t sort
  tweets.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

  return { ...data, tweets };
}

export async function getFollowing(username, page = 1, limit = 10) {
  const res = await fetchWithAuth(
    `${BASE_URL}/users/${encodeURIComponent(username)}/following?page=${page}&limit=${limit}`
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `following ${res.status}`);
  }
  return res.json(); // { results, page, limit, total, hasMore }
}

export async function getFollowers(username, page = 1, limit = 10) {
  const res = await fetchWithAuth(
    `${BASE_URL}/users/${encodeURIComponent(username)}/followers?page=${page}&limit=${limit}`
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `followers ${res.status}`);
  }
  return res.json(); // { results, page, limit, total, hasMore }
}

// Feed (with client-side pagination fallback)
// Only try endpoints that exist on the backend: prefer /tweets/feed and /tweets
let __feedCache = { all: null, at: 0 };

async function fetchAllFeed() {
  const data = await tryGet([
    '/tweets/feed',
    '/tweets',
  ]);
  const raw =
    (Array.isArray(data?.tweets) && data.tweets) ||
    (Array.isArray(data?.results) && data.results) ||
    (Array.isArray(data?.items) && data.items) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data) ||
    [];
  const sorted = raw.slice().sort((a, b) => {
    const da = new Date(a?.createdAt || a?.created_at || 0).getTime();
    const db = new Date(b?.createdAt || b?.created_at || 0).getTime();
    return db - da;
  });
  __feedCache = { all: sorted, at: Date.now() };
  return sorted;
}

export async function getFeed(page = 1, limit = 10, filter = undefined) {
  const qs = `?page=${page}&limit=${limit}${filter ? `&filter=${encodeURIComponent(filter)}` : ''}`;

  // try server-side feed endpoint first (only valid endpoints)
  const data = await tryGet([
    `/tweets/feed${qs}`,
    `/tweets${qs}`,
  ]);

  const list =
    (Array.isArray(data?.tweets) && data.tweets) ||
    (Array.isArray(data?.results) && data.results) ||
    (Array.isArray(data?.items) && data.items) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data) ||
    [];

  if (Array.isArray(list)) {
    return { tweets: list, total: undefined };
  }

  const all = await fetchAllFeed();
  const start = Math.max(0, (page - 1) * limit);
  const chunk = all.slice(start, start + limit);
  return { tweets: chunk, total: all.length };
}

export async function postTweet(payload) {
  const MAX_TWEET_CHARS = 280
  const clean = String(payload?.text || '').trim()
  if (!clean || clean.length > MAX_TWEET_CHARS) {
    throw new Error(`Tweet must be 1–${MAX_TWEET_CHARS} characters`)
  }
  const body = { text: clean, media: Array.isArray(payload?.media) ? payload.media : [] }
  const res = await fetchWithAuth(`${BASE_URL}/tweets`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`postTweet ${res.status} ${txt}`)
  }
  return res.json()
}

export async function getTweet(tweetId) {
  const res = await fetchWithAuth(`${BASE_URL}/tweets/${tweetId}`);
  return res.json();
}

export async function getTweetById(tweetId) {
  const res = await fetchWithAuth(`${BASE_URL}/tweets/${tweetId}`);
  return res.json();
}

export async function getComments(tweetId) {
  const res = await fetchWithAuth(`${BASE_URL}/tweets/${tweetId}/comments`);
  return res.json();
}

export async function postComment(tweetId, text) {
  const MAX_TWEET_CHARS = 280
  const clean = String(text || '').trim()
  if (!clean || clean.length > MAX_TWEET_CHARS) {
    throw new Error(`Comment must be 1–${MAX_TWEET_CHARS} characters`)
  }
  const res = await fetchWithAuth(`${BASE_URL}/tweets/${tweetId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text: clean }),
  })
  return res.json()
}

// LIKE / UNLIKE
export async function toggleLike(tweetId) {
  const res = await fetchWithAuth(`${BASE_URL}/likes/toggle`, {
    method: 'POST',
    body: JSON.stringify({ tweetId }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`toggleLike failed: ${res.status} ${txt}`);
  }
  return res.json();
}

// RETWEET
export async function retweetTweet(tweetId) {
  const res = await fetchWithAuth(`${BASE_URL}/tweets/retweet`, {
    method: 'POST',
    body: JSON.stringify({ tweetId }),
  });
  return res.json();
}

// FOLLOW
export async function followUser(targetUsername) {
  const res = await fetchWithAuth(`${BASE_URL}/follows/follow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUsername }),
  });
  if (!res.ok) throw new Error(`follow ${res.status}`);
  return res.json();
}

export async function unfollowUser(targetUsername) {
  const res = await fetchWithAuth(`${BASE_URL}/follows/unfollow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUsername }),
  });
  if (!res.ok) throw new Error(`unfollow ${res.status}`);
  return res.json();
}

export async function getFollowStatus(targetUsername) {
  const res = await fetchWithAuth(
    `${BASE_URL}/follows/status?targetUsername=${encodeURIComponent(targetUsername)}`
  );
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json(); // k, isFollowing }
}

// Optionally, if you want to be defensive and try multiple shapes:
/*
async function getFirstOk(paths) {
  let lastErr;
  for (const p of paths) {
    try { return await api.get(p); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
export async function getFollowing(username, page=1, limit=10) {
  const u = encodeURIComponent(username), qs=`?page=${page}&limit=${limit}`;
  return getFirstOk([`/users/${u}/following${qs}`, `/follows/following${qs}&username=${u}`]);
}
export async function getFollowers(username, page=1, limit=10) {
  const u = encodeURIComponent(username), qs=`?page=${page}&limit=${limit}`;
  return getFirstOk([`/users/${u}/followers${qs}`, `/follows/followers${qs}&username=${u}`]);
}
*/

// SEARCH for future use
export async function searchUsers(q) {
  const res = await fetchWithAuth(`${BASE_URL}/users/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`search ${res.status}`);
  return res.json();
}

export async function loginWithUsername(username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.toLowerCase(), password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Login failed');
  return data; // { idToken, refreshToken, user, ... }
}
