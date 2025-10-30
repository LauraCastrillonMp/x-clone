const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TweetController = require('../controllers/TweetController');

// Put specific routes first
router.get('/feed', auth, TweetController.feed);

// NEW: tweets by username (must be BEFORE '/:id')
router.get('/user/:username', auth, TweetController.byUser);

// List and create
router.get('/', TweetController.list);
router.post('/', auth, TweetController.create);

// Comments
router.get('/:id/comments', auth, TweetController.getComments);
router.post('/:id/comments', auth, TweetController.createComment);

// Get by id LAST
router.get('/:id', auth, TweetController.get);

module.exports = router;
