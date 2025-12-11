# Deployment Guide - PhotoFinder Testing Environment

## Overview
Deploy to Render (backend services) + Vercel (frontend) for free testing.

## Prerequisites
- GitHub account
- Render account (sign up at render.com - no card needed)
- Vercel account (sign up at vercel.com - no card needed)
- Your code pushed to GitHub

---

## Part 1: Deploy Backend Services to Render

### 1. PostgreSQL Database
1. Go to Render Dashboard → "New +" → "PostgreSQL"
2. Settings:
   - Name: `photofinder-db`
   - Database: `photofinder`
   - User: `photofinder_user`
   - Region: Choose closest to you
   - Plan: **Free**
3. Click "Create Database"
4. **Save the Internal Database URL** (starts with `postgresql://`)

### 2. Weaviate (Vector Database)
1. Dashboard → "New +" → "Web Service"
2. Settings:
   - Name: `photofinder-weaviate`
   - Runtime: **Docker**
   - Image URL: `semitechnologies/weaviate:1.24.1`
   - Plan: **Free**
3. Environment Variables:
   ```
   QUERY_DEFAULTS_LIMIT=25
   AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true
   PERSISTENCE_DATA_PATH=/var/lib/weaviate
   DEFAULT_VECTORIZER_MODULE=none
   ENABLE_MODULES=
   CLUSTER_HOSTNAME=node1
   ```
4. Click "Create Web Service"
5. **Save the service URL** (e.g., `https://photofinder-weaviate.onrender.com`)

### 3. MinIO (Object Storage)
1. Dashboard → "New +" → "Web Service"
2. Settings:
   - Name: `photofinder-minio`
   - Runtime: **Docker**
   - Image URL: `minio/minio`
   - Plan: **Free**
3. Add Disk:
   - Mount Path: `/data`
   - Size: 1GB
4. Environment Variables:
   ```
   MINIO_ROOT_USER=admin123
   MINIO_ROOT_PASSWORD=admin123456
   ```
5. Start Command: `server /data --console-address :9001`
6. Click "Create Web Service"
7. **Save the service URL**

### 4. AI Service (Python)
1. Dashboard → "New +" → "Web Service"
2. Connect your GitHub repository
3. Settings:
   - Name: `photofinder-ai`
   - Root Directory: `ai-service`
   - Runtime: **Docker** (auto-detected from Dockerfile)
   - Plan: **Free**
4. Environment Variables:
   ```
   PORT=8000
   ```
5. Click "Create Web Service"
6. Wait 10-15 minutes for build (downloads face recognition model)
7. **Save the service URL**

### 5. API Service (NestJS)
1. Dashboard → "New +" → "Web Service"
2. Connect your GitHub repository
3. Settings:
   - Name: `photofinder-api`
   - Root Directory: `api`
   - Runtime: **Docker** (auto-detected from Dockerfile)
   - Plan: **Free**
4. Environment Variables (replace with YOUR URLs from above):
   ```
   DATABASE_URL=<Your PostgreSQL Internal URL from step 1>
   WEAVIATE_HOST=<Your Weaviate URL without https://>
   WEAVIATE_SCHEME=https
   MINIO_ENDPOINT=<Your MinIO URL without https://>
   MINIO_PORT=443
   MINIO_ACCESS_KEY=admin123
   MINIO_SECRET_KEY=admin123456
   MINIO_BUCKET=photos
   MINIO_USE_SSL=true
   AI_SERVICE_URL=<Your AI Service URL>
   PORT=3000
   JWT_SECRET=your-secret-key-change-me
   ```
5. Click "Create Web Service"
6. Wait for build to complete
7. Once deployed, run migration:
   - Go to service → Shell tab
   - Run: `npx prisma migrate deploy`
8. **Save the API service URL** (e.g., `https://photofinder-api.onrender.com`)

---

## Part 2: Deploy Frontend to Vercel

### 1. Deploy Next.js App
1. Go to vercel.com → "New Project"
2. Import your GitHub repository
3. Settings:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `photofinder-nextjs`
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=<Your API URL from Part 1, step 5>
   NEXT_PUBLIC_GRAFANA_URL=<Leave blank for testing>
   ```
5. Click "Deploy"
6. Wait 2-3 minutes
7. Your app is live! Copy the Vercel URL

---

## Part 3: Test Your Deployment

### 1. Access Your App
Visit your Vercel URL (e.g., `https://photofinder-xyz.vercel.app`)

### 2. First Load Delay
- **Important**: First load after 15 min idle = 30-60 sec wait (free tier limitation)
- Tell testers to expect this

### 3. Test Features
1. Login as student → Search with selfie
2. Login as photographer → Upload photos to events
3. Login as admin → View dashboard

### 4. Known Issues on Free Tier
- ⏱️ Cold starts after 15 min idle
- 💾 Limited storage (1GB MinIO)
- 🐌 Slower than localhost
- 📊 Skip Prometheus/Grafana (save resources)

---

## Troubleshooting

### "Service Unavailable" Error
- Service is waking up from sleep, wait 60 seconds and refresh

### Photos not loading
- Check MinIO URL in API environment variables
- Ensure MINIO_USE_SSL=true

### Face search not working
- Check AI Service logs on Render
- Ensure AI_SERVICE_URL is correct in API env vars

### Database connection errors
- Verify DATABASE_URL is the **Internal Database URL** from Render PostgreSQL
- Run migrations: `npx prisma migrate deploy` in API shell

---

## Costs
- **Render**: 100% FREE (with sleep limitations)
- **Vercel**: 100% FREE
- **Total**: $0/month for testing

---

## After Testing
If you want to keep it running 24/7 without sleep:
- Render Paid Plan: ~$7-15/month
- Or migrate to Railway, Fly.io, or Oracle Cloud

---

## Need Help?
Check service logs in Render dashboard → Click service → "Logs" tab
