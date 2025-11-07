const User = require('../models/User');
const Follow = require('../models/Follow');

async function resolveCurrentUserId(req) {
  if (req.user?.id) return req.user.id;
  if (req.user?.uid) {
    const me = await User.findOne({ firebaseUid: req.user.uid }).select('_id').lean();
    return me?._id || null;
  }
  return null;
}

module.exports = {
  follow: async function (req, res) {
    try {
      const meId = await resolveCurrentUserId(req);
      if (!meId) return res.status(401).json({ message: 'Unauthorized' });

      const targetUsername = String(req.body?.targetUsername || '').toLowerCase();
      if (!targetUsername) return res.status(400).json({ message: 'targetUsername required' });

      const target = await User.findOne({ username: targetUsername }).select('_id').lean();
      if (!target) return res.status(404).json({ message: 'User not found' });
      if (String(target._id) === String(meId)) {
        return res.status(400).json({ message: 'Cannot follow yourself' });
      }

      const exists = await Follow.findOne({ followerId: meId, followingId: target._id }).lean();
      if (exists) {
        const t = await User.findById(target._id).select('followersCount').lean();
        return res.json({ ok: true, isFollowing: true, followersCount: t?.followersCount ?? undefined });
      }

      await Follow.create({ followerId: meId, followingId: target._id });
      await User.updateOne({ _id: meId }, { $inc: { followingCount: 1 } }).exec();
      await User.updateOne({ _id: target._id }, { $inc: { followersCount: 1 } }).exec();
      const t = await User.findById(target._id).select('followersCount').lean();

      return res.json({ ok: true, isFollowing: true, followersCount: t?.followersCount });
    } catch (e) {
      if (e?.code === 11000) {
        return res.json({ ok: true, isFollowing: true });
      }
      console.error('follow error', e);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  unfollow: async function (req, res) {
    try {
      const meId = await resolveCurrentUserId(req);
      if (!meId) return res.status(401).json({ message: 'Unauthorized' });

      const targetUsername = String(req.body?.targetUsername || '').toLowerCase();
      if (!targetUsername) return res.status(400).json({ message: 'targetUsername required' });

      const target = await User.findOne({ username: targetUsername }).select('_id').lean();
      if (!target) return res.status(404).json({ message: 'User not found' });
      if (String(target._id) === String(meId)) {
        return res.status(400).json({ message: 'Cannot unfollow yourself' });
      }

      const del = await Follow.deleteOne({ followerId: meId, followingId: target._id }).exec();
      if (del.deletedCount > 0) {
        await User.updateOne({ _id: meId }, { $inc: { followingCount: -1 } }).exec();
        await User.updateOne({ _id: target._id }, { $inc: { followersCount: -1 } }).exec();
      }
      const t = await User.findById(target._id).select('followersCount').lean();

      return res.json({ ok: true, isFollowing: false, followersCount: t?.followersCount });
    } catch (e) {
      console.error('unfollow error', e);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  status: async function (req, res) {
    try {
      const meId = await resolveCurrentUserId(req);
      if (!meId) return res.status(401).json({ message: 'Unauthorized' });

      const targetUsername = String(
        req.query.targetUsername || req.query.username || req.body?.targetUsername || ''
      ).toLowerCase();
      if (!targetUsername) return res.status(400).json({ message: 'targetUsername required' });

      const target = await User.findOne({ username: targetUsername }).select('_id').lean();
      if (!target) return res.status(404).json({ message: 'User not found' });

      const edge = await Follow.findOne({ followerId: meId, followingId: target._id }).lean();
      return res.json({ ok: true, isFollowing: !!edge });
    } catch (e) {
      console.error('follow status error', e);
      return res.status(500).json({ message: 'Server error' });
    }
  },
};
