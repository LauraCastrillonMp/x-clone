const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
// Register: después de registro en Firebase cliente, se crea perfil en MongoDB.
router.post('/createProfile', async (req, res) => {
  const { idToken, fullName, username } = req.body;
  if (!idToken || !fullName || !username) return res.status(400).json({ message: 'Missing fields' });
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const exists = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: decoded.email }] });
    if (exists) return res.status(409).json({ message: 'Username or email already in use' });
    const user = new User({
      firebaseUid: decoded.uid,
      fullName,
      username: username.toLowerCase(),
      email: decoded.email
    });
    await user.save();
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});
// Get profile by username
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() }).select('-firebaseUid');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/google/start', AuthController.googleStart);
router.get('/google/callback', AuthController.googleCallback);
module.exports = router;
