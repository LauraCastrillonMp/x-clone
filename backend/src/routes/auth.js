const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const AuthController = require('../controllers/AuthController');
const admin = require('../config/firebaseAdmin');

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
if (!FIREBASE_API_KEY) {
  console.warn('Missing FIREBASE_API_KEY in environment — token verification will fail.');
}

async function verifyIdToken(idToken) {
  const decoded = await admin.auth().verifyIdToken(idToken);
  return { uid: decoded.uid, email: decoded.email };
}

// Register: después de registro en Firebase cliente, se crea perfil en MongoDB.
router.post('/createProfile', async (req, res) => {
  const { idToken, fullName, username } = req.body;
  if (!idToken || !fullName || !username) return res.status(400).json({ message: 'Missing fields' });
  try {
    const decoded = await verifyIdToken(idToken);
    const exists = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: decoded.email }] });
    if (exists) {
      return res.status(409).json({ message: 'Username or email already in use' });
    }
    const user = new User({
      firebaseUid: decoded.uid,
      fullName,
      username: username.toLowerCase(),
      email: decoded.email
    });
    await user.save();
    return res.json({ user });
  } catch (err) {
    console.error(err.response?.data || err.message || err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get profile by username
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() }).select('-firebaseUid');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// New: login with username + password (server resolves email and calls Firebase REST)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing username or password' });

  try {
    const user = await User.findOne({ username: username.toLowerCase() }).select('+email');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    try {
      const resp = await axios.post(url, { email: user.email, password, returnSecureToken: true });
      return res.json({
        idToken: resp.data.idToken,
        refreshToken: resp.data.refreshToken,
        expiresIn: resp.data.expiresIn,
        user: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (err) {
      console.error('Firebase REST signIn error data:', err.response?.data || err.message || err);
      const msg = err.response?.data?.error?.message;
      if (msg === 'EMAIL_NOT_FOUND' || msg === 'INVALID_PASSWORD' || msg === 'INVALID_LOGIN_CREDENTIALS') {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      return res.status(500).json({ message: 'Authentication error' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/google/start', AuthController.googleStart);
router.get('/google/callback', AuthController.googleCallback);
module.exports = router;
