---
title: Face Search AI
emoji: 👁️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Face Search AI Service

This service runs InsightFace (ResNet50/Buffalo_L) to generate face embeddings for the PhotoFinder app.

## API Endpoints

- `GET /` - Health check
- `POST /extract` - Extract faces from an uploaded image file
