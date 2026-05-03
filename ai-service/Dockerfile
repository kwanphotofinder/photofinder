FROM python:3.10-slim

# Install system dependencies for OpenCV, InsightFace, MediaPipe, and wget
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgles2 \
    libegl1 \
    libdbus-1-3 \
    gcc \
    g++ \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -u 1000 user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Set working directory for the app
WORKDIR $HOME/app

USER user

# Copy requirements and install
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=user . .

# Download InsightFace models during build using CPU-only runtime settings
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']).prepare(ctx_id=-1)"

# Download MediaPipe face landmarker model
RUN wget -q -O face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

EXPOSE 7860

CMD ["python", "main.py"]
