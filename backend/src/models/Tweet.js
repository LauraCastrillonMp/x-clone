const mongoose = require('mongoose');
const { Schema } = mongoose;

const TweetSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  // Ensure replies are modeled like this:
  replyTo: { type: Schema.Types.ObjectId, ref: 'Tweet', default: null },

  // Keep a running count for fast UI
  likesCount: { type: Number, default: 0 },
  repliesCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Tweet', TweetSchema);
