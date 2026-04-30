# Deployment Guide - Photo Finder

## Overview
This guide explains how to deploy the unified Next.js full-stack application. The current setup runs on **Vercel** and uses external free-tier services for the database (Neon), image storage (Cloudinary), face embedding AI (Hugging Face), and a user navigation assistant chatbot (Groq AI).

## Prerequisites
- GitHub account
- Accounts on: Neon, Cloudinary, Hugging Face, Groq, Vercel
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
6. **Important:** When setting up a new Neon database or pushing to production for the first time, apply your Prisma migrations first and then verify that the pgvector pieces exist. If the database is brand new, run these SQL commands in the Neon console's "SQL Editor":
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
   - The app pings the Space root URL (`GET /`) for wake-up checks and sends embeddings to `POST /extract`.

### 4. Chatbot AI (Groq)
Groq provides a fast, free LLM API for the in-app chatbot that helps students and staff navigate the PhotoFinder platform.

1. Go to [console.groq.com](https://console.groq.com) → Sign up (free account)
2. Navigate to **API Keys** in the sidebar
3. Click **Create API Key**
4. Name it `photofinder` (optional)
5. **Copy your API Key** (looks like: `gsk_xxxxxxxxxxxxxxxxxxxx`)
6. **Save the GROQ_API_KEY**

**Note:** The chatbot is available on all pages of the app and provides MFU-specific guidance about:
- Finding and downloading photos
- PDPA consent and privacy rights
- LINE and email notifications setup
- Reference selfie upload and matching
- Photo removal and data deletion
- Technical troubleshooting

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
| `CRON_SECRET` | `Shared secret used by /api/cron/cleanup and Vercel Cron` |
| `DATABASE_URL` | `Your Neon Connection String (Pooler URL)` |
| `DIRECT_URL` | `Your Neon Connection String (Direct/Non-Pooler URL, required by Prisma for migrations)` |
| `CLOUDINARY_URL` | `Your Cloudinary URL` |
| `AI_SERVICE_URL` | `Your Hugging Face Space URL` |
| `GROQ_API_KEY` | `Your Groq API Key (from console.groq.com)` |

### 3. Deploy
1. Click **Deploy**.
2. Vercel will build the Next.js application.
3. During the build step, Vercel runs `prisma generate` and `prisma migrate deploy` before `next build`.
4. If this is your first deployment and your Neon database is empty, make sure the migration history is committed and that the `vector` extension plus face index exist after migration.

---

## Part 3: Known Limits & Free Tier Behavior

### Cold Starts
- **Hugging Face Spaces:** The free tier sleeps after 48 hours of inactivity. If a photographer uploads a photo after the Space has slept, the first request may take 2-3 minutes while the container wakes up. Subsequent requests are faster.
- **Vercel Serverless Functions:** Next.js API routes run on serverless functions. The first request after inactivity may take an extra 1-2 seconds because of a cold start. The app allows longer durations for photo upload and reference-face routes, but the AI client still has its own shorter timeout.

### Storage
- **Neon:** Free tier includes 500MB of storage. Vector embeddings (`pgvector`) can take up space, but 500MB is enough for hundreds of thousands of faces.
- **Cloudinary:** Free tier includes generous bandwidth and storage credits, more than enough for a university pilot program.

### Chatbot API Rate Limits
- **Groq AI:** Free tier allows 30 requests per minute. The chatbot is rate-limited by user to prevent abuse.
- **Response Time:** Groq responses are typically 1-2 seconds, making for a responsive user experience.
- **Model:** Uses Mixtral 8x7b or faster variants, optimized for low-latency responses.

