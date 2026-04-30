# Infrastructure Limits, Usage, & Capacity Calculations

This document summarizes the practical infrastructure limits for the PhotoFinder facial recognition application. It estimates capacity using the free or hobby tiers of the primary services: **Cloudinary** (Image Storage & CDN), **Vercel** (Next.js 16.2.4 Hosting & Serverless Functions), **Neon** (Serverless PostgreSQL with pgvector), and **Hugging Face Spaces** (AI Face Embedding Service via InsightFace/ONNX).

> **Last Updated:** April 2026. Verify official pricing pages before making financial decisions.

---

## 1. Cloudinary (Image Storage & Delivery)

Cloudinary uses a **credit** system. The free tier provides **25 credits per month**.
- **1 Credit** = 1,000 Transformations **OR** 1 GB Managed Storage **OR** 1 GB Net Viewing Bandwidth.

Credits are shared across storage, bandwidth, and transformations, so the practical limit depends on how the app is used.

### 1.1 Storage Capacity
If we allocate **10 credits (~40%)** to storage:
- **Available Storage:** 10 GB
- **Average Photo Size (after optimization):** All uploads are resized to max 2048px and converted to WebP (quality 85) before upload. Average stored size is **~500 KB to 1 MB per photo**.
- **Maximum Photos in Storage:** 10 GB / ~750 KB ≈ **13,000 to 15,000 photos stored at any one time.**

> **Note:** The daily cron job (`/api/cron/cleanup`, scheduled at `15 17 * * *` UTC) deletes events after their `expiresAt` date. This is the main way storage is recycled, so event expiration dates should stay conservative.

### 1.2 Viewing Bandwidth
If we allocate **10 credits (~40%)** to bandwidth:
- **Available Bandwidth:** 10 GB per month
- **Average User Session:** Views ~50 thumbnails (50 × 50 KB = 2.5 MB) and downloads ~5 full-res photos (5 × 2 MB = 10 MB). Total bandwidth per session ≈ **12.5 MB**.
- **Maximum User Sessions:** 10 GB / 12.5 MB ≈ **800 user viewing sessions per month.**

### 1.3 Transformations (Resizing/Cropping)
If we allocate **5 credits (~20%)** to transformations:
- **Available Transformations:** 5,000 per month
- Every uploaded photo may use 1 transformation to generate a thumbnail via Cloudinary URL parameters.
- **Maximum New Uploads (Transformation Limit):** **5,000 photos per month.**

### ☁️ Cloudinary Bottleneck Summary (Free Tier)
| Metric | Limit |
| :--- | :--- |
| Max Photos in Storage | ~13,000–15,000 (with resize+WebP optimization) |
| Max New Uploads/Month | ~5,000 (transformation-limited) |
| Max User Viewing Sessions/Month | ~800 |
| **Hard Limit** | Once 25 credits are exhausted, uploads & image delivery will fail. Cloudinary applies "soft limits" — you may get a grace period but will be prompted to upgrade. |

---

## 2. Vercel (Next.js 16 Hosting)

This project runs on the **Vercel Hobby (Free) Tier** with **Fluid Compute** enabled.

### 2.1 Serverless Function Execution
- **Maximum Duration (Hobby + Fluid Compute):** Up to **300 seconds** (5 minutes).
- **Current App Configuration:** The app sets route-specific durations: `180s` for `/api/photos/upload` and `/api/me/reference-face`, `60s` for `/api/events/[id]/upload` and `/api/cron/cleanup`, and `10s` for `/api/ai-health`.
- **Upload Flow:** The upload is **synchronous** — a single request handles: Cloudinary upload → AI face extraction (Hugging Face) → pgvector embedding insertion → response. The upload routes now have enough headroom for a cold AI wake-up, but the AI request itself still has its own 45-second timeout in the app.
- **Mitigation:** The AI service health ping hits the Space root URL (`GET /`). If cold starts remain a problem, the next lever is reducing batch size or warming the Space before uploads.

### 2.2 Bandwidth & Edge Requests
- **Bandwidth Limit:** 100 GB per month.
- Since Cloudinary serves all images directly via CDN, Vercel only serves the Next.js app bundle (HTML/JS/CSS) and JSON API responses.
- **Average App Load Size:** ~200 KB (initial page load).
- **Capacity:** 100 GB / 200 KB ≈ **500,000 page loads/month.** Bandwidth is rarely the bottleneck.

### 2.3 Vercel Image Optimization
- **Limit:** 5,000 source image optimizations per month (Hobby tier).
- **Current Status:** This project has `images: { unoptimized: true }` in `next.config.mjs`, which **bypasses Vercel's image optimization entirely**. All `next/image` components (used in `photo-grid.tsx`, `photo-detail-modal.tsx`, `search-result-grid.tsx`) serve images directly from their Cloudinary URLs without Vercel processing.
- **Impact:** This means the 5,000 optimization limit is **not consumed at all**, but images also won't benefit from Vercel's automatic WebP/AVIF conversion or resizing. Cloudinary handles optimization instead via its transformation URL parameters.

### 2.4 Cron Jobs
- **Hobby Tier Cron Limit:** 2 cron jobs (this project uses 1: daily cleanup).
- **Schedule:** Runs daily at `15:17 UTC` — deletes events past their `expiresAt` date and their associated Cloudinary folders.

### 🔷 Vercel Bottleneck Summary (Hobby Tier)
| Metric | Limit |
| :--- | :--- |
| Function Timeout | Up to 300s (configured at 60s) |
| Bandwidth | 100 GB/month (~500K page loads) |
| Image Optimizations | 5,000/month (unused — `unoptimized: true`) |
| Cron Jobs | 2 allowed, 1 used |
| Function Invocations | 1,000,000/month |

---

## 3. Database: Neon Serverless PostgreSQL (with pgvector)

Neon provides Serverless Postgres with built-in pgvector support. The **Free Tier** requires careful management of storage, compute time, and cold starts.

### 3.1 Storage Limits & Vector Capacity
- **Free Tier Storage:** **512 MB (0.5 GB)** per project.
- **User/Event Row Size:** ~500 bytes each.
- **Photo Row Size:** ~1 KB (includes `storageUrl`, metadata, timestamps, foreign keys).
- **Face Embedding (`vector(512)`):** A 512-dimensional float32 vector requires exactly **2,048 bytes (2 KB)**. With PostgreSQL row overhead and index metadata, estimate **~3 KB per Face row**.

#### Maximum Capacity Calculation (Storage)
Assuming ~400 MB is reserved for Photos and Face Vectors (100 MB for Users, Events, schema overhead, WAL, indexes):

- **Scenario:** 1 Photo contains an average of 3 detected Faces.
- **Storage per Photo (with Faces):** 1 KB (Photo row) + (3 × 3 KB) (Face embeddings & indexes) = **~10 KB per photo.**
- **Maximum Photos Stored in DB:** 400 MB / 10 KB = **~40,000 Photo records.**
- **Maximum Face Embeddings:** ~120,000 Faces.

> **Important:** This is the *database* limit, not the Cloudinary storage limit. The **Cloudinary 10 GB limit (~5,000 photos)** will be reached long before the database fills up.

### 3.2 Compute Time (CU-Hours)
- **Free Tier Limit:** **100 CU-hours per month** (CU = Compute Unit; 1 CU = 1 vCPU + 4 GB RAM).
- **Auto-scaling:** Free tier scales from 0 to 2 CU (2 vCPU, 8 GB RAM).
- **Scale-to-Zero:** The database automatically suspends after **5 minutes of inactivity**. The first query after suspension incurs a cold start delay of **1–3 seconds**.
- **Capacity at minimum size (0.25 CU):** 100 CU-hours / 0.25 CU = **up to 400 active hours/month** (~13 hours/day).
- **Capacity at 1 CU (under load):** 100 CU-hours / 1 CU = **100 active hours/month** (~3.3 hours/day).
- **Impact:** If users browse sporadically, scale-to-zero preserves compute hours effectively. However, constant background activity (e.g., bulk photo uploads keeping the DB active for hours) will deplete compute hours faster. The daily cron job triggers only once per day (#minimal compute cost).

### 3.3 Connection Pooling
- **Built-in Pooling:** Neon includes PgBouncer-based connection pooling, supporting up to **10,000 pooled connections**.
- **Practical Limit:** While the pool is generous, the Free tier's 2 CU maximum means a burst of ~50+ simultaneous face-search queries (each involving a `vector <=> vector` cosine distance computation across thousands of rows) will queue up and potentially cause Vercel function timeouts.
  - **Prisma Configuration:** This project uses `@prisma/adapter-pg` with the pooled `DATABASE_URL` for runtime queries and `DIRECT_URL` for migrations — this is the correct Neon-optimized setup.

### 3.4 Production Setup (SQL Required)
*Important:* Production deploys use `prisma migrate deploy`. If your Neon database is brand new, make sure the migration history is applied and verify the vector extension and index in the Neon console's "SQL Editor":

```sql
-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the High-Dimensional Search Index (speeds up face searches from seconds to milliseconds)
CREATE INDEX IF NOT EXISTS faces_embedding_idx ON faces USING hnsw (embedding vector_cosine_ops);
```

---

## 4. AI Service: Hugging Face Spaces (Docker / FastAPI)

The Python AI microservice, which runs `insightface` with `onnxruntime`, is deployed as a Docker Space on Hugging Face at `https://kwanphotofinder-photofinder-ai.hf.space`.

### 4.1 Hardware & Memory (Free Tier)
| Spec | Value |
| :--- | :--- |
| vCPUs | 2 |
| RAM | 16 GB |
| Disk | Best-effort (public repos) |

- **Model Load:** InsightFace models consume about 300–500 MB of RAM on startup. With 16 GB available, memory is not a bottleneck.
- **CPU Inference Speed:** Without a GPU, ONNX-optimized CPU inference on 2 vCPUs takes roughly **0.5 to 1.5 seconds per photo** (for face detection + 512-dim embedding extraction).
- **Batch Processing:** Processing 500 photos sequentially ≈ **4 to 12.5 minutes**.
- **Impact:** Since the upload flow is synchronous, each photo moves one at a time through the frontend, the API route, the AI service, and the database. The throughput is roughly 1 photo per 1–2 seconds, which is fine for individual uploads but slow for bulk operations.

### 4.2 Cold Starts & Sleep Cycles
- **Sleep Policy:** Free Hugging Face Spaces sleep after **48 hours of inactivity**.
- **Cold Start Time:** Waking a sleeping Docker Space takes about **1 to 3 minutes** for container spin-up, dependency installation, model loading, and FastAPI startup.
- **Impact:** If a user uploads a photo to a dormant Space, the first request can still fail if the AI service stays asleep longer than the app's 45-second AI client timeout, even though the upload routes now allow 180 seconds.
- **Current Mitigation:** The upload routes now allow 180 seconds, but the AI client still times out after 45 seconds inside the app. A warm-up ping or a paid Space is still the main reliability improvement if cold starts continue.
- **Recommendations:**
  1. Implement a frontend "warm up" ping against the Space root URL (`GET /`) before the first upload.
  2. Keep the current longer upload and reference-face route budgets in place.
  3. For production reliability, upgrade to paid hardware (starts at $0.03/hr) to eliminate the sleep cycle.

### 4.3 Network & Rate Limits
- **Bandwidth:** Hugging Face provides generous bandwidth, but continuous aggressive requests may trigger abuse protections.
- **Concurrency:** FastAPI queues requests on a single worker. Sending many concurrent upload requests will serialize at the AI layer.
- **Recommendation:** When implementing bulk upload features, send photos sequentially or in small batches (5–10 at a time) rather than all at once.

---

## 5. The "Golden Ratio" — Maximum Safe Usage (Free Tier)

Based on the tightest bottlenecks across all services, here is the maximum safe load the app can handle **per month** before needing to upgrade:

| Metric | Maximum Safe Limit | Bottleneck Reason |
| :--- | :--- | :--- |
| **Active Events** | **5 to 10 concurrent** | Cloudinary storage + AI processing queue. |
| **Photos per Event** | **~1,000 to 2,000 photos** | Cloudinary 25 Credit Limit (Storage + Transformations). |
| **Total Photos/Month** | **~10,000 to 15,000 photos** | Cloudinary 10 GB storage with resize+WebP optimization. |
| **Active Users/Month** | **~500 to 800 students** | Cloudinary bandwidth (viewing/downloading). |
| **Simultaneous Users** | **~20 to 50 active at once** | Neon Free Tier compute (2 CU max) + Vercel concurrency. |
| **Upload Batch Size** | **1 photo at a time (current)** | Synchronous upload flow; each photo waits for AI response. |
| **DB Compute Budget** | **~400 active hours/month** | 100 CU-hours at minimum scaling (0.25 CU). |

---

## 6. How to Scale (When Limits Are Reached)

When the app grows beyond these numbers, here is the recommended upgrade path ordered by likely bottleneck:

### 6.1 Cloudinary (Most Likely First Bottleneck)
- **Upgrade to:** "Plus" plan — **$89/mo** (annual) or **$99/mo** (monthly) for **225 credits**.
- **Capacity:** ~45,000 photo uploads/month, ~225 GB combined storage + bandwidth.

### 6.2 AI Service (Hugging Face Spaces)
- **CPU Upgrade (8 vCPU, 32 GB):** $0.03/hr — ~$21.60/mo if always-on. Eliminates sleep, ~3–4× faster processing.
- **GPU — Nvidia T4 Small (4 vCPU, 15 GB):** $0.40/hr — ~$288/mo always-on. Reduces per-photo inference from ~1s to ~0.05–0.1s. Best for bulk processing.
- **Tip:** Configure a custom sleep timer (e.g., 1 hour) on paid hardware to reduce costs while keeping cold starts short.

### 6.3 Database (Neon)
- **Upgrade to:** Launch tier — usage-based pricing with **$5/mo minimum**.
  - Compute: **$0.106 per CU-hour**.
  - Storage: **$0.35 per GB-month**.
  - Scales up to 16 CU, removes the 100 CU-hour cap (pay for what you use).
- **Estimated Cost:** For a moderately active app (~500 active hours/month at 0.5 CU average + 2 GB storage): ~$27/mo.

### 6.4 Vercel
- **Upgrade to:** Pro plan — **$20/user/mo**.
- **Benefits:**
  - Function timeout up to **800 seconds** (with Fluid Compute).
  - **1 TB bandwidth** (10× more).
  - Commercial use rights (required by Vercel ToS if generating revenue).
  - Priority support and advanced analytics.

### 💰 Total Estimated Cost for First Scaling Step
| Service | Monthly Cost |
| :--- | :--- |
| Cloudinary Plus | $89 |
| HF Spaces CPU Upgrade | $22 |
| Neon Launch | ~$15–30 |
| Vercel Pro | $20 |
| **Total** | **~$146–161/mo** |
