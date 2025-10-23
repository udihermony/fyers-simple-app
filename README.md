# Fyers Simple App

A minimal, end-to-end scaffold for a Fyers OAuth app with:

- **Backend** (Node/Express) on Railway to handle OAuth and Fyers API calls
- **Frontend** (Next.js) on Vercel to show a clean UI with "Login with Fyers" and profile/account info
- **Git-friendly structure** so you can push to your GitHub repo and deploy easily

## What it does

- OAuth login flow with Fyers
- Exchanges auth_code for access_token
- Stores access_token in an HTTP-only cookie
- Provides a protected `/api/me` endpoint returning `fyers.get_profile()`
- Clean UI showing profile info and login/logout

## Repo structure

```
fyers-simple-app/
├── server/          # Express backend for OAuth + profile API (deploy to Railway)
├── web/             # Next.js minimal frontend (deploy to Vercel)
└── README.md
```

## Quick Start

### 1. Backend Setup (Railway)

1. **Create Railway app:**
   ```bash
   cd fyers-simple-app/server
   npm install
   ```

2. **Set environment variables in Railway:**
   - `PORT=8080`
   - `FYERS_APP_ID=your_fyers_app_id`
   - `FYERS_SECRET_KEY=your_fyers_secret`
   - `FYERS_REDIRECT_URL=https://your-railway-app.up.railway.app/auth/callback`
   - `FRONTEND_URL=https://your-frontend.vercel.app`
   - `FYERS_ENABLE_LOGGING=0`
   - `LOG_PATH=/tmp`

3. **Deploy to Railway:**
   - Connect your GitHub repo to Railway
   - Set root directory to `fyers-simple-app/server`
   - Deploy

### 2. Frontend Setup (Vercel)

1. **Install dependencies:**
   ```bash
   cd fyers-simple-app/web
   npm install
   ```

2. **Set environment variables in Vercel:**
   - `NEXT_PUBLIC_API_BASE_URL=https://your-railway-app.up.railway.app`

3. **Deploy to Vercel:**
   - Connect your GitHub repo to Vercel
   - Set root directory to `fyers-simple-app/web`
   - Deploy

### 3. Fyers App Configuration

1. **Create Fyers app** at [Fyers Developer Portal](https://myapi.fyers.in/)
2. **Set redirect URL** to: `https://your-railway-app.up.railway.app/auth/callback`
3. **Copy App ID and Secret** to your Railway environment variables

## Local Development

### Backend
```bash
cd fyers-simple-app/server
cp env.example .env
# Edit .env with your values
npm run dev
```

### Frontend
```bash
cd fyers-simple-app/web
cp env.local.example .env.local
# Edit .env.local with your backend URL
npm run dev
```

## API Endpoints

### Backend (Railway)
- `GET /health` - Health check
- `GET /auth/login` - Start OAuth flow
- `GET /auth/callback` - OAuth callback
- `GET /api/me` - Get user profile (protected)
- `POST /auth/logout` - Logout

### Frontend (Vercel)
- `/` - Main page with login/profile UI

## Security Features

- HTTP-only cookies for token storage
- CORS configuration for frontend
- Secure cookie settings for production
- Environment variable validation

## Deployment URLs

After deployment, your app will be available at:
- **Frontend:** `https://your-frontend.vercel.app`
- **Backend:** `https://your-railway-app.up.railway.app`

## Troubleshooting

1. **CORS errors:** Ensure `FRONTEND_URL` matches your Vercel URL exactly
2. **OAuth redirect:** Verify redirect URL is whitelisted in Fyers app settings
3. **Environment variables:** Check all required variables are set in Railway/Vercel
4. **Logs:** Enable `FYERS_ENABLE_LOGGING=1` for debugging

## Tech Stack

- **Backend:** Node.js, Express, fyers-api-v3, cookie-parser, cors
- **Frontend:** Next.js, React
- **Deployment:** Railway (backend), Vercel (frontend)
- **Authentication:** Fyers OAuth 2.0
