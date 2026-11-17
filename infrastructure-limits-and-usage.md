# Infrastructure Limits, Usage, & Capacity Calculations

This document summarizes the practical infrastructure limits for the PhotoFinder facial recognition application in its current production setup: the web app, AI service, and PostgreSQL (with `pgvector`) run on the **MFU university Kubernetes cluster**, and photos are stored on **Cloudinary**.

> **Last Updated:** November 2026. Resource numbers come from `deploy/helm/photofinder/values.yaml`; Cloudinary numbers are free-tier estimates — verify the official pricing page before making financial decisions.

---

## 1. Where Everything Runs

| Component | Where | Notes |
| :--- | :--- | :--- |
| Web app (Next.js 16) | University Kubernetes, `photofinder-web` | 2 replicas, deployed by GitLab CI through Helm |
| AI service (FastAPI, InsightFace/ONNX, CPU) | University Kubernetes, `photofinder-ai` | 1 replica, internal only (`http://photofinder-ai:7860`) |
| PostgreSQL + `pgvector` | University Kubernetes, `photofinder-postgres` StatefulSet | Managed outside the Helm chart; data on PVC `pgdata-photofinder-postgres-0` |
| Photo storage & CDN | Cloudinary (external, free tier) | The only paid-tier-limited service in the main flow |
| AI chatbot (optional) | Groq API (external, free tier) | Disabled gracefully when `GROQ_API_KEY` is empty |
| Notifications (optional) | Gmail / LINE (external) | Skipped when not configured |

Public entry point: `photofinder.mfu.ac.th` (nginx ingress). See [`deploy/README.md`](./deploy/README.md) for the release flow.

---

## 2. University Server (Kubernetes)

### 2.1 Pod Resources
| Workload | Replicas | CPU request / limit | Memory request / limit |
| :--- | :--- | :--- | :--- |
| `photofinder-web` | 2 | 250m / 2 | 512Mi / 2Gi |
| `photofinder-ai` | 1 | 500m / 2 | 1Gi / 4Gi |

- **Rolling updates:** web deploys with `maxUnavailable: 0`, and a PodDisruptionBudget keeps at least 1 web pod available, so releases cause no downtime for the web app.
- **Migrations:** an init container runs `prisma migrate deploy` before each web pod starts — no manual database step per release.
- **No serverless limits:** pods are long-running, so there are no function-duration, invocation, or monthly bandwidth quotas. The `maxDuration` exports in some API routes have no effect here.

### 2.2 Ingress Limits
- **Max request body:** `100m` (100 MB) per request.
- **Proxy read/send timeout:** `300` seconds. Any single request (e.g. an upload waiting on the AI service) must finish within 5 minutes.
- **TLS:** disabled in the chart (`ingress.tls.enabled: false`); HTTPS is expected to be terminated in front of the cluster.

### 2.3 Background Work Inside the Web Pods
- **Daily cleanup:** the app schedules it itself (`lib/cleanup-scheduler.ts`) — 00:00 Asia/Bangkok by default, adjustable by the Super Admin in the dashboard. It deletes events past their `expiresAt` date (Cloudinary folder + database rows) and purges audit logs older than 90 days. Only one web pod runs each day's cleanup, and a run missed during downtime is caught up on the next start.
- **AI processing queue:** each web pod keeps its own in-memory queue that sends up to **2 photos at a time** to the AI service. Photos still pending when a pod restarts are re-queued from the database on startup; failed photos can be retried from the app.

---

## 3. Database: PostgreSQL with pgvector (In-Cluster)

The database runs as the `photofinder-postgres` StatefulSet in the `mfu-apps-prod` namespace. Helm never creates or deletes it; production preflight fails if it is missing or not Ready.

### 3.1 Storage & Vector Capacity
- **Face Embedding (`vector(512)`):** 512 float32 values = **2,048 bytes**; with row overhead and the HNSW index, estimate **~3 KB per Face row**.
- **Photo Row:** ~1 KB (URLs, metadata, timestamps, foreign keys).
- **Per photo (avg. 3 faces):** 1 KB + 3 × 3 KB ≈ **~10 KB**.
- **Example:** 1 GB of database space ≈ **~100,000 photos (~300,000 faces)**.
- **Actual limit:** the size of PVC `pgdata-photofinder-postgres-0`. Check it with `kubectl -n mfu-apps-prod get pvc pgdata-photofinder-postgres-0`. Cloudinary storage (Section 5) fills up long before the database does.

### 3.2 Compute & Connections
- There are **no compute-hour quotas** and no scale-to-zero cold starts; the database is always on.
- Face searches use the HNSW index `faces_embedding_idx` (`vector_cosine_ops`), created by migration `20260426090000_faces_embedding_hnsw_index`.
- Each web pod uses its own `pg` connection pool through `@prisma/adapter-pg`. Very large bursts of simultaneous face searches are limited by the database pod's CPU.

### 3.3 Backups
Backups are **not** part of the Helm chart. Confirm with the server administrator how the PVC is backed up before relying on it for recovery.

---

## 4. AI Service (In-Cluster, CPU)

The Python service runs `insightface` (`buffalo_l`) with `onnxruntime` on CPU. The model files are baked into the Docker image, so a pod starts without downloading them.

- **No sleep cycle:** the pod stays running. A cold start only happens when the pod restarts (readiness probe allows ~20 s before traffic).
- **Inference speed (estimate):** about **0.5–1.5 seconds per photo** for detection + 512-dim embedding on CPU.
- **Throughput:** 2 web pods × 2 concurrent jobs = up to **4 photos in flight**, all served by **1 AI replica** (single uvicorn worker), so the AI pod is the processing bottleneck. 500 photos take roughly **4–13 minutes**.
- **Timeout:** the web app aborts a single AI call after **45 seconds** (`lib/ai.ts`).
- **Memory:** model load uses ~300–500 MB; the 4 Gi limit leaves plenty of headroom.

---

## 5. Cloudinary (Image Storage & Delivery)

Cloudinary uses a **credit** system. The free tier provides **25 credits per month**.
- **1 Credit** = 1,000 Transformations **OR** 1 GB Managed Storage **OR** 1 GB Net Viewing Bandwidth.

Credits are shared across storage, bandwidth, and transformations, so the practical limit depends on how the app is used.

### 5.1 Storage Capacity
If we allocate **10 credits (~40%)** to storage:
- **Available Storage:** 10 GB
- **Average Photo Size:** uploads are resized to max 2048px and converted to WebP (quality 85), averaging **~500 KB to 1 MB per photo**.
- **Maximum Photos in Storage:** 10 GB / ~750 KB ≈ **13,000 to 15,000 photos at any one time.**

> **Note:** The daily cleanup (Section 2.3) is the main way storage is recycled, so event expiration dates should stay conservative.

### 5.2 Viewing Bandwidth
If we allocate **10 credits (~40%)** to bandwidth:
- **Available Bandwidth:** 10 GB per month
- **Average User Session:** ~50 thumbnails (50 × 50 KB = 2.5 MB) + ~5 full-res downloads (5 × 2 MB = 10 MB) ≈ **12.5 MB**.
- **Maximum User Sessions:** 10 GB / 12.5 MB ≈ **800 viewing sessions per month.**

### 5.3 Transformations (Resizing/Cropping)
If we allocate **5 credits (~20%)** to transformations:
- **Available Transformations:** 5,000 per month
- Each uploaded photo may use 1 transformation for its thumbnail.
- **Maximum New Uploads:** **~5,000 photos per month.**

`next.config.mjs` sets `images: { unoptimized: true }`, so all image resizing is done by Cloudinary, not by Next.js.

### ☁️ Cloudinary Bottleneck Summary (Free Tier)
| Metric | Limit |
| :--- | :--- |
| Max Photos in Storage | ~13,000–15,000 |
| Max New Uploads/Month | ~5,000 (transformation-limited) |
| Max User Viewing Sessions/Month | ~800 |
| **Hard Limit** | Once 25 credits are exhausted, uploads and image delivery fail. Cloudinary may allow a short grace period before requiring an upgrade. |

---

## 6. Maximum Safe Usage (Current Setup)

| Metric | Maximum Safe Limit | Bottleneck Reason |
| :--- | :--- | :--- |
| **Photos per Event** | **~1,000 to 2,000 photos** | Cloudinary credits (storage + transformations). |
| **Total Photos Stored** | **~13,000 to 15,000 photos** | Cloudinary 10 GB storage allocation. |
| **New Uploads/Month** | **~5,000 photos** | Cloudinary transformations. |
| **Active Users/Month** | **~500 to 800 students** | Cloudinary bandwidth (viewing/downloading). |
| **Photo Processing Rate** | **~40–120 photos/minute** | Single CPU AI replica. |
| **Single Request Size / Time** | **100 MB / 300 s** | Ingress limits. |
| **Database** | **Far above Cloudinary limits** | Limited only by the PVC size. |

---

## 7. How to Scale (When Limits Are Reached)

### 7.1 Cloudinary (Most Likely First Bottleneck)
- **Upgrade to:** "Plus" plan — **$89/mo** (annual) or **$99/mo** (monthly) for **225 credits**.
- **Capacity:** ~45,000 photo uploads/month, ~225 GB combined storage + bandwidth.
- **Alternative:** move photo storage to university-hosted object storage to remove the credit limits entirely.

### 7.2 AI Processing
- Raise `ai.replicas` and/or `ai.resources.limits.cpu` in `deploy/values/prod.yaml`. More AI replicas let the web pods' queues run in parallel.
- The per-pod queue concurrency (`concurrencyLimit` in `lib/ai-queue.ts`, currently 2) can be raised once the AI service has more CPU.

### 7.3 Web App
- Raise `web.replicas` for more concurrent users. Each extra pod adds its own AI queue and database pool, so scale the AI service and database CPU with it.

### 7.4 Database
- Expand the PVC (if the storage class allows it) or move to a larger volume with the server administrator. No paid upgrade is involved.

### 💰 Cost Summary
Everything except Cloudinary runs on university infrastructure at no per-usage cost. The first paid step, if needed, is **Cloudinary Plus (~$89–99/mo)**.
