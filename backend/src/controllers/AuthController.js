// AuthController.js
const { OAuth2Client } = require('google-auth-library');
const admin = require('../config/firebaseAdmin'); // assumes this exports initialized admin
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.OAUTH_REDIRECT;
const APP_SCHEME = process.env.APP_SCHEME || 'orbyt://auth';

exports.googleStart = async (req, res) => {
  try {
    const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
      redirect_uri: REDIRECT_URI,
    });
    return res.redirect(url);
  } catch (e) {
    console.error('googleStart error', e);
    return res.status(500).send('OAuth init failed');
  }
};

exports.googleCallback = async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code');

    const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    const { tokens } = await client.getToken({ code, redirect_uri: REDIRECT_URI });

    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload(); // { sub, email, name, picture, email_verified, ... }

    const uid = `google:${payload.sub}`;
    // Optional: map to your app’s user model here

    const customToken = await admin.auth().createCustomToken(uid, {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified,
      provider: 'google',
    });

    // Deep link back to the app with the Firebase custom token
    const redirect = `${APP_SCHEME}?customToken=${encodeURIComponent(customToken)}`;
    return res.redirect(redirect);
  } catch (e) {
    console.error('googleCallback error', e.response?.data || e);
    return res.status(500).send('OAuth callback failed');
  }
};
