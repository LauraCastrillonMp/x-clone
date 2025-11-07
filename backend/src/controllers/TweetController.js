const Tweet = require('../models/Tweet');
const Like = require('../models/Like');
const User = require('../models/User');
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';

async function populateTweet(doc) {
  if (!doc) return doc;
  try {
    await doc.populate('author', 'username fullName');
    return doc;
  } catch {
    return doc;
  }
}

const MAX_TWEET_CHARS = 280

module.exports = {
  // feed / top-level tweets (paginated)
  async feed(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page || '1'));
      const limit = 20;
      const tweets = await Tweet.find({ parent: null })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', 'username fullName')
        .lean()
        .exec();

      const ids = tweets.map(t => t._id);
      let likedSet = new Set();
      if (req.user?._id && ids.length) {
        const likes = await Like.find({ user: req.user._id, tweet: { $in: ids } })
          .select('tweet')
          .lean();
        likedSet = new Set(likes.map(l => String(l.tweet)));
      }

      const data = tweets.map(t => ({
        ...t,
        likesCount: Number.isFinite(t.likesCount) ? t.likesCount : 0,
        commentsCount: Number.isFinite(t.commentsCount) ? t.commentsCount : 0,
        likedByCurrentUser: likedSet.has(String(t._id)),
      }));

      return res.json({ tweets: data, page });
    } catch (err) {
      console.error('feed error', err);
      res.status(500).json({ message: 'Server error' });
    }
  },

  async get(req, res) {
    try {
      const id = req.params.id;
      const tweet = await Tweet.findById(id)
        .populate('author', 'username fullName')
        .lean()
        .exec();
      if (!tweet) return res.status(404).json({ message: 'Tweet not found' });

      let likedByCurrentUser = false;
      if (req.user?._id) {
        likedByCurrentUser = !!(await Like.exists({ user: req.user._id, tweet: id }));
      }

      return res.json({
        ...tweet,
        likesCount: Number.isFinite(tweet.likesCount) ? tweet.likesCount : 0,
        commentsCount: Number.isFinite(tweet.commentsCount) ? tweet.commentsCount : 0,
        likedByCurrentUser,
      });
    } catch (err) {
      console.error('TweetController.get error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  async create(req, res) {
    try {
      if (!req.user || !req.user._id) return res.status(401).json({ message: 'Unauthorized' });

      const { text, media, parent } = req.body;
      const clean = typeof text === 'string' ? text.trim() : ''
      if (!clean) return res.status(400).json({ message: 'Text required' })
      if (clean.length > MAX_TWEET_CHARS) {
        return res.status(400).json({ message: `Tweet must be 1–${MAX_TWEET_CHARS} characters` })
      }

      const normalizeMedia = (arr = []) => {
        if (!Array.isArray(arr)) return [];
        return arr
          .map(m => {
            if (!m) return null;
            if (typeof m !== 'string') return null;
            const s = m.trim();
            if (!s) return null;
            if (s.startsWith('http')) return s;
            const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(s) || s.includes('/video/');
            const type = isVideo ? 'video' : 'image';
            if (!CLOUDINARY_CLOUD_NAME) return s;
            return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/${type}/upload/${s}`;
          })
          .filter(Boolean);
      };

      const mediaUrls = normalizeMedia(media);

      const tweet = new Tweet({
        author: req.user._id,
        text: clean,
        media: mediaUrls,
        parent: parent || null,
      });

      await tweet.save();
      await tweet.populate('author', 'username fullName');

      if (parent) {
        await Tweet.findByIdAndUpdate(parent, { $inc: { commentsCount: 1 } }).exec();
      }

      return res.status(201).json(tweet);
    } catch (err) {
      console.error('TweetController.create error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  async createComment(req, res) {
    try {
      if (!req.user || !req.user._id) return res.status(401).json({ message: 'Unauthorized' });

      const parentId = req.params.id;
      const { text } = req.body;
      const clean = typeof text === 'string' ? text.trim() : ''
      if (!clean) return res.status(400).json({ message: 'Text required' })
      if (clean.length > MAX_TWEET_CHARS) {
        return res.status(400).json({ message: `Comment must be 1–${MAX_TWEET_CHARS} characters` })
      }

      const comment = new Tweet({
        author: req.user._id,
        text: clean,
        parent: parentId,
      });

      await comment.save();
      await Tweet.findByIdAndUpdate(parentId, { $inc: { commentsCount: 1 } }).exec();
      await comment.populate('author', 'username fullName');

      return res.status(201).json(comment);
    } catch (err) {
      console.error('TweetController.createComment error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  async getComments(req, res) {
    try {
      const parentId = req.params.id;
      const comments = await Tweet.find({ parent: parentId })
        .sort({ createdAt: -1 })
        .populate('author', 'username fullName')
        .lean()
        .exec();

      let likedSet = new Set();
      if (req.user?._id && comments.length) {
        const ids = comments.map(c => c._id);
        const likes = await Like.find({ user: req.user._id, tweet: { $in: ids } })
          .select('tweet')
          .lean();
        likedSet = new Set(likes.map(l => String(l.tweet)));
      }

      const data = comments.map(c => ({
        ...c,
        likesCount: Number.isFinite(c.likesCount) ? c.likesCount : 0,
        commentsCount: Number.isFinite(c.commentsCount) ? c.commentsCount : 0,
        likedByCurrentUser: likedSet.has(String(c._id)),
      }));

      return res.json(data);
    } catch (err) {
      console.error('TweetController.getComments error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  // tweets by user
  async byUser(req, res) {
    try {
      const { username } = req.params;
      const page = Math.max(1, parseInt(req.query.page || '1'));
      const limit = 10;

      const user = await User.findOne({ username: username.toLowerCase() }).lean();
      if (!user) return res.status(404).json({ message: 'User not found' });

      const tweets = await Tweet.find({ author: user._id, parent: null })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('author', 'username fullName')
        .lean()
        .exec();

      const ids = tweets.map(t => t._id);
      let likedSet = new Set();
      if (req.user?._id && ids.length) {
        const likes = await Like.find({ user: req.user._id, tweet: { $in: ids } })
          .select('tweet')
          .lean();
        likedSet = new Set(likes.map(l => String(l.tweet)));
      }

      const data = tweets.map(t => ({
        ...t,
        likesCount: Number.isFinite(t.likesCount) ? t.likesCount : 0,
        commentsCount: Number.isFinite(t.commentsCount) ? t.commentsCount : 0,
        likedByCurrentUser: likedSet.has(String(t._id)),
      }));

      return res.json({ tweets: data, page });
    } catch (err) {
      console.error('TweetController.byUser error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },
};
