// UserController.js
const User = require('../models/User');
const Follow = require('../models/Follow');

function toInt(v, d) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
}

async function resolveCurrentUserId(req) {
  if (req.user?.id) return req.user.id;
  if (req.user?.uid) {
    const me = await User.findOne({ firebaseUid: req.user.uid }).select('_id').lean();
    return me?._id || null;
  }
  return null;
}

// GET /api/users/me
module.exports.getMe = module.exports.getMe || (async (req, res) => {
  try {
    // Prefer Firebase UID, fallback to Mongo _id if middleware provided it
    let me = null;
    if (req.user?.uid) {
      me = await User.findOne({ firebaseUid: req.user.uid }).select('-firebaseUid').lean();
    }
    if (!me && req.user?.id) {
      me = await User.findById(req.user.id).select('-firebaseUid').lean();
    }
    if (!me) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ user: me });
  } catch (e) {
    console.error('getMe error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/search?q=
module.exports.searchUsers = module.exports.searchUsers || (async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({ $or: [{ username: rx }, { fullName: rx }] })
      .select('username fullName avatarUrl')
      .limit(20)
      .lean();
    res.json({ results: users });
  } catch (e) {
    console.error('searchUsers error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:username/following?page=&limit=
module.exports.listFollowing = module.exports.listFollowing || (async (req, res) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    const page = toInt(req.query.page, 1);
    const limit = Math.min(toInt(req.query.limit, 10), 50);
    const skip = (page - 1) * limit;

    const target = await User.findOne({ username }).lean();
    if (!target) return res.status(404).json({ message: 'User not found' });

    const edges = await Follow.find({ followerId: target._id }).select('followingId').lean();
    const ids = edges.map(e => e.followingId).filter(Boolean);
    const total = ids.length;
    if (total === 0) return res.json({ results: [], page, limit, total, hasMore: false });

    const myId = await resolveCurrentUserId(req);
    let myFollowingSet = new Set();
    if (myId) {
      const myFollowingEdges = await Follow.find({ followerId: myId }).select('followingId').lean();
      myFollowingSet = new Set(myFollowingEdges.map(e => String(e.followingId)));
    }

    const users = await User.find({ _id: { $in: ids } })
      .select('username fullName avatarUrl')
      .collation({ locale: 'en', strength: 1 })
      .sort({ fullName: 1, username: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const results = users.map(u => ({
      _id: u._id,
      username: u.username,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      isFollowing: myFollowingSet.has(String(u._id)),
    }));

    res.json({ results, page, limit, total, hasMore: skip + results.length < total });
  } catch (e) {
    console.error('listFollowing error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:username/followers?page=&limit=
module.exports.listFollowers = module.exports.listFollowers || (async (req, res) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    const page = toInt(req.query.page, 1);
    const limit = Math.min(toInt(req.query.limit, 10), 50);
    const skip = (page - 1) * limit;

    const target = await User.findOne({ username }).lean();
    if (!target) return res.status(404).json({ message: 'User not found' });

    const edges = await Follow.find({ followingId: target._id }).select('followerId').lean();
    const ids = edges.map(e => e.followerId).filter(Boolean);
    const total = ids.length;
    if (total === 0) return res.json({ results: [], page, limit, total, hasMore: false });

    const myId = await resolveCurrentUserId(req);
    let myFollowingSet = new Set();
    if (myId) {
      const myFollowingEdges = await Follow.find({ followerId: myId }).select('followingId').lean();
      myFollowingSet = new Set(myFollowingEdges.map(e => String(e.followingId)));
    }

    const users = await User.find({ _id: { $in: ids } })
      .select('username fullName avatarUrl')
      .collation({ locale: 'en', strength: 1 })
      .sort({ fullName: 1, username: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const results = users.map(u => ({
      _id: u._id,
      username: u.username,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      isFollowing: myFollowingSet.has(String(u._id)),
    }));

    res.json({ results, page, limit, total, hasMore: skip + results.length < total });
  } catch (e) {
    console.error('listFollowers error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
