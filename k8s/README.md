# PhotoFinder Kubernetes (K8s) Deployment & Bot Guide

This directory contains production-ready Kubernetes manifests designed to deploy PhotoFinder across an isolated namespace (`photofinder`) with automatic service discovery.

---

## Architecture in Kubernetes

- **Namespace**: `photofinder`
- **Database (`postgres`)**: StatefulSet with `ankane/pgvector:v0.5.1` and 10Gi PersistentVolumeClaim. Exposes port `5432` internally (`postgres.photofinder.svc.cluster.local`).
- **AI Microservice (`ai-service`)**: Python FastAPI container for facial embeddings and liveness. Exposes port `7860` (`ai-service.photofinder.svc.cluster.local`).
- **Web Application (`web`)**: Next.js App Router full-stack web and API service. Connected to Postgres and AI service via DNS. Exposes port `3000` (NodePort `30080` & Ingress).

---

## 🚀 Quick Deployment

### Step 1: Deploy all resources
```bash
kubectl apply -k k8s/
```
Or individually:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/ai-service.yaml
kubectl apply -f k8s/web.yaml
kubectl apply -f k8s/ingress.yaml
```

### Step 2: Check status
```bash
kubectl get pods -n photofinder -w
kubectl get svc -n photofinder
```

---

## 🤖 MFU Drive / Google Drive Ingestion Bot

The bot at `scripts/drive_ingestion_bot.py` allows photographers or automated systems to drop photos into a Google Drive / MFU Cloud Drive folder and have them automatically uploaded and face-indexed in PhotoFinder.

### One-shot sync:
```bash
python scripts/drive_ingestion_bot.py \
  --dir "D:/MFU_Drive/Event_Photos" \
  --event-id "<EVENT_UUID>" \
  --api-url "http://localhost:3000" \
  --token "<PHOTOGRAPHER_JWT_TOKEN>"
```

### Continuous watch mode (auto-sync when new photos arrive):
```bash
python scripts/drive_ingestion_bot.py \
  --dir "D:/MFU_Drive/Event_Photos" \
  --event-id "<EVENT_UUID>" \
  --api-url "http://localhost:3000" \
  --token "<PHOTOGRAPHER_JWT_TOKEN>" \
  --watch \
  --interval 15
```
