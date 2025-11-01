const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Like = require('../models/Like');
const Tweet = require('../models/Tweet');

// POST /api/likes/toggle
router.post('/toggle', auth, async (req, res) => {
  try {
    const userId = req.user?._id;
    const { tweetId } = req.body;

    if (!tweetId) return res.status(400).json({ message: 'tweetId required' });
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!mongoose.Types.ObjectId.isValid(tweetId)) {
      return res.status(400).json({ message: 'Invalid tweetId' });
    }

    const tweetExists = await Tweet.exists({ _id: tweetId });
    if (!tweetExists) return res.status(404).json({ message: 'Tweet not found' });

    // Try unlike first (idempotent)
    const del = await Like.deleteOne({ user: userId, tweet: tweetId });

    let liked;
    if (del.deletedCount === 1) {
      liked = false;
    } else {
      await Like.updateOne(
        { user: userId, tweet: tweetId },
        { $setOnInsert: { user: userId, tweet: tweetId, createdAt: new Date() } },
        { upsert: true }
      );
      liked = true;
    }

    // Authoritative count from Likes collection
    const likesCount = await Like.countDocuments({ tweet: tweetId });
    await Tweet.updateOne({ _id: tweetId }, { $set: { likesCount } });

    return res.json({ liked, likesCount });
  } catch (err) {
    console.error('toggleLike error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
