# Orbyt Monorepo

Twitter-like social app:
- Backend: Node.js, Express, MongoDB, Firebase Admin
- Web: React + Vite
- Mobile: React Native (CLI)

Features:
- Auth (email/password, Google OAuth via Firebase/Google)
- Tweets (create, list, detail)
- Likes, Bookmarks
- Follows / Followers
- Notifications
- Profiles, Search
- Media upload (Cloudinary)

## Monorepo Structure
- backend/ (API)
- web/ (Vite React app)
- mobile/ (React Native app)

## Requirements
- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Firebase project (Web + Admin credentials)
- Android Studio (for Android) and/or Xcode (for iOS, macOS only)

## Environment Variables
Do not commit real secrets. Commit only .env.example files.

Backend (backend/.env)
```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/orbyt

# CORS
FRONTEND_URL=http://localhost:5173

# Firebase Admin (Service Account)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"

# Google OAuth (if used by your auth flow)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_REDIRECT=http://localhost:4000/api/auth/google/callback
APP_SCHEME=orbyt://auth

# Cloudinary (media upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Web (web/.env)
```
VITE_API_URL=http://localhost:4000

# Firebase Web SDK
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=1:xxx:web:xxx
```

Mobile
- Set Firebase Web SDK keys in mobile/src/services/firebase.js
- Set API base in mobile/src/services/api.js:
  - Android emulator: http://10.0.2.2:4000
  - iOS simulator: http://localhost:4000
  - Physical device: http://<your-computer-LAN-IP>:4000

## Quick Start

Backend (API)
```
cd backend
npm install
npm run dev
```
- Runs on http://localhost:4000

Web (Vite React)
```
cd web
npm install
npm run dev
```
- Opens on http://localhost:5173

Mobile (React Native)
```
cd mobile
npm install
npm start
# In another terminal:
npm run android
# or (on macOS)
npm run ios
```
Tips:
- Android emulator uses http://10.0.2.2:<port> to reach your PC.
- For a real device, use your PC’s LAN IP (same network).

## Common Scripts
Backend
- npm run dev — start dev server (nodemon)

Web
- npm run dev — start Vite dev server
- npm run build — production build
- npm run preview — preview build locally

Mobile
- npm start — Metro bundler
- npm run android — build/run Android
- npm run ios — build/run iOS (macOS)
- npm test — run Jest tests

## Troubleshooting
- CORS: set FRONTEND_URL to the web app URL.
- Mongo: ensure MONGODB_URI is reachable and MongoDB is running.
- Mobile API base: use 10.0.2.2 for Android emulator, LAN IP for devices.

## Security Checklist
- Ensure .env files are gitignored in the repo root.
- If any secrets were ever committed, rotate them immediately (Firebase, Google OAuth, Cloudinary).
