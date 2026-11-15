FROM python:3.11-slim-bookworm

# Install only runtime libraries; Python wheels no longer require a compiler.
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgles2 \
    libegl1 \
    libdbus-1-3 \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -u 1000 user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

# Install python dependencies system-wide for reliability
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade \
        "wheel>=0.46.2" \
        "jaraco.context>=6.1.0" \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=user:user . .

# Ensure app directory and home are owned by user
RUN chown -R user:user $HOME

USER user

# Ensure face_landmarker.task exists (fallback download only if missing from git)
RUN if [ ! -s face_landmarker.task ]; then \
        python -c "import urllib.request; urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', 'face_landmarker.task')"; \
    fi

# Pre-cache the InsightFace model so production startup does not depend on the
# public model host.
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']).prepare(ctx_id=-1)"

EXPOSE 7860

CMD ["python", "main.py"]
