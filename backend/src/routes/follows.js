const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const UserController = require('../controllers/UserController');
const FollowController = require('../controllers/FollowController');

router.get('/following', auth, (req, res) => {
  req.params.username = String(req.query.username || '');
  return UserController.listFollowing(req, res);
});

router.get('/followers', auth, (req, res) => {
  req.params.username = String(req.query.username || '');
  return UserController.listFollowers(req, res);
});

router.post('/follow', auth, FollowController.follow);
router.post('/unfollow', auth, FollowController.unfollow);
router.get('/status', auth, FollowController.status);

module.exports = router;
