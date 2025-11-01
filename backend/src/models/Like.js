const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tweet: { type: mongoose.Schema.Types.ObjectId, ref: 'Tweet', required: true },
  createdAt: { type: Date, default: Date.now },
});

LikeSchema.index({ user: 1, tweet: 1 }, { unique: true });

module.exports = mongoose.model('Like', LikeSchema);
