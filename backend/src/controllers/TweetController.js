const Tweet = require('../models/Tweet');
const Like = require('../models/Like');
const User = require('../models/User'); // add import

// Helpers: safePopulate (actualizado para Mongoose 6+)
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
  // List (feed) - paginado simple
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

  // Obtener un tweet por id
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

  // Crear tweet (requiere auth)
  async create(req, res) {
    try {
      if (!req.user || !req.user._id) return res.status(401).json({ message: 'Unauthorized' });

      const { text, media, parent } = req.body;
      const clean = typeof text === 'string' ? text.trim() : ''
      if (!clean) return res.status(400).json({ message: 'Text required' })
      if (clean.length > MAX_TWEET_CHARS) {
        return res.status(400).json({ message: `Tweet must be 1–${MAX_TWEET_CHARS} characters` })
      }

      const tweet = new Tweet({
        author: req.user._id,
        text: clean,
        media: Array.isArray(media) ? media : media ? [media] : [],
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

  // Crear comentario (auth required)
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

  // Obtener comentarios de un tweet
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

  // List general
  async list(req, res) {
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
      return res.json({ tweets });
    } catch (err) {
      console.error('TweetController.list error', err);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  // NEW: Tweets por usuario (paginado)
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

  // Example feed handler
  list: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);
      const skip = (page - 1) * limit;

      // Only top-level tweets (no replies)
      const topLevel = { $or: [{ replyTo: null }, { replyTo: { $exists: false } }] };

      const tweets = await Tweet.find(topLevel)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username name avatar')
        .lean();

      // Compute likedByMe in one query
      const ids = tweets.map(t => t._id);
      let likedSet = new Set();
      if (req.user?.id && ids.length) {
        const liked = await Like.find({ user: req.user.id, tweet: { $in: ids } }, { tweet: 1 }).lean();
        likedSet = new Set(liked.map(l => l.tweet.toString()));
      }

      const data = tweets.map(t => ({
        ...t,
        likedByMe: likedSet.has(t._id.toString()),
      }));

      res.json({ data, page, limit });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to load feed' });
    }
  },
};
