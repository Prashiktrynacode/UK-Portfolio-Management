# QuantVault Deployment Guide

This guide walks you through deploying QuantVault to production using:
- **Frontend**: Vercel (Next.js)
- **Backend API**: Render (Fastify/Node.js)
- **Database**: Supabase (PostgreSQL) or Neon

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup (Supabase)](#database-setup-supabase)
3. [Backend Deployment (Render)](#backend-deployment-render)
4. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Prerequisites

Before starting, ensure you have:

- [ ] GitHub account with your QuantVault repository
- [ ] Supabase account (free tier at [supabase.com](https://supabase.com))
- [ ] Render account (free tier at [render.com](https://render.com))
- [ ] Vercel account (free tier at [vercel.com](https://vercel.com))

---

## Database Setup (Supabase)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `quantvault`
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"** and wait ~2 minutes

### Step 2: Get Connection Details

1. Go to **Settings** → **Database**
2. Find **Connection string** section
3. Copy the **URI** (looks like `postgresql://postgres:[PASSWORD]@...`)
4. Replace `[PASSWORD]` with your database password

### Step 3: Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Enable Authentication (Optional)

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider (enabled by default)
3. Optionally enable **Google**, **GitHub**, etc.

---

## Backend Deployment (Render)

### Step 1: Connect Repository

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already
4. Select your `quantvault` repository

### Step 2: Configure Service

Set these values:

| Setting | Value |
|---------|-------|
| **Name** | `quantvault-api` |
| **Region** | Oregon (or closest) |
| **Branch** | `main` |
| **Root Directory** | `apps/api` |
| **Runtime** | Node |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma migrate deploy && npm start` |
| **Plan** | Free (or Starter for no cold starts) |

### Step 3: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add:

```
NODE_ENV=production
PORT=4000
DATABASE_URL=<your-supabase-connection-string>
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
FRONTEND_URL=https://your-app.vercel.app
API_SECRET=<generate-random-32-char-string>
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for build to complete (~3-5 minutes)
3. Note your API URL: `https://quantvault-api.onrender.com`

### Step 5: Verify Deployment

Visit `https://quantvault-api.onrender.com/health` - you should see:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Frontend Deployment (Vercel)

### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your `quantvault` repository

### Step 2: Configure Project

| Setting | Value |
|---------|-------|
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/web` |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |
| **Install Command** | `npm install` |

### Step 3: Add Environment Variables

Add these in **Environment Variables** section:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_API_URL=https://quantvault-api.onrender.com/api/v1
```

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (~2-3 minutes)
3. Note your app URL: `https://quantvault.vercel.app`

### Step 5: Update CORS

Go back to Render and update the `FRONTEND_URL` environment variable:

```
FRONTEND_URL=https://quantvault.vercel.app
```

Render will automatically redeploy.

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `4000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (secret!) |
| `FRONTEND_URL` | Yes | Vercel app URL for CORS |
| `API_SECRET` | Yes | Random secret for JWT |
| `LOG_LEVEL` | No | `info` (default) |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon/public key |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |

---

## Post-Deployment Checklist

### Security

- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is NOT exposed in frontend
- [ ] CORS is properly configured (only your Vercel domain)
- [ ] Rate limiting is active on API
- [ ] HTTPS is enforced on all endpoints

### Functionality

- [ ] Health check endpoint responds: `/health`
- [ ] Authentication flow works (sign up, sign in)
- [ ] Portfolio CRUD operations work
- [ ] Dashboard loads with data

### Monitoring

- [ ] Enable Render's health checks
- [ ] Set up Vercel Analytics (optional)
- [ ] Configure error tracking (Sentry, optional)

### Performance

- [ ] Enable Render auto-scaling (paid plans)
- [ ] Configure Vercel Edge Functions if needed
- [ ] Set appropriate cache headers

---

## Troubleshooting

### "Database connection failed"

1. Check `DATABASE_URL` is correct
2. Ensure password has no special characters or is URL-encoded
3. Verify Supabase project is running

### "CORS error"

1. Check `FRONTEND_URL` matches exactly (no trailing slash)
2. Redeploy backend after changing CORS settings
3. Clear browser cache

### "Cold start delays" (Render Free Tier)

Free tier spins down after 15 minutes of inactivity. Options:
1. Upgrade to Starter plan ($7/month)
2. Use a cron job to ping health endpoint every 14 minutes

### "Build failed"

1. Check Node.js version matches (>=18)
2. Ensure all dependencies are in `package.json`
3. Check Prisma schema is valid

---

## Push-to-Deploy Workflow

Once configured, both platforms auto-deploy on push to `main`:

```bash
# Make changes locally
git add .
git commit -m "feat: add new feature"
git push origin main

# Vercel: Deploys frontend automatically (~2 min)
# Render: Deploys backend automatically (~5 min)
```

---

## Local Development

```bash
# Clone repository
git clone https://github.com/yourusername/quantvault.git
cd quantvault

# Install dependencies
cd apps/api && npm install
cd ../web && npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Run database migrations
cd apps/api
npx prisma migrate dev

# Start development servers
# Terminal 1: Backend
cd apps/api && npm run dev

# Terminal 2: Frontend
cd apps/web && npm run dev
```

Visit:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- API Docs: http://localhost:4000/health

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
