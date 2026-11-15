FROM python:3.10-slim

# Install system dependencies for OpenCV, InsightFace, MediaPipe, and wget
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgles2 \
    libegl1 \
    libdbus-1-3 \
    build-essential \
    python3-dev \
    gcc \
    g++ \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -u 1000 user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

# Install python dependencies system-wide for reliability
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=user:user . .

# Ensure app directory and home are owned by user
RUN chown -R user:user $HOME

USER user

# Ensure face_landmarker.task exists (fallback download only if missing from git)
RUN if [ ! -s face_landmarker.task ]; then \
        wget -q -O face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task || true; \
    fi

# Attempt to pre-cache InsightFace model during build (CPU mode), but allow fallback to runtime if network is restricted
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']).prepare(ctx_id=-1)" || true

EXPOSE 7860

CMD ["python", "main.py"]
