// media.routes.js
const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

router.post('/cloudinary-signature', (req, res) => {
  try {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary env not configured' });
    }
    const folder = String(req.body?.folder || 'tweets');
    const timestamp = Math.floor(Date.now() / 1000);

    // Sign params in alphabetical order
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + CLOUDINARY_API_SECRET)
      .digest('hex');

    res.json({
      signature,
      timestamp,
      apiKey: CLOUDINARY_API_KEY,
      folder,
      cloudName: CLOUDINARY_CLOUD_NAME,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'signature failed' });
  }
});

module.exports = router;