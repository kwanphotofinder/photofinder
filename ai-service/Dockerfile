FROM python:3.10-slim AS runtime

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
# Keep large binary dependency groups in separate registry layers. The MFU
# registry proxy rejects a single oversized blob even when the complete image
# is within the project quota.
RUN sed -n '1,5p' requirements.txt > /tmp/requirements-core.txt \
    && pip install --no-cache-dir -r /tmp/requirements-core.txt \
    && rm /tmp/requirements-core.txt
RUN sed -n '6,7p' requirements.txt > /tmp/requirements-face.txt \
    && pip install --no-cache-dir -r /tmp/requirements-face.txt \
    && rm /tmp/requirements-face.txt
RUN sed -n '8,10p' requirements.txt > /tmp/requirements-media.txt \
    && pip install --no-cache-dir -r /tmp/requirements-media.txt \
    && rm /tmp/requirements-media.txt

# Copy application code
COPY --chown=user:user . .

# Ensure app directory and home are owned by user
RUN chown -R user:user $HOME

USER user

# Ensure face_landmarker.task exists (fallback download only if missing from git)
RUN if [ ! -s face_landmarker.task ]; then \
        wget -q -O face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task || true; \
    fi

# Download the model in a throwaway stage. The final stage copies each model
# file separately so Harbor never receives the complete model as one blob.
FROM runtime AS model-cache
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']).prepare(ctx_id=-1)"

FROM runtime AS final
COPY --from=model-cache --chown=user:user /home/user/.insightface/models/buffalo_l/1k3d68.onnx /home/user/.insightface/models/buffalo_l/1k3d68.onnx
COPY --from=model-cache --chown=user:user /home/user/.insightface/models/buffalo_l/2d106det.onnx /home/user/.insightface/models/buffalo_l/2d106det.onnx
COPY --from=model-cache --chown=user:user /home/user/.insightface/models/buffalo_l/det_10g.onnx /home/user/.insightface/models/buffalo_l/det_10g.onnx
COPY --from=model-cache --chown=user:user /home/user/.insightface/models/buffalo_l/genderage.onnx /home/user/.insightface/models/buffalo_l/genderage.onnx
COPY --from=model-cache --chown=user:user /home/user/.insightface/models/buffalo_l/w600k_r50.onnx /home/user/.insightface/models/buffalo_l/w600k_r50.onnx

EXPOSE 7860

CMD ["python", "main.py"]
