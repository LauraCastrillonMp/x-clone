const express = require('express');
const router = express.Router();
const TweetController = require('../controllers/TweetController');
const auth = require('../middleware/auth');

// normalize auth middleware export (support: function, { required }, default)
const requireAuth = (function () {
  if (typeof auth === 'function') return auth;
  if (auth && typeof auth.required === 'function') return auth.required;
  if (auth && typeof auth.default === 'function') return auth.default;
  return null;
})();

// explicit feed route (support both / and /feed)
router.get('/', TweetController.feed);
router.get('/feed', TweetController.feed);

// tweets by user (specific) — place before :id
router.get('/user/:username', TweetController.byUser);

// comments for a tweet (specific) — place before :id
router.get('/:id/comments', TweetController.getComments);
if (requireAuth) {
  router.post('/:id/comments', requireAuth, TweetController.createComment);
} else {
  router.post('/:id/comments', TweetController.createComment);
}

// create tweet (or reply if parent provided)
if (requireAuth) {
  router.post('/', requireAuth, TweetController.create);
} else {
  router.post('/', TweetController.create);
}

// get single tweet (generic catch-all for ids)
router.get('/:id', TweetController.get);

module.exports = router;
