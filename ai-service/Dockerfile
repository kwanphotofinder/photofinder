FROM python:3.10-slim

# Install system dependencies for OpenCV and InsightFace
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user to match Hugging Face Spaces requirements
RUN useradd -m -u 1000 user

USER user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy requirements and install
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Face Landmarker model (so we don't have to push the binary to Git)
RUN apt-get update && apt-get install -y wget && \
    wget -O face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task && \
    apt-get remove -y wget && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY --chown=user . .

# Download InsightFace models during build
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l').prepare(ctx_id=0)"

EXPOSE 7860

CMD ["python", "main.py"]
