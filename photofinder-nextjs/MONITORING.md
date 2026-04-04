# Photo Finder System Monitoring

## 📊 1. Production Monitoring (Lightweight & Cost-Effective)

To save resources and avoid exceeding free-tier limits on hosting platforms, heavy monitoring tools like Grafana and Prometheus are **disabled in production**.

Instead, the system relies on a custom-built, lightweight monitoring solution integrated directly into the Next.js app:

* **Admin Dashboard (System Health):** Access this by logging in as an Admin and navigating to `/admin/dashboard` -> "System Health" tab.
* **Live API Endpoints:**
  * `/api/admin/stats`: Queries the PostgreSQL database in real-time to return aggregations of Users, Events, Photos, Faces, and Processing Statuses.
  * `/api/metrics/json`: A Prometheus-style JSON endpoint that calculates live AI metrics, such as the `ai_confidence_score` (the average detection confidence of all faces in the database).

## 🚀 2. Local Advanced Monitoring (Prometheus + Grafana)

If you are load-testing locally or debugging the Python AI microservice, you can spin up the full containerized monitoring stack.

### Access Points
* **Grafana Dashboard:** `http://localhost:3001` (Credentials: `admin` / `admin`)
* **Prometheus UI:** `http://localhost:9090`
* **Next.js App Metrics:** `http://localhost:3000/api/metrics/json`
* **Local AI Microservice Metrics:** `http://localhost:8000/metrics` (FastAPI)

## 📈 3. Key Metrics & Example PromQL Queries

If you are building or modifying Grafana dashboards locally, you can use these queries:

**AI Model Confidence (Average):**
```promql
ai_confidence_score
```

**Average AI Processing Duration (FastAPI):**
```promql
rate(ai_processing_duration_seconds_sum[5m]) / rate(ai_processing_duration_seconds_count[5m])
```

**Failed Photo Uploads:**
```promql
sum(photo_uploads_total{status="failed"})
```

## ☁️ 4. External Third-Party Dashboards

For complete production visibility, you should periodically check the dashboards of your managed cloud providers:

1. **Neon DB (PostgreSQL):** Monitor compute usage, active database connections, and `pgvector` storage size.
2. **Cloudinary:** Track your monthly bandwidth for image delivery and total storage limits.
3. **Hugging Face Spaces (AI Service):** If using `kwanphotofinder-photofinder-ai.hf.space`, check the Space logs for Python errors, face detection timeouts, or container restarts.
4. **Vercel / Hosting:** Review serverless function execution times and error logs (e.g., 500 errors).
