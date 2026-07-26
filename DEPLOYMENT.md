# 🚀 MedPath AI Deployment Guide

## Overview
This guide walks you through deploying MedPath AI to production using Vercel (Frontend) + Render (Backend & Database).

---

## ✅ Prerequisites
- ✅ Database created on Render (PostgreSQL)
- ✅ `.env` files configured with database URLs
- ✅ GitHub repository set up
- ✅ Vercel and Render accounts

---

## 📊 Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React/Vite)         → Vercel            │
│  - Auto-deploys from GitHub                         │
│  - Environment: VITE_API_BASE                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Backend (Node.js/Express)     → Render            │
│  - Auto-deploys from GitHub                         │
│  - Environment: DATABASE_URL, JWT_SECRET, etc.     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Database (PostgreSQL 15)      → Render            │
│  - Internal URL: dpg-...@dpg-...                    │
│  - External URL: dpg-...@...-postgres.render.com   │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Step-by-Step Deployment

### Phase 1: Prepare Database Schema

1. Get database connection:
   - External URL: `postgresql://medpath_ai_user:0xpiIEJp7K6JBvPbsBqkmQShUodCfroD@dpg-d9iqrvnaqgkc73ah7lf0-a.oregon-postgres.render.com/medpath_ai`

2. Run schema in Render dashboard or locally:
   ```bash
   psql "your-external-database-url" < backend-scaffold/backend/node-api/src/db/schema.sql
   ```

---

### Phase 2: Deploy Backend to Render

1. Go to [render.com](https://render.com)
2. Click **New +** → **Web Service**
3. Select **Connect a GitHub repository**
4. Choose `MedPath-AI` repo
5. Configure:
   - **Name**: `medpath-api`
   - **Environment**: `Node`
   - **Region**: `Oregon` (or closest to you)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend-scaffold/backend/node-api`
6. Add **Environment Variables**:
   ```
   DATABASE_URL = postgresql://medpath_ai_user:0xpiIEJp7K6JBvPbsBqkmQShUodCfroD@dpg-d9iqrvnaqgkc73ah7lf0-a/medpath_ai
   JWT_SECRET = your-jwt-secret
   NODE_ENV = production
   CORS_ORIGIN = https://medpath-ai.vercel.app
   ```
7. **Plan**: Free
8. Click **Create Web Service**
9. Wait for deployment (~5-10 minutes)
10. **Copy the URL** (e.g., `https://medpath-api.onrender.com`)

---

### Phase 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New** → **Project**
3. **Import Git Repository**
4. Select `MedPath-AI`
5. Configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add **Environment Variables**:
   ```
   VITE_API_BASE = https://medpath-api.onrender.com
   ```
7. Click **Deploy**
8. Wait for deployment (~3-5 minutes)
9. **Copy the URL** (e.g., `https://medpath-ai.vercel.app`)

---

### Phase 4: Update CORS

After deployment, update your backend CORS origin:

1. Go to Render dashboard
2. Select **medpath-api** service
3. Go to **Environment**
4. Update `CORS_ORIGIN`:
   ```
   https://medpath-ai.vercel.app,https://your-domain.com
   ```
5. **Deploy** again

---

## ✅ Testing Your Live Application

1. Open your Vercel URL: `https://medpath-ai.vercel.app`
2. Test login: `testuser@example.com` / `TestPass123!`
3. Test all features:
   - ✅ Dashboard
   - ✅ Symptom Check
   - ✅ Timeline
   - ✅ Appointment Prep
   - ✅ Doctor Finder
   - ✅ Medications
   - ✅ Ask AI
   - ✅ Profile

---

## 📍 Your URLs

```
🌐 Frontend:  https://medpath-ai.vercel.app
📡 Backend:   https://medpath-api.onrender.com
📊 Database:  Managed by Render (no public URL)
```

---

## ❌ Troubleshooting

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Backend still deploying, wait 5 mins |
| Database connection failed | Check DATABASE_URL in Render environment |
| CORS errors | Update CORS_ORIGIN in backend environment |
| Frontend shows errors | Check VITE_API_BASE, clear Vercel cache |
| Build fails | Check `npm run build` works locally |

---

## 🔐 Security Checklist

- [ ] Change JWT_SECRET to a strong random value
- [ ] Never commit `.env` files to GitHub
- [ ] Use environment variables for all secrets
- [ ] Keep database backups enabled on Render
- [ ] Monitor API usage and set rate limits
- [ ] Enable HTTPS (automatic on Vercel/Render)

---

## 📞 Support

For deployment help:
- Vercel Docs: https://vercel.com/docs
- Render Docs: https://render.com/docs
- PostgreSQL: https://www.postgresql.org/docs/
