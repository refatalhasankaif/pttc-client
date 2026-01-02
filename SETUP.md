# PTT Radio Frontend Setup Guide

## Overview
Complete React frontend for the PTT Radio app with Firebase Auth, real-time Socket.IO, and Tailwind CSS styling.

## Features Implemented
- ✅ Google sign-in (Firebase Auth)
- ✅ Profile setup page (callsign, name, bio, avatar picker)
- ✅ Main radio channel with real-time features
- ✅ Push-to-talk via Shift key
- ✅ Online users list
- ✅ System messages (join, talking, over, out)
- ✅ Protected routes (authentication required)
- ✅ Responsive UI with Tailwind CSS

## Quick Start

### 1. Install Dependencies
```bash
cd client
npm install
```

### 2. Configure Firebase
Edit `src/firebase.js` and replace with your Firebase web SDK config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "1:YOUR_APP_ID:web:YOUR_WEB_APP_ID",
  measurementId: "G-YOUR_MEASUREMENT_ID"
};
```

**Where to find it:**
- Go to [Firebase Console](https://console.firebase.google.com/)
- Select your project → Project Settings (⚙️) → General
- Under "Your apps", find the Web app (</>) → Copy the config

### 3. Add Avatar Images
Place your 11 avatar images in `public/avatars/`:

```
public/
└── avatars/
    ├── 1.png
    ├── 2.png
    ├── 3.png
    ...
    └── 11.png
```

If images are missing, the app will show numbered placeholders.

### 4. Backend Must Be Running
Ensure the backend is running on `http://localhost:4000`:

```bash
# In the backend directory
npm run dev
```

### 5. Start Frontend Dev Server
```bash
cd client
npm run dev
```

Frontend will run on `http://localhost:5173` (or next available port)

---

## File Structure

```
client/
├── src/
│   ├── pages/
│   │   ├── LoginPage.jsx          # Google sign-in
│   │   ├── ProfileSetupPage.jsx   # Profile & avatar setup
│   │   └── MainRadioPage.jsx      # Main PTT radio channel
│   ├── context/
│   │   └── AuthContext.jsx        # Firebase user state
│   ├── hooks/
│   │   └── useSocket.js           # Socket.IO connection
│   ├── utils/
│   │   └── api.js                 # Axios instance with auth
│   ├── firebase.js                # Firebase initialization
│   ├── App.jsx                    # Router & protected routes
│   ├── main.jsx                   # React entry point
│   └── index.css                  # Tailwind + global styles
├── public/
│   └── avatars/                   # 11 avatar images
├── index.html                     # HTML template
├── tailwind.config.js             # Tailwind configuration
├── postcss.config.js              # PostCSS configuration
└── package.json                   # Dependencies
```

---

## User Flow

### 1. **Login Page** (`/login`)
   - Google sign-in button
   - Redirects to profile setup on success

### 2. **Profile Setup** (`/profile-setup`)
   - Callsign (unique, required)
   - Real name (required)
   - Bio (optional, max 100 chars)
   - Avatar selector (1-11)
   - Email from Google (read-only)

### 3. **Main Radio Channel** (`/radio`)
   - Online users list with avatars
   - Real-time activity feed (system messages)
   - Push-to-talk status indicator
   - **Hold Shift key to transmit**
   - Release Shift to stop talking
   - Max 2 speakers enforced by backend

---

## How It Works

### Authentication
- Firebase handles login/logout
- ID token obtained on auth state change
- Passed to backend in `Authorization: Bearer <token>` header
- Also passed to Socket.IO in `auth.token` on connection

### Real-Time Communication
- **Socket.IO** connects with Firebase ID token
- Backend validates token and loads user profile
- Server broadcasts system messages to all clients:
  - `system:join` - user joined
  - `system:talking` - user is transmitting
  - `system:over` - user stopped transmitting
  - `system:out` - user disconnected
  - `online:list` - updated online users

### Push-To-Talk (PTT)
- Client listens for Shift key press/release
- On key down: emits `request-talk` to backend
- Backend checks max 2 speakers and broadcasts `system:talking`
- On key up: emits `release-talk` to backend
- Backend broadcasts `system:over`

### Avatar Display
```javascript
// Backend only stores avatarId (1-11)
// Frontend displays: /avatars/{avatarId}.png
<img src={`/avatars/${user.avatarId}.png`} />
```

---

## Environment Variables
No env file needed for frontend — configure Firebase directly in `src/firebase.js`

---

## Tailwind CSS
Configured with:
- Custom color: `bg-blue-950` (deep blue)
- Responsive grid layouts
- Utility classes for quick styling

---

## Common Issues

### "Profile not found" after login
- User hasn't completed profile setup yet
- Redirect to `/profile-setup` is automatic

### Avatars not showing
- Check `public/avatars/` has all 11 images named `1.png` to `11.png`
- Browser console will show image load errors if missing

### Socket connection fails
- Ensure backend is running on `http://localhost:4000`
- Check Firebase ID token is valid
- Check browser console for auth errors

### Shift key not working for PTT
- Some browsers/OS capture Shift for accessibility
- Try in a different tab or browser if issues
- Check MainRadioPage.jsx event listeners

---

## Build for Production

```bash
npm run build
```

Outputs to `dist/` folder. Then:
- Update Firebase config if needed
- Update backend API URL from `http://localhost:4000` to your production backend
- Deploy to Vercel, Netlify, or static hosting

---

## Next Steps
1. Add your 11 avatar images to `public/avatars/`
2. Configure Firebase in `src/firebase.js`
3. Ensure backend is running
4. Run `npm run dev` and test the app

Ready to use! 🚀
