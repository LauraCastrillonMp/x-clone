const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  bio: { type: String, default: '' },
  avatarUrl: { type: String, default: null },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('User', userSchema);
