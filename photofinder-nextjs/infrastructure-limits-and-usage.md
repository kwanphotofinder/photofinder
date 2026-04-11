# Infrastructure Limits, Usage, & Capacity Calculations

This document provides a comprehensive analysis of the infrastructure limits for the PhotoFinder facial recognition application. It calculates the maximum capacity based on the free/hobby tiers of the primary services used: **Cloudinary** (Image Storage & CDN), **Vercel** (Next.js 16 Hosting & Serverless Functions), **Neon** (Serverless PostgreSQL with pgvector), and **Hugging Face Spaces** (AI Face Embedding Service via InsightFace/ONNX).

> **Last Updated:** April 2026. Verify official pricing pages before making financial decisions.

---

## 1. Cloudinary (Image Storage & Delivery)

Cloudinary operates on a **Credit** system. The **Free Tier** provides **25 Credits per month**.
- **1 Credit** = 1,000 Transformations **OR** 1 GB Managed Storage **OR** 1 GB Net Viewing Bandwidth.

Credits are shared across all three categories — you decide how to allocate them based on your usage pattern.

### 1.1 Storage Capacity
Assuming we allocate **10 credits (~40%)** to storage:
- **Available Storage:** 10 GB
- **Average Photo Size (after optimization):** All uploads are resized to max 2048px and converted to WebP (quality 85) before upload. Average stored size is **~500 KB to 1 MB per photo**.
- **Maximum Photos in Storage:** 10 GB / ~750 KB ≈ **13,000 to 15,000 photos stored at any one time.**

> **Note:** The daily cron job (`/api/cron/cleanup`, scheduled at `15 17 * * *` UTC) deletes events that have passed their `expiresAt` date. This is the primary mechanism for recycling storage — set sensible expiration dates on events to keep storage under control.

### 1.2 Viewing Bandwidth
Assuming we allocate **10 credits (~40%)** to bandwidth:
- **Available Bandwidth:** 10 GB per month
- **Average User Session:** Views ~50 thumbnails (50 × 50 KB = 2.5 MB) and downloads ~5 full-res photos (5 × 2 MB = 10 MB). Total bandwidth per session ≈ **12.5 MB**.
- **Maximum User Sessions:** 10 GB / 12.5 MB ≈ **800 user viewing sessions per month.**

### 1.3 Transformations (Resizing/Cropping)
Assuming we allocate **5 credits (~20%)** to transformations:
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
- **Current App Configuration:** All heavy API routes (`/api/photos/upload`, `/api/search/face`, `/api/cron/cleanup`, `/api/me/reference-face`) are configured with `export const maxDuration = 60` (60 seconds).
- **Upload Flow:** The upload is **synchronous** — a single request handles: Cloudinary upload → AI face extraction (Hugging Face) → pgvector embedding insertion → response. If the Hugging Face Space is cold, the 60-second timeout may be reached.
- **Mitigation:** The AI service has a `/health` endpoint for wake-up pings. Consider increasing `maxDuration` to 120s or implementing a "warm up then upload" pattern on the frontend.

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

---

## 4. AI Service: Hugging Face Spaces (Docker / FastAPI)

The Python AI microservice (running `insightface` with `onnxruntime`) is deployed as a Docker Space on Hugging Face at `https://kwanphotofinder-photofinder-ai.hf.space`.

### 4.1 Hardware & Memory (Free Tier)
| Spec | Value |
| :--- | :--- |
| vCPUs | 2 |
| RAM | 16 GB |
| Disk | Best-effort (public repos) |

- **Model Load:** InsightFace models consume ~300–500 MB of RAM on startup. With 16 GB available, memory is **not a bottleneck**.
- **CPU Inference Speed:** Without a GPU, ONNX-optimized CPU inference on 2 vCPUs takes roughly **0.5 to 1.5 seconds per photo** (for face detection + 512-dim embedding extraction).
- **Batch Processing:** Processing 500 photos sequentially ≈ **4 to 12.5 minutes**.
- **Impact:** Since the upload flow is synchronous (each photo is uploaded one at a time via the frontend → `/api/photos/upload` → AI → DB), the AI throughput is ~1 photo per 1–2 seconds, which is acceptable for individual uploads but slow for bulk operations.

### 4.2 Cold Starts & Sleep Cycles
- **Sleep Policy:** Free Hugging Face Spaces automatically sleep after **48 hours of inactivity** (no incoming requests).
- **Cold Start Time:** Waking a sleeping Docker Space takes **1 to 3 minutes** (container spin-up, dependency installation, model loading, FastAPI boot).
- **Impact:** If a user uploads a photo to a dormant Space, the first request will either timeout (if Vercel's 60s `maxDuration` is exceeded) or experience a very long delay.
- **Current Mitigation:** The upload route sets `maxDuration = 60` to accommodate cold starts, but 60 seconds may not be enough if the Space has been sleeping for extended periods.
- **Recommendations:**
  1. Implement a frontend "warm up" ping (call `/health` on the Space) before the first upload.
  2. Increase `maxDuration` to 120s for upload routes.
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
