const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const UserController = require('../controllers/UserController');
const User = require('../models/User');
// const Bookmark = require('../models/Bookmark');

// who am I
router.get('/me', auth, UserController.getMe);

// search users (public)
router.get('/search', UserController.searchUsers);

// get user by username
router.get('/:username/profile', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() }).select('-firebaseUid');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bookmarks of a user (saved)
// router.get('/:username/bookmarks', async (req, res) => {
//   const page = Math.max(1, parseInt(req.query.page || '1'));
//   const limit = 10;
//   try {
//     const user = await User.findOne({ username: req.params.username.toLowerCase() });
//     if (!user) return res.status(404).json({ message: 'User not found' });
//     const bookmarks = await Bookmark.find({ userId: user._id })
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .populate('tweetId');
//     const tweets = bookmarks.map(b => b.tweetId);
//     res.json({ tweets });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// Following / Followers for a username (alphabetical, paginated)
router.get('/:username/following', auth, UserController.listFollowing);
router.get('/:username/followers', auth, UserController.listFollowers);

// get user by email
router.get('/by-email', async (req, res) => {
  const email = String(req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const user = await User.findOne({ email }).select('username').lean();
    if (!user) return res.status(404).json({ error: 'not found' });
    return res.json({ username: user.username });
  } catch (err) {
    console.error('by-email lookup failed', err);
    return res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
