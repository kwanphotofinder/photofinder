# Deployment Guide - Photo Finder

## Overview
This guide explains how to deploy the unified Next.js full-stack application. The new architecture is significantly simpler, deploying everything to **Vercel** while relying on external free-tier services for the database (Neon), image storage (Cloudinary), and AI processing (Hugging Face).

## Prerequisites
- GitHub account
- Accounts on: Neon, Cloudinary, Hugging Face, Vercel
- Your code pushed to a GitHub repository

---

## Part 1: Prepare External Services

### 1. PostgreSQL Database with pgvector (Neon)
1. Go to [neon.tech](https://neon.tech/) → "Sign Up" → "Create Project"
2. Settings:
   - Name: `photofinder`
   - Region: Choose the region closest to your users.
3. On the Dashboard, go to **Connection Details**.
4. Set the dropdown to **Node.js** (or keep standard string). Ensure **Connection pooling** is turned ON.
5. **Save the Connection String** (looks like `postgresql://user:pass@ep-name-pooler.region.aws.neon.tech/neondb?sslmode=require`)
6. **Important:** When setting up a new Neon Database or pushing to production for the first time, you **must run these SQL commands manually** in the Neon console's "SQL Editor". `prisma db push` alone will not configure the pgvector dependencies correctly:
```sql
-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the High-Dimensional Search Index (speeds up face searches from seconds to milliseconds)
CREATE INDEX IF NOT EXISTS faces_embedding_idx ON faces USING hnsw (embedding vector_cosine_ops);
```

### 2. Photo Storage (Cloudinary)
1. Go to [cloudinary.com](https://cloudinary.com/) → Sign up
2. Go to your Dashboard and locate your API Environment Variable.
3. **Save your CLOUDINARY_URL** (It looks like: `cloudinary://1234567890:AbCdEfGhIjKlMnOpQrStUvWxYz@cloudname`)

### 3. AI Service (Hugging Face Spaces)
1. Go to [huggingface.co/spaces](https://huggingface.co/spaces) → "Create new Space"
2. Settings:
   - Space Name: `photofinder-ai`
   - License: MIT (or your choice)
   - Space SDK: **Docker**
   - Hardware: **Free** (CPU basic)
3. Upload the contents of your Python AI microservice folder.
4. Hugging Face will automatically build the Dockerfile and start the FastAPI server.
5. **Save the Space URL** (e.g., `https://yourusername-photofinder-ai.hf.space`)

---

## Part 2: Deploy to Vercel

Since the backend API routes are now built directly into Next.js, you only need to deploy one Vercel project!

### 1. Connect Repository
1. Go to [vercel.com](https://vercel.com) → "Add New..." → "Project"
2. Import your GitHub repository.
3. If your code is in a subfolder (like `photofinder-nextjs`), set the **Root Directory** to that folder.
4. Framework Preset should automatically detect **Next.js**.

### 2. Configure Environment Variables
Expand the "Environment Variables" section and add the following keys. Make sure to use the values you saved from Part 1.

| Name | Value |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `/api` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `Your Google OAuth Client ID` |
| `JWT_SECRET` | `A long, random, secure string (e.g., generate one with openssl rand -base64 32)` |
| `GOOGLE_CLIENT_ID` | `Your Google OAuth Client ID` |
| `GOOGLE_CLIENT_SECRET` | `Your Google OAuth Secret` |
| `DATABASE_URL` | `Your Neon Connection String (Pooler URL)` |
| `DIRECT_URL` | `Your Neon Connection String (Direct/Non-Pooler URL, required by Prisma for migrations)` |
| `CLOUDINARY_URL` | `Your Cloudinary URL` |
| `AI_SERVICE_URL` | `Your Hugging Face Space URL` |

### 3. Deploy
1. Click **Deploy**.
2. Vercel will build the Next.js application.
3. During the build step, Vercel will automatically run `prisma generate` to build the database client.
4. *(Optional but Recommended):* If this is your first time deploying and your Neon DB is empty, you will need to push your database schema. You can add a `postinstall` script to your `package.json` (`"postinstall": "prisma generate && prisma db push"`) so Vercel does this automatically, or you can run `npx prisma db push` locally against your Neon connection string.

---

## Part 3: Known Limits & Free Tier Behavior

### Cold Starts
- **Hugging Face Spaces:** The free tier goes to sleep after 48 hours of inactivity. If a photographer tries to upload a photo after the space has slept, the first photo might take up to 2-3 minutes to process while the container wakes up. Subsequent photos will be fast.
- **Vercel Serverless Functions:** Next.js API routes run on serverless functions. The very first request after a period of inactivity might take an extra 1-2 seconds (a "cold start").

### Storage
- **Neon:** Free tier includes 500MB of storage. Vector embeddings (`pgvector`) can take up space, but 500MB is enough for hundreds of thousands of faces.
- **Cloudinary:** Free tier includes generous bandwidth and storage credits, more than enough for a university pilot program.

