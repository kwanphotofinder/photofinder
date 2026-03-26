# Deployment Guide - PhotoFinder Testing Environment

## Overview
Deploy the backend architecture across multiple free-tier services (Render, Neon, Hugging Face, Cloudinary) and the frontend on Vercel.

## Prerequisites
- GitHub account
- Accounts on: Render, Neon, Cloudinary, Hugging Face, Vercel
- Your code pushed to GitHub

---

## Part 1: Deploy Storage & AI Services

### 1. PostgreSQL Database (Neon)
1. Go to [neon.tech](https://neon.tech/) → "Sign Up" → "Create Project"
2. Settings:
   - Name: `photofinder`
   - Region: Choose closest to you
3. On the Dashboard, go to **Connection Details**.
4. Set the dropdown to **Node.js** (or keep standard string). Ensure **Connection pooling** is turned ON.
5. **Save the Connection String** (looks like `postgresql://user:pass@ep-name-pooler.region.aws.neon.tech...`)

### 2. Photo Storage (Cloudinary)
1. Go to [cloudinary.com](https://cloudinary.com/) → Sign up
2. Go to your Dashboard → "Product Environment Credentials"
3. **Save your credentials:**
   - Cloud Name
   - API Key
   - API Secret

### 3. AI Service (Hugging Face Spaces)
1. Go to [huggingface.co/spaces](https://huggingface.co/spaces) → "Create new Space"
2. Settings:
   - Space Name: `photofinder-ai`
   - License: MIT (or your choice)
   - Space SDK: **Docker**
   - Hardware: **Free** (CPU basic)
3. Connect your GitHub repository (or upload the contents of your `ai-service` folder).
4. Hugging Face will automatically build the Dockerfile.
5. **Save the Space URL** (e.g., `https://yourusername-photofinder-ai.hf.space`)

---

## Part 2: Deploy Infrastructure on Render

### 1. Weaviate (Vector Database)
1. Go to [Render Dashboard](https://dashboard.render.com/) → "New +" → "Web Service"
2. Select "Deploy an existing image from a registry"
3. Settings:
   - Image URL: `semitechnologies/weaviate:1.24.1`
   - Name: `photofinder-weaviate`
   - Plan: **Free**
4. Environment Variables:
   ```
   QUERY_DEFAULTS_LIMIT=25
   AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true
   PERSISTENCE_DATA_PATH=/var/lib/weaviate
   DEFAULT_VECTORIZER_MODULE=none
   ENABLE_MODULES=
   CLUSTER_HOSTNAME=node1
   ```
5. Click "Create Web Service"
6. **Save the service URL** (e.g., `photofinder-weaviate.onrender.com` - *No https://*)

### 2. API Service (NestJS)
1. Dashboard → "New +" → "Web Service"
2. Connect your GitHub repository
3. Settings:
   - Name: `photofinder-api`
   - Root Directory: `api`
   - Plan: **Free**
4. Environment Variables:
   ```
   PORT=3000
   DATABASE_URL=<Your Neon Connection String from Part 1>
   WEAVIATE_HOST=<Your Weaviate URL from Step 1, without https://>
   WEAVIATE_SCHEME=https
   AI_SERVICE_URL=<Your Hugging Face Space URL from Part 1>
   STORAGE_PROVIDER=cloudinary
   CLOUDINARY_CLOUD_NAME=<From Cloudinary>
   CLOUDINARY_API_KEY=<From Cloudinary>
   CLOUDINARY_API_SECRET=<From Cloudinary>
   CLOUDINARY_FOLDER=photos
   JWT_SECRET=<Create a random secure string>
   GOOGLE_CLIENT_ID=<Your Google Auth Client ID>
   GOOGLE_CLIENT_SECRET=<Your Google Auth Secret>
   ```
5. Click "Create Web Service"
6. Wait for build to complete. The database tables will be created automatically via Prisma on startup.
7. **Save the API service URL** (e.g., `https://photofinder-api.onrender.com`)

---

## Part 3: Deploy Frontend to Vercel

### 1. Deploy Next.js App
1. Go to vercel.com → "New Project"
2. Import your GitHub repository
3. Settings:
   - Framework Preset: **Next.js**
   - Root Directory: `web` (or `photofinder-nextjs`, select where your frontend code lives)
   - Build Command: `npm run build`
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=<Your Render API URL from Part 2, Step 2>
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Your Google Auth Client ID>
   ```
5. Click "Deploy"
6. Wait 2-3 minutes
7. Your app is live!

---

## Part 4: Testing & Known Limits

### First Load Delay
- **Render API & Weaviate** go to sleep after 15 minutes of inactivity. First request takes 30-60 seconds.
- **Hugging Face Spaces** also pause when idle. 
- *Crucial note:* Weaviate's data on Render Free Tier clears upon sleep. Face search will require re-uploading photos per session.

### Costs
- **Render**: $0/month
- **Neon**: $0/month (Permanent)
- **Cloudinary**: $0/month (Permanent, up to 25 credits)
- **Hugging Face**: $0/month
- **Vercel**: $0/month
