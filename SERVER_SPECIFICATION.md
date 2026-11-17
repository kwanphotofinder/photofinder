# PhotoFinder — Infrastructure & Server Specification

This document describes how **PhotoFinder** runs in production on the MFU university Kubernetes cluster: its components, resources, network, configuration, and day-to-day operations. For the release pipeline itself, see [`deploy/README.md`](./deploy/README.md). For capacity estimates, see [`infrastructure-limits-and-usage.md`](./infrastructure-limits-and-usage.md).

---

## 1. Executive Summary

* **Application Name:** PhotoFinder (AI-Powered Event Photo Retrieval Platform)
* **Architecture:** Next.js full-stack app + Python AI face recognition service + PostgreSQL with `pgvector`; photos stored on Cloudinary
* **Deployment Model:** Kubernetes (Helm chart `deploy/helm/photofinder`), released by GitLab CI from the `production` branch
* **Public URL:** `photofinder.mfu.ac.th`
* **Namespace:** `mfu-apps-prod`
* **GPU Requirement:** **None** — face detection, embedding extraction, and vector search all run on CPU (`onnxruntime` `CPUExecutionProvider`).

---

## 2. Workloads & Resources

| Workload | Kind | Replicas | Image | Port | CPU request / limit | Memory request / limit |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **`photofinder-web`** | Deployment (Helm) | 2 | `hub-registry.mfu.ac.th/photofinder/web` (Node.js 22) | `3000` | 250m / 2 | 512Mi / 2Gi |
| **`photofinder-ai`** | Deployment (Helm) | 1 | `hub-registry.mfu.ac.th/photofinder/ai-service` (Python 3.11, FastAPI, InsightFace) | `7860` | 500m / 2 | 1Gi / 4Gi |
| **`photofinder-postgres`** | StatefulSet (**not** managed by Helm) | 1 | PostgreSQL + `pgvector` | `5432` | — | — |

* **Totals requested by the Helm chart:** 1.0 vCPU / 2 GiB; **limits:** 6 vCPU / 8 GiB (excluding PostgreSQL).
* **Database storage:** PVC `pgdata-photofinder-postgres-0`. The Service, StatefulSet, and PVC must stay in `mfu-apps-prod`; Helm never deletes or recreates them, and the deploy preflight fails if any is missing or the database pod is not Ready.
* **Images** are pulled from Harbor (`hub-registry.mfu.ac.th`) with the `harbor-registry` pull secret and deployed by digest.
* **Availability:** web rolls out with `maxUnavailable: 0` and `maxSurge: 1`; a PodDisruptionBudget keeps at least 1 web pod available.
* **Health checks:** both web and AI expose readiness and liveness probes on `GET /`.

---

## 3. Network

### Ingress
| Setting | Value |
| :--- | :--- |
| Host | `photofinder.mfu.ac.th` |
| Ingress class | `nginx` |
| Backend | `photofinder-web:3000` (the only public entry point) |
| Max request body | `100m` |
| Proxy read / send timeout | `300` seconds |
| TLS | Disabled in the chart; HTTPS is terminated in front of the cluster |

### Internal Traffic
* `photofinder-ai` and `photofinder-postgres` are reachable only inside the cluster.
* The web pods reach the AI service at `http://photofinder-ai:7860` (set by Helm).

### Outbound Traffic Required
| Destination | Purpose | Required? |
| :--- | :--- | :--- |
| Cloudinary API & CDN | Photo storage and delivery | Yes |
| Google OAuth (`accounts.google.com`, `oauth2.googleapis.com`) | Sign-in | Yes |
| Groq API (`api.groq.com`) | AI chatbot | Optional |
| Gmail SMTP / LINE API | Notifications | Optional |

---

## 4. Request Flow

1. **User request:** users open `https://photofinder.mfu.ac.th`; the nginx ingress forwards traffic to a `photofinder-web` pod.
2. **AI face extraction:** for uploads and selfies, the web pod sends the image to `photofinder-ai`, which detects faces and returns 512-dimensional embeddings. Photo uploads go through an in-memory queue in each web pod (up to 2 photos at a time per pod).
3. **Storage:** the optimized image (max 2048px, WebP) is stored on Cloudinary; photo metadata and face embeddings are stored in PostgreSQL.
4. **Vector matching:** face searches run in PostgreSQL using the HNSW index `faces_embedding_idx` (cosine distance).
5. **Results:** matching photos are returned and shown in the user's private gallery, served directly from Cloudinary's CDN.

---

## 5. Runtime Configuration

Production configuration lives in the Kubernetes secret **`photofinder-runtime`**, created or updated by the pipeline from the protected GitLab variable `RUNTIME_ENV_FILE_PROD` (or `RUNTIME_ENV_BASE64_PROD`). Values are never logged. See `deploy/README.md` for the full list of CI variables.

```env
# --- Required ---
DATABASE_URL="postgresql://<user>:<password>@photofinder-postgres:5432/<database>"
DIRECT_URL="postgresql://<user>:<password>@photofinder-postgres:5432/<database>"
JWT_SECRET="<long random secret>"
SUPER_ADMIN_EMAIL="<super admin email>"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="<id>.apps.googleusercontent.com"
GOOGLE_CLIENT_ID="<id>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<secret>"
CLOUDINARY_URL="cloudinary://<api_key>:<api_secret>@<cloud_name>"

# --- Optional ---
GROQ_API_KEY="gsk_..."                 # AI chatbot (disabled if empty)
GROQ_MODEL=""                          # chatbot model override
GMAIL_USER=""
GMAIL_APP_PASSWORD=""                  # email notifications
LINE_CHANNEL_ID=""
LINE_CHANNEL_SECRET=""
LINE_CHANNEL_ACCESS_TOKEN=""
LINE_REDIRECT_URI="https://photofinder.mfu.ac.th/api/auth/line/callback"
CRON_SECRET=""                         # only for running /api/cron/cleanup by hand
CLEANUP_SCHEDULER_ENABLED=""           # set "false" to disable the in-app daily cleanup
```

Set by Helm, **not** in the runtime file: `NODE_ENV=production`, `AI_SERVICE_URL`, `NEXT_PUBLIC_API_URL=/api`, `APP_URL`, `NEXT_PUBLIC_APP_URL`.

---

## 6. Operations

### Releases
1. Merge a feature branch into `develop` → the pipeline tests, builds both images once, and publishes a release manifest.
2. Merge `develop` into `production` → the pipeline deploys those exact images with Helm (atomic) and verifies the rollout at `photofinder.mfu.ac.th`.
3. **Database migrations** run automatically: an init container runs `prisma migrate deploy` before each web pod starts.
4. **Rollback** is a manual job in the GitLab pipeline (`helm rollback`).

Do not deploy by hand with `docker compose` or `kubectl apply` — production changes go through the pipeline.

### Useful Read-Only Commands
| Task | Command |
| :--- | :--- |
| Pod status | `kubectl -n mfu-apps-prod get pods` |
| Web logs | `kubectl -n mfu-apps-prod logs deploy/photofinder-web -f` |
| AI logs | `kubectl -n mfu-apps-prod logs deploy/photofinder-ai -f` |
| Release history | `helm -n mfu-apps-prod history photofinder` |
| Database volume | `kubectl -n mfu-apps-prod get pvc pgdata-photofinder-postgres-0` |
| Check `pgvector` | `kubectl -n mfu-apps-prod exec -it photofinder-postgres-0 -- psql -U <user> -d <database> -c "\dx"` |

### Automated Background Tasks
**Daily maintenance needs no server setup.** The web app runs it itself (`lib/cleanup-scheduler.ts`, started from `instrumentation.ts`): expired event cleanup plus the 90-day PDPA audit log purge. It runs daily at 00:00 Asia/Bangkok by default, and the Super Admin can change the time in the admin dashboard. Only one web pod runs each day's cleanup, and a run missed during downtime is caught up when the app starts. `/api/cron/cleanup` (with `CRON_SECRET`) remains available for manual runs.

### Backups
Database backups are **not** part of the Helm chart or the pipeline. Confirm with the cluster administrator how the `pgdata-photofinder-postgres-0` volume is backed up.

> ⚠️ **Data Safety Warning:** Never delete the `photofinder-postgres` StatefulSet or the `pgdata-photofinder-postgres-0` PVC. Deleting the PVC permanently erases all users, events, and face data.

---

## 7. Local Development

`docker-compose.yml` runs the same three components on a developer machine (`photofinder_postgres`, `photofinder_ai`, `photofinder_web`). It is for local development only, not for production. See [`README.md`](./README.md) for local setup.

---

## 8. Data Privacy & Compliance (PDPA / GDPR)

1. **Biometric Data Protection:** Facial vectors are stored as mathematical float32 arrays (512 dimensions) rather than raw facial images.
2. **Right to Erasure:** Students have self-service tools to immediately delete their reference selfie and all associated vector embeddings from the database.
3. **Face Blurring:** Integrated OpenCV blurring allows event attendees to obscure their faces in public event albums without removing the entire photograph.
4. **Event Data Retention Policy:** Events automatically expire after their `expiresAt` date, initiating a cascading wipe of all associated photos, faces, and vectors from Cloudinary and PostgreSQL.
5. **Audit Log Retention Policy:** Administrative and biometric activity logs are retained for **90 days** in compliance with PDPA accountability principles and are automatically purged by the daily cleanup.
