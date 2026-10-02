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
│  - Production deploys from the `main` branch         │
│  - Environment: VITE_API_BASE                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Backend (Node.js/Express)     → Render            │
│  - Deploy from the Render dashboard after code changes│
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

### Phase 1: Prepare Database

1. Deploy the root `render.yaml` as a Render Blueprint. It provisions the `medpath-db` PostgreSQL database and connects it to the API automatically.

2. The API applies `backend-scaffold/backend/node-api/src/db/schema.sql` automatically on first startup. If you prefer to apply it manually, use the database's external connection string from the Render dashboard. Do not commit that string to this repository.
   ```bash
   psql "your-external-database-url" < backend-scaffold/backend/node-api/src/db/schema.sql
   ```

---

### Phase 2: Deploy Backend to Render

1. Go to [render.com](https://render.com)
2. Click **New +** → **Blueprint**
3. Select **Connect a GitHub repository**
4. Choose the `MedPath-AI` repository
5. Confirm the services defined in `render.yaml`:
   - **Name**: `medpath-api`
   - **Environment**: `Node`
   - **Region**: `Oregon` (or closest to you)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend-scaffold/backend/node-api`
6. Add the remaining **Environment Variables**:
   ```
   JWT_SECRET = <strong random secret>
   GROQ_API_KEY = <Groq API key; store as a Render secret>
   GROQ_MODEL = openai/gpt-oss-20b
   # Optional alternatives: GEMINI_API_KEY, ANTHROPIC_API_KEY
   NODE_ENV = production
   CORS_ORIGIN = <your Vercel frontend URL>
   ```
7. **Plan**: Free
8. Click **Create Web Service**
9. Wait for deployment (~5-10 minutes)
10. **Copy the URL** (for the current deployment: `https://medpath-ai-ggzg.onrender.com`)

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
   VITE_API_BASE = https://medpath-ai-ggzg.onrender.com
   ```
7. Click **Deploy**
8. Wait for deployment (~3-5 minutes)
9. **Copy the URL** (for the current deployment: `https://medpath-ai-frontend-project.vercel.app`)

---

### Phase 4: Update CORS

After deployment, update your backend CORS origin:

1. Go to Render dashboard
2. Select **medpath-api** service
3. Go to **Environment**
4. Update `CORS_ORIGIN`:
   ```
   https://medpath-ai-frontend-project.vercel.app,https://your-domain.com
   ```
5. **Deploy** again

The API allows the primary Vercel domain and deployment URLs for this Vercel project. Add any custom frontend domain to `CORS_ORIGIN` in Render before using it for sign-in.

---

## ✅ Testing Your Live Application

1. Open your Vercel URL: `https://medpath-ai-frontend-project.vercel.app`
2. Sign in with an existing account or create one from the sign-up screen.
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
🌐 Frontend:  https://medpath-ai-frontend-project.vercel.app
📡 Backend:   https://medpath-ai-ggzg.onrender.com
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
