# PhotoFinder — Infrastructure & Server Specification

This document defines the complete infrastructure, hardware, network, and operational requirements for deploying and self-hosting the **PhotoFinder** application on an organization or institutional server.

---

## 1. Executive Summary

* **Application Name:** PhotoFinder (AI-Powered Event Photo Retrieval Platform)
* **Architecture:** 3-tier containerized stack (Next.js Full-Stack App + Python AI Face Recognition Engine + PostgreSQL with `pgvector`)
* **Deployment Model:** Docker Compose on Linux Host
* **GPU Requirement:** **None (0 GPU required)** — All facial detection, embedding extraction, and cosine similarity searches are CPU-optimized.

---

## 2. Server Hardware Specifications

| Resource | Minimum Requirement | Recommended Specification | Notes |
| :--- | :--- | :--- | :--- |
| **Architecture** | x86_64 or ARM64 | x86_64 (Intel Xeon / AMD EPYC) or ARM64 (Apple Silicon / AWS Graviton) | Modern 64-bit multi-core CPU. |
| **CPU / vCPU** | **4 vCPUs** | **8 vCPUs** | Multi-threaded CPU for concurrent face vector calculations. |
| **GPU** | **None (0)** | **None (0)** | InsightFace & MediaPipe use CPU ONNX Runtime with `CPUExecutionProvider`. |
| **System Memory (RAM)** | **8 GB** | **16 GB** | AI microservice uses ~500 MB; PostgreSQL & Next.js consume ~1–2 GB. |
| **Disk Storage** | **50 GB SSD** | **100 GB – 200 GB SSD/NVMe** | Container images take ~3 GB; remainder stores PostgreSQL vectors and cached assets. |
| **Operating System** | Linux 64-bit | **Ubuntu 22.04 LTS / 24.04 LTS** or **Debian 12** | Standard enterprise Linux server. |

### Current CPU Allocation Breakdown by Component

| Service / Container | Role | Current CPU Allocation | Usage Behavior |
| :--- | :--- | :---: | :--- |
| **`photofinder_ai`** | Face Detection & Vector Extraction | **2.0 vCPUs** | Active during photo uploads & selfie verification (0.5s–1.5s per image). |
| **`photofinder_postgres`** | Database & Vector Cosine Matching | **0.25 – 2.0 vCPUs** | Scales to 0.25 vCPU when idle; scales up to 2.0 vCPUs during burst vector queries. |
| **`photofinder_web`** | Next.js UI & Backend APIs | **1.0 – 2.0 vCPUs** | Serves web traffic and API routes on demand. |
| **Total System Capacity** | — | **~4.25 – 6.0 vCPUs** | Total maximum capacity across all services. |

---

## 3. Network & Firewall Configuration

### Inbound Firewall Rules

| Port | Protocol | Scope | Purpose |
| :--- | :--- | :--- | :--- |
| **443** | TCP (HTTPS) | **Public / Campus Intranet** | Main application traffic (Students, Photographers, Admins). |
| **80** | TCP (HTTP) | **Public / Campus Intranet** | Automatic HTTP-to-HTTPS redirect via Nginx reverse proxy. |
| **22** | TCP (SSH) | **Restricted / Admin VPN** | Secure remote server management. |
| **3000, 7860, 5432** | TCP | **Internal Only (Block from Internet)** | Private container-to-container communication on Docker network. |

### Domain & DNS
* **Subdomain Requirement:** A standard DNS `A Record` pointing your domain (e.g., `photofinder.your-org.ac.th`) to the server's public IP.
* **SSL/TLS Certificate:** Automated via Let's Encrypt / Certbot or an institutional wildcard certificate.

---

## 4. Software Prerequisites on Host Server

The host machine only requires standard container runtime software:

1. **Docker Engine:** Version `24.0+`
2. **Docker Compose:** Version `2.20+` (Compose V2)
3. **Nginx:** For reverse proxying, SSL termination, and static asset caching
4. **Certbot:** For automated SSL certificate renewal

---

## 5. Container Services & Data Flow

### The 3 Docker Containers

| Container Name | Role | Technology | Internal Port |
| :--- | :--- | :--- | :---: |
| **`photofinder_web`** | **Frontend UI & Backend API:** Serves student gallery, handles Google login, photographer uploads, and API routing. | Next.js 14 / Node.js 20 | `3000` |
| **`photofinder_ai`** | **Face Recognition Engine:** Detects faces, generates 512-d vector embeddings, checks live selfies, and blurs faces. | Python 3.10 / FastAPI / InsightFace | `7860` |
| **`photofinder_postgres`** | **Vector Database:** Stores user accounts, events, and 512-d face vectors with HNSW indexing for <10ms searches. | PostgreSQL 16 + `pgvector` | `5432` |

---

### How Requests Flow (4-Step Pipeline)

1. **User Request:** Users access the platform securely via HTTPS (`:443`). Nginx on the host terminates SSL and forwards requests internally to `photofinder_web` (`:3000`).
2. **AI Face Extraction:** When a photo or selfie is uploaded, `photofinder_web` sends the image to `photofinder_ai` (`:7860`) to detect faces and extract 512-dimensional vector fingerprints.
3. **Vector Similarity Matching:** `photofinder_web` queries `photofinder_postgres` (`:5432`) to find matching student face vectors using the HNSW index.
4. **Display Results:** The matching photos are instantly returned and displayed in the user's private gallery.

---

## 6. Environment Configuration Reference (`.env`)

```env
# --- 1. Database Configuration ---
DATABASE_URL="postgresql://photofinder:your_strong_password@postgres:5432/photofinder_db"
DIRECT_URL="postgresql://photofinder:your_strong_password@postgres:5432/photofinder_db"

# --- 2. Security & Authentication ---
JWT_SECRET="generate_a_long_random_64_char_secret_string"
SUPER_ADMIN_EMAIL="admin.lead@your-org.ac.th"
CRON_SECRET="generate_a_secure_cron_token"

# --- 3. Google OAuth Credentials ---
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# --- 4. Cloud Image Storage ---
CLOUDINARY_URL="cloudinary://api_key:api_secret@cloud_name"

# --- 5. AI Face Microservice URL ---
AI_SERVICE_URL="http://ai-service:7860"

# --- 6. Application URLs ---
NEXT_PUBLIC_API_URL="/api"
APP_URL="https://photofinder.your-org.ac.th"
NEXT_PUBLIC_APP_URL="https://photofinder.your-org.ac.th"

# --- 7. AI Chatbot (Optional) ---
GROQ_API_KEY="gsk_your_groq_api_key"

# --- 8. Notifications (Optional) ---
GMAIL_USER="notifications@your-org.ac.th"
GMAIL_APP_PASSWORD="your_google_app_password"
LINE_CHANNEL_ID="your_line_channel_id"
LINE_CHANNEL_SECRET="your_line_channel_secret"
LINE_CHANNEL_ACCESS_TOKEN="your_line_token"
LINE_REDIRECT_URI="https://photofinder.your-org.ac.th/api/auth/line/callback"
```

---

## 7. Operational & Maintenance Procedures

### 1. Starting / Restarting Services
```bash
# Start all containers in the background with auto-restart
docker compose up -d

# Check live running status
docker compose ps

# View live logs
docker compose logs -f
```

### 2. Database Migrations & Updates
```bash
# Apply Prisma migrations inside the running web container
docker compose exec web npx prisma migrate deploy
```

### 3. Automated Daily Cleanup Cron
Add a root cron job (`crontab -e`) to trigger event retention cleanup daily:
```bash
15 17 * * * curl -s http://localhost:3000/api/cron/cleanup -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null
```

### 4. Automated Database Backup
Add a daily database dump cron job (`crontab -e`) at 02:00 AM:
```bash
0 2 * * * docker exec photofinder_postgres pg_dump -U photofinder photofinder_db > /backup/photofinder_$(date +\%F).sql
```

---

## 8. Data Privacy & Compliance (PDPA / GDPR)

1. **Biometric Data Protection:** Facial vectors are stored as mathematical float32 arrays (512 dimensions) rather than raw facial images.
2. **Right to Erasure:** Students have self-service tools to immediately delete their reference selfie and all associated vector embeddings from the database.
3. **Face Blurring:** Integrated OpenCV blurring allows event attendees to obscure their faces in public event albums without removing the entire photograph.
4. **Data Retention Policy:** Events automatically expire after their `expiresAt` date, initiating a cascading wipe of all associated photos, faces, and vectors.
