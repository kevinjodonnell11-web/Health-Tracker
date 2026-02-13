# Health Tracker - Deployment Guide

This guide covers deploying Health Tracker to various cloud platforms.

## Table of Contents
- [Overview](#overview)
- [Deploy to Render](#deploy-to-render)
- [Deploy to Railway](#deploy-to-railway)
- [Deploy with Docker](#deploy-with-docker)
- [Static Hosting Options](#static-hosting-options)
- [Custom Domain](#custom-domain)

---

## Overview

Health Tracker is a **client-first application** that always uses browser localStorage and can optionally sync to Firebase.

- **No custom backend API required** (server only serves static files)
- **Works offline** after initial load
- **Local-first data** for fast UX
- **Optional Google sign-in + Firestore sync** for multi-device use

The Node.js server (`server.js`) is a lightweight Express app that:
- Serves static files with proper caching
- Adds security headers
- Provides health check endpoint
- Enables gzip compression

---

## Deploy to Render

### Option 1: One-Click Deploy (Recommended)
1. Push your code to GitHub
2. Go to [render.com](https://render.com) > "New" > "Blueprint"
3. Connect your repository
4. Render auto-detects `render.yaml`
5. Click "Apply" - done!

### Option 2: Manual Setup
1. Go to Render Dashboard > "New" > "Web Service"
2. Connect GitHub repository
3. Configure:
   - **Name**: `health-tracker`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Environment variables (optional):
   - `NODE_ENV`: `production`
5. Deploy!

### Render Free Tier
- Works perfectly on free tier
- No persistent storage needed (client-side data)
- Auto-sleep after 15 min inactivity (cold start ~30s)

---

## Deploy to Railway

### Option 1: One-Click Deploy
1. Go to [railway.app](https://railway.app)
2. "New Project" > "Deploy from GitHub repo"
3. Select repository
4. Railway auto-detects `railway.json`
5. Deploy!

### Option 2: Railway CLI
```bash
# Install CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Deploy
railway up

# View logs
railway logs
```

### Railway Configuration
No environment variables required! The app works out of the box.

---

## Deploy with Docker

### Build and Run
```bash
# Build image
docker build -t health-tracker .

# Run container
docker run -d -p 3000:3000 --name health-tracker health-tracker

# View at http://localhost:3000
```

### Docker Compose
Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

Run:
```bash
docker-compose up -d
```

### Deploy to Container Platforms
- **Google Cloud Run**:
  ```bash
  gcloud run deploy health-tracker --source .
  ```
- **AWS App Runner**: Connect GitHub, auto-deploy
- **Azure Container Apps**: Push to ACR, deploy
- **Fly.io**:
  ```bash
  fly launch
  fly deploy
  ```

---

## Static Hosting Options

Since Health Tracker is a static site, you can also deploy without the Node.js server:

### Netlify
1. Connect GitHub repo
2. Build command: (leave empty)
3. Publish directory: `.` (root)
4. Deploy!

Or use Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Vercel
```bash
npm install -g vercel
vercel --prod
```

### GitHub Pages
1. Go to repo Settings > Pages
2. Source: Deploy from branch
3. Branch: main, folder: / (root)
4. Save

### Cloudflare Pages
1. Connect GitHub repo
2. Build command: (leave empty)
3. Output directory: `.`
4. Deploy!

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## Custom Domain

### Render/Railway
1. Go to service settings
2. Add custom domain
3. Configure DNS:
   ```
   Type: CNAME
   Name: @ or www
   Value: your-app.onrender.com (or railway.app)
   ```
4. SSL auto-enabled

### Static Hosts (Netlify/Vercel)
1. Add domain in dashboard
2. Follow DNS instructions
3. SSL auto-configured

---

## Environment Variables

Health Tracker requires **no environment variables**. Everything is optional:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |

---

## Post-Deployment Checklist

- [ ] App loads at your URL
- [ ] Health check passes: `https://your-app.com/health`
- [ ] Can log a workout
- [ ] Data persists after refresh
- [ ] Works on mobile

---

## Data Backup

Since data is stored in localStorage:

### Export Data
1. Open app in browser
2. Go to Settings
3. Click "Export Data"
4. Save JSON file

### Import Data
1. Open app on new device
2. Go to Settings
3. Click "Import Data"
4. Select JSON file

### Sync Between Devices
Sync is supported via Google sign-in + Firestore.

For sync to work on your deployed domain:
1. Enable Google provider in Firebase Auth.
2. Add your domain under Firebase Auth `Authorized domains`.
3. Deploy Firestore rules from `firestore.rules`.

---

## Troubleshooting

### App Shows Blank Page
- Check browser console for errors
- Verify all files deployed (check network tab)
- Try hard refresh (Ctrl+Shift+R)

### Data Not Saving
- Check if localStorage is enabled
- Verify not in private/incognito mode
- Check browser storage quota

### Slow Initial Load
- Normal for free tier (cold start)
- Consider paid tier for always-on
- Use static hosting for faster loads

### Health Check Failing
- Verify server started correctly
- Check logs for errors
- Ensure PORT env var is correct

---

## Performance Tips

1. **Use Static Hosting** for best performance
2. **Enable CDN** if available
3. **Browser Caching** is handled by server
4. **Gzip** is enabled by default

---

## Security Notes

- HTTPS enforced on all platforms.
- Security headers added by server (`helmet` + CSP).
- Local data stays in each user browser unless they opt into Google sync.
- Firestore rules enforce owner-only read/write for both `userData/{uid}` and `users/{uid}`.

For shared/public deployment:
1. Verify Firestore rules are deployed after every auth/data model change.
2. Restrict Firebase Auth authorized domains to your trusted app domains.
3. Periodically export backups from Settings.
