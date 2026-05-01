import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List
import io
from PIL import Image
from prometheus_fastapi_instrumentator import Instrumentator
import os
from services.face_blur import blur_faces
from services.liveness import FaceMeshLiveness

app = FastAPI(title="Face Search AI Service")

# Initialize Prometheus metrics
Instrumentator().instrument(app).expose(app)

# Initialize InsightFace
# 'buffalo_l' is a good balance of speed and accuracy
model = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
model.prepare(ctx_id=0, det_size=(640, 640))

# Initialize Liveness Detector
liveness_detector = FaceMeshLiveness()

class FaceEmbedding(BaseModel):
    embedding: List[float]
    bbox: List[int]
    face_width: int
    face_height: int
    face_center_x: int
    face_center_y: int
    det_score: float

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Face Search AI"}

@app.post("/extract", response_model=List[FaceEmbedding])
async def extract_faces(file: UploadFile = File(...)):
    try:
        # Read image file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            # Return empty array instead of error - image can't be decoded
            return []

        # Detect faces
        faces = model.get(img)
        
        results = []
        for face in faces:
            x1, y1, x2, y2 = face.bbox.astype(int).tolist()
            face_width = max(0, x2 - x1)
            face_height = max(0, y2 - y1)
            face_center_x = x1 + (face_width // 2)
            face_center_y = y1 + (face_height // 2)

            results.append({
                "embedding": face.embedding.tolist(),
                "bbox": [x1, y1, x2, y2],
                "face_width": face_width,
                "face_height": face_height,
                "face_center_x": face_center_x,
                "face_center_y": face_center_y,
                "det_score": float(face.det_score)
            })
            
        return results

    except Exception as e:
        # Log the error but return empty array
        print(f"Error processing image: {str(e)}")
        return []

@app.post("/blur")
async def blur_image(file: UploadFile = File(...), bboxes: str = ""):
    """
    Blur specific faces in an image based on bboxes (x,y,w,h string).
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None: raise HTTPException(status_code=400, detail="Invalid image")
        if not bboxes: return io.BytesIO(contents).getvalue()
        
        coords = [int(x) for x in bboxes.split(",")]
        bbox_list = [coords[i:i+4] for i in range(0, len(coords), 4)]
        blurred_img = blur_faces(img, bbox_list)
        _, buffer = cv2.imencode(".jpg", blurred_img)
        return io.BytesIO(buffer).getvalue()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/liveness")
async def check_liveness(file: UploadFile = File(...)):
    """
    Returns landmarks and pose data for an image.
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None: raise HTTPException(status_code=400, detail="Invalid image")
        
        results = liveness_detector.process_frame(img)
        response_data = []
        if results.face_landmarks:
            for face_landmarks in results.face_landmarks:
                landmarks = [{"x": pt.x, "y": pt.y, "z": pt.z} for pt in face_landmarks]
                response_data.append({"landmarks": landmarks})
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/compare")
async def compare_faces(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """
    Compares two faces and returns a similarity score.
    """
    try:
        # Extract embeddings for both
        def get_emb(f):
            img = cv2.imdecode(np.frombuffer(f, np.uint8), cv2.IMREAD_COLOR)
            faces = model.get(img)
            return faces[0].embedding if faces else None

        emb1 = get_emb(await file1.read())
        emb2 = get_emb(await file2.read())
        
        if emb1 is None or emb2 is None:
            return {"match": False, "score": 0.0, "error": "No face detected in one or both images"}
            
        # Calculate cosine similarity
        sim = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        return {"match": bool(sim > 0.6), "score": float(sim)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
