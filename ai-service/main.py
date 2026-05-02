import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from typing import List
import io
from PIL import Image
import os
<<<<<<< HEAD
from services.liveness import FaceMeshLiveness

=======
from services.face_blur import blur_faces
from services.liveness import FaceMeshLiveness

# Handle potential import errors for optional dependencies
>>>>>>> 70ff4b2dad23371dba994beb07dfb8a588f16228
try:
    from insightface.app import FaceAnalysis
except Exception as e:
    print(f"Warning: InsightFace is unavailable: {e}")
    FaceAnalysis = None

try:
    from prometheus_fastapi_instrumentator import Instrumentator
except Exception as e:
    print(f"Warning: Prometheus instrumentation is unavailable: {e}")
    Instrumentator = None

app = FastAPI(title="Face Search AI Service")

# Initialize Prometheus metrics
if Instrumentator is not None:
    Instrumentator().instrument(app).expose(app)

# Initialize InsightFace when available.
# 'buffalo_l' is a good balance of speed and accuracy
model = None
if FaceAnalysis is not None:
<<<<<<< HEAD
    model = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    model.prepare(ctx_id=0, det_size=(640, 640))

# Initialize FaceMeshLiveness for liveness detection
try:
    liveness_detector = FaceMeshLiveness(model_path="ai-service/face_landmarker.task")
=======
    try:
        model = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        model.prepare(ctx_id=0, det_size=(640, 640))
    except Exception as e:
        print(f"Warning: Could not initialize InsightFace: {e}")

# Initialize FaceMeshLiveness for liveness detection
try:
    liveness_detector = FaceMeshLiveness()
>>>>>>> 70ff4b2dad23371dba994beb07dfb8a588f16228
except Exception as e:
    print(f"Warning: Could not initialize FaceMeshLiveness: {e}")
    liveness_detector = None

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
        if model is None:
            return []

        # Read image file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return []

        if model is None:
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
        print(f"Error processing image: {str(e)}")
        return []

<<<<<<< HEAD

@app.post("/liveness/detect")
async def detect_liveness(file: UploadFile = File(...)):
    """
    Detect liveness indicators (blink, head turn, head up/down) from a frame.
    Returns JSON with liveness detection results.
    """
    try:
        if liveness_detector is None:
            return {
                "face_detected": False,
                "blink": False,
                "head_turn": False,
                "head_up": False,
                "head_down": False,
                "confidence": 0.0,
                "error": "Liveness detector not initialized"
            }

        # Read image file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {
                "face_detected": False,
                "blink": False,
                "head_turn": False,
                "head_up": False,
                "head_down": False,
                "confidence": 0.0,
            }

        # Process frame with liveness detection
        result = liveness_detector.process_frame(img)

        if not result.face_landmarks or len(result.face_landmarks) == 0:
            return {
                "face_detected": False,
                "blink": False,
                "head_turn": False,
                "head_up": False,
                "head_down": False,
                "confidence": 0.0,
            }

        # Extract landmarks for first detected face
        face_landmarks = result.face_landmarks[0]
        h, w, _ = img.shape
        
        # Convert normalized landmarks to pixel coordinates
        landmark_points = np.array([(pt.x, pt.y, pt.z) for pt in face_landmarks])

        # Landmark indices (MediaPipe 468-point model)
        LEFT_EYE_IDX = [33, 160, 158, 133, 153, 144]
        RIGHT_EYE_IDX = [362, 385, 387, 263, 373, 380]
        LEFT_CHEEK_IDX = 234
        RIGHT_CHEEK_IDX = 454
        NOSE_IDX = 1
        CHIN_IDX = 152

        # Extract x,y coordinates only for liveness checks
        landmark_xy = landmark_points[:, :2]

        # Perform liveness checks
        blink = liveness_detector.detect_blink(landmark_xy, LEFT_EYE_IDX, RIGHT_EYE_IDX)
        head_turn = liveness_detector.detect_head_turn(landmark_xy, LEFT_CHEEK_IDX, RIGHT_CHEEK_IDX, NOSE_IDX)
        head_up = liveness_detector.is_head_up(landmark_xy, NOSE_IDX, LEFT_EYE_IDX[0], RIGHT_EYE_IDX[0], CHIN_IDX)
        head_down = liveness_detector.is_head_down(landmark_xy, NOSE_IDX, LEFT_EYE_IDX[0], RIGHT_EYE_IDX[0], CHIN_IDX)

        # Calculate confidence (use face detection confidence or default to high value)
        confidence = 0.85

        return {
            "face_detected": True,
            "blink": bool(blink),
            "head_turn": bool(head_turn),
            "head_up": bool(head_up),
            "head_down": bool(head_down),
            "confidence": float(confidence),
        }

    except Exception as e:
        print(f"Error in liveness detection: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "face_detected": False,
            "blink": False,
            "head_turn": False,
            "head_up": False,
            "head_down": False,
            "confidence": 0.0,
            "error": str(e)
        }

=======
@app.post("/blur")
async def blur_image(file: UploadFile = File(...), bboxes: str = ""):
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
    try:
        if liveness_detector is None:
            raise HTTPException(status_code=503, detail="Liveness detector not initialized")
            
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
    try:
        if model is None:
            raise HTTPException(status_code=503, detail="Face comparison model not initialized")

        def get_emb(f):
            img = cv2.imdecode(np.frombuffer(f, np.uint8), cv2.IMREAD_COLOR)
            faces = model.get(img)
            return faces[0].embedding if faces else None

        emb1 = get_emb(await file1.read())
        emb2 = get_emb(await file2.read())
        
        if emb1 is None or emb2 is None:
            return {"match": False, "score": 0.0, "error": "No face detected in one or both images"}
            
        sim = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        return {"match": bool(sim > 0.6), "score": float(sim)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
>>>>>>> 70ff4b2dad23371dba994beb07dfb8a588f16228

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
