require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const tweetsRoutes = require('./src/routes/tweets');
const usersRoutes = require('./src/routes/users');
const followsRoutes = require('./src/routes/follows');
const notificationsRoutes = require('./src/routes/notifications');
const likesRoutes = require('./src/routes/likes');
const bookmarksRoutes = require('./src/routes/bookmarks');
const mediaRoutes = require('./src/routes/media');
const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/tweets', tweetsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/follows', followsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/media', mediaRoutes);
const PORT = process.env.PORT || 4000;
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      const Like = require('./src/models/Like');
      await Like.syncIndexes();
      console.log('Like indexes synced');
    } catch (e) {
      console.warn('Like.syncIndexes failed:', e?.message || e);
    }
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
