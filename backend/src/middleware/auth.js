const admin = require('../config/firebaseAdmin');
const User = require('../models/User');

async function firebaseAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Buscar usuario en Mongo usando el UID
    const user = await User.findOne({ firebaseUid: decoded.uid }).lean();

    if (!user) {
      return res.status(401).json({ message: 'User not found in DB' });
    }

    req.user = {
      _id: user._id,
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || user.fullName
    };

    next();
  } catch (err) {
    console.error('Token verify error:', err);

    return res.status(401).json({ 
      message: err.code === 'auth/id-token-expired'
        ? 'Token expired'
        : 'Invalid token'
    });
  }
}

module.exports = firebaseAuth;
