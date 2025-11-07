const mongoose = require('mongoose');
const { Schema } = mongoose;

const TweetSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },

  // canonical relation and legacy alias
  parent: { type: Schema.Types.ObjectId, ref: 'Tweet', default: null },
  replyTo: { type: Schema.Types.ObjectId, ref: 'Tweet', default: null },

  // canonical counter and legacy alias
  commentsCount: { type: Number, default: 0 },
  repliesCount: { type: Number, default: 0 },

  likesCount: { type: Number, default: 0 },
  media: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// keep fields consistent before save
TweetSchema.pre('save', function (next) {
  if (this.parent && !this.replyTo) this.replyTo = this.parent;
  if (this.replyTo && !this.parent) this.parent = this.replyTo;

  if (typeof this.commentsCount === 'number') {
    this.repliesCount = this.commentsCount;
  } else if (typeof this.repliesCount === 'number') {
    this.commentsCount = this.repliesCount;
  }

  next();
});

// normalize loaded docs
TweetSchema.post('init', function (doc) {
  if (doc.parent && !doc.replyTo) doc.replyTo = doc.parent;
  if (doc.replyTo && !doc.parent) doc.parent = doc.replyTo;

  if (typeof doc.commentsCount !== 'number' && typeof doc.repliesCount === 'number') {
    doc.commentsCount = doc.repliesCount;
  }
});

module.exports = mongoose.model('Tweet', TweetSchema);
