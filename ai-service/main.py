import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from typing import List
import io
from PIL import Image
import os
import time
import json
from typing import Dict, Optional
from services.face_blur import blur_faces
from services.liveness import FaceMeshLiveness

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
    model = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    model.prepare(ctx_id=-1, det_size=(640, 640))

# Initialize FaceMeshLiveness for liveness detection
try:
    liveness_detector = FaceMeshLiveness(model_path="face_landmarker.task")
except Exception as e:
    print(f"Warning: Could not initialize FaceMeshLiveness: {e}")
    liveness_detector = None


# Blink tracking is temporal (open -> closed -> open), so it needs state between
# frames. To stay correct when the AI service runs with multiple workers (where
# consecutive frames of one attempt may land on different worker processes), the
# state is NOT kept in server memory. Instead the client round-trips it: each
# /liveness/detect response returns the updated blink_state, and the browser sends
# it back with the next frame. The server still computes eyes-open from the real
# image every frame, so the sequence decision cannot be faked by the client.
EAR_CLOSED_THRESHOLD = 0.21  # Eye aspect ratio measured in pixel space
EAR_RELATIVE_CLOSED_RATIO = 0.7  # Closed when EAR drops 30% below the user's open-eye baseline
EAR_BASELINE_DECAY = 0.97


def _parse_blink_state(blink_state_json: Optional[str]) -> dict:
    """Return the client-provided blink state, or a fresh default."""
    default = {"prev_open": True, "closed_seen": False, "baseline": None}
    if not blink_state_json:
        return default
    try:
        parsed = json.loads(blink_state_json)
        if not isinstance(parsed, dict):
            return default
        baseline = parsed.get("baseline")
        return {
            "prev_open": bool(parsed.get("prev_open", True)),
            "closed_seen": bool(parsed.get("closed_seen", False)),
            "baseline": float(baseline) if isinstance(baseline, (int, float)) else None,
        }
    except (ValueError, TypeError):
        return default


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

            results.append(
                {
                    "embedding": face.embedding.tolist(),
                    "bbox": [x1, y1, x2, y2],
                    "face_width": face_width,
                    "face_height": face_height,
                    "face_center_x": face_center_x,
                    "face_center_y": face_center_y,
                    "det_score": float(face.det_score),
                }
            )

        return results

    except Exception as e:
        print(f"Error processing image: {str(e)}")
        return []


@app.post("/blur")
async def blur_image(file: UploadFile = File(...), bboxes: str = Form("")):
    try:
        print(f"\n[BLUR] === /blur endpoint called ===")
        print(f"[BLUR] Received bboxes string: '{bboxes}' (length: {len(bboxes)})")
        
        contents = await file.read()
        print(f"[BLUR] Received file: {len(contents)} bytes")
        
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Invalid image")
        
        print(f"[BLUR] Image decoded: {img.shape} (height={img.shape[0]}, width={img.shape[1]})")
        
        if not bboxes:
            print("[BLUR] WARNING: No bboxes provided, returning original image!")
            from fastapi import Response
            return Response(content=io.BytesIO(contents).getvalue(), media_type="image/jpeg")

        coords = [int(x) for x in bboxes.split(",")]
        bbox_list = [coords[i : i + 4] for i in range(0, len(coords), 4)]
        print(f"[BLUR] Parsed coords: {coords}")
        print(f"[BLUR] Bbox list (x,y,w,h): {bbox_list}")
        
        for bbox in bbox_list:
            x, y, w, h = bbox
            print(f"[BLUR] Face region: x={x}, y={y}, w={w}, h={h} -> covers pixels ({x},{y}) to ({x+w},{y+h})")
            print(f"[BLUR] Image is {img.shape[1]}x{img.shape[0]} - face region fits: {x+w <= img.shape[1] and y+h <= img.shape[0]}")
        
        blurred_img = blur_faces(img, bbox_list)
        _, buffer = cv2.imencode(".jpg", blurred_img)
        print(f"[BLUR] Blur complete. Output: {len(buffer)} bytes")
        
        from fastapi import Response
        return Response(content=io.BytesIO(buffer).getvalue(), media_type="image/jpeg")
    except Exception as e:
        print(f"[BLUR] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/compare")
async def compare_faces(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    try:
        from fastapi import HTTPException

        if model is None:
            raise HTTPException(
                status_code=503, detail="Face comparison model not initialized"
            )

        def get_emb(f):
            img = cv2.imdecode(np.frombuffer(f, np.uint8), cv2.IMREAD_COLOR)
            faces = model.get(img)
            return faces[0].embedding if faces else None

        emb1 = get_emb(await file1.read())
        emb2 = get_emb(await file2.read())

        if emb1 is None or emb2 is None:
            return {
                "match": False,
                "score": 0.0,
                "error": "No face detected in one or both images",
            }

        sim = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        return {"match": bool(sim > 0.6), "score": float(sim)}
    except Exception as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail=str(e))


@app.post("/test/face-landmarks")
async def test_face_landmarks(file: UploadFile = File(...)):
    """
    Test endpoint to diagnose face landmark detection.
    Returns diagnostic information about detected face landmarks.
    """
    try:
        print(f"\n[TEST] Diagnostic face landmark test for: {file.filename}")

        # Read image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"error": "Failed to decode image", "file_size": len(contents)}

        print(f"[TEST] Image decoded successfully. Shape: {img.shape}")

        if liveness_detector is None:
            return {"error": "Liveness detector not initialized"}

        # Process frame
        result = liveness_detector.process_frame(img)

        print(
            f"[TEST] Process frame returned. Face landmarks count: {len(result.face_landmarks) if result.face_landmarks else 0}"
        )

        if not result.face_landmarks or len(result.face_landmarks) == 0:
            return {
                "status": "no_face_detected",
                "message": "FaceLandmarker did not detect any faces",
                "image_shape": img.shape,
                "landmarks_count": 0,
            }

        face_landmarks = result.face_landmarks[0]
        landmark_points = np.array([(pt.x, pt.y, pt.z) for pt in face_landmarks])

        return {
            "status": "face_detected",
            "message": "FaceLandmarker successfully detected a face",
            "image_shape": img.shape,
            "landmarks_count": len(face_landmarks),
            "first_5_landmarks": landmark_points[:5].tolist(),
            "landmark_x_range": [
                float(landmark_points[:, 0].min()),
                float(landmark_points[:, 0].max()),
            ],
            "landmark_y_range": [
                float(landmark_points[:, 1].min()),
                float(landmark_points[:, 1].max()),
            ],
        }

    except Exception as e:
        print(f"[TEST] Error in diagnostic test: {str(e)}")
        import traceback

        traceback.print_exc()
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc(),
        }


@app.post("/liveness/detect")
async def detect_liveness(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    blink_state: Optional[str] = Form(None),
):
    """
    Detect liveness indicators (blink, head turn, head up/down) from a frame.
    Returns JSON with liveness detection results.
    """
    try:
        print(f"\n[LIVENESS] Request received for file: {file.filename}")

        if liveness_detector is None:
            print("[LIVENESS] ERROR: Liveness detector not initialized")
            return {
                "face_detected": False,
                "blink": False,
                "head_turn": False,
                "head_turn_direction": None,
                "head_up": False,
                "head_down": False,
                "confidence": 0.0,
                "error": "Liveness detector not initialized",
            }

        # Read image file
        contents = await file.read()
        print(f"[LIVENESS] File size: {len(contents)} bytes")
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            print("[LIVENESS] ERROR: Failed to decode image")
            return {
                "face_detected": False,
                "blink": False,
                "head_turn": False,
                "head_turn_direction": None,
                "head_up": False,
                "head_down": False,
                "confidence": 0.0,
            }

        print(f"[LIVENESS] Image shape: {img.shape}")

        # Process frame with liveness detection
        print("[LIVENESS] Processing frame with FaceLandmarker...")
        result = liveness_detector.process_frame(img)
        print(
            f"[LIVENESS] FaceLandmarker result: face_landmarks count = {len(result.face_landmarks) if result.face_landmarks else 0}"
        )

        if not result.face_landmarks or len(result.face_landmarks) == 0:
            print("[LIVENESS] No face landmarks detected")
            return {
                "face_detected": False,
                "blink": False,
                "head_turn": False,
                "head_turn_direction": None,
                "head_up": False,
                "head_down": False,
                "confidence": 0.0,
            }

        # Extract landmarks for first detected face
        face_landmarks = result.face_landmarks[0]
        h, w, _ = img.shape

        # Convert normalized landmarks to pixel coordinates
        landmark_points = np.array([(pt.x, pt.y, pt.z) for pt in face_landmarks])
        print(
            f"[LIVENESS] Face detected! Landmark points shape: {landmark_points.shape}"
        )
        print(f"[LIVENESS] Landmark point examples (first 5): {landmark_points[:5]}")

        # Landmark indices (MediaPipe 468-point model)
        LEFT_EYE_IDX = [33, 160, 158, 133, 153, 144]
        RIGHT_EYE_IDX = [362, 385, 387, 263, 373, 380]
        LEFT_CHEEK_IDX = 234
        RIGHT_CHEEK_IDX = 454
        NOSE_IDX = 1
        CHIN_IDX = 152

        # Extract x,y coordinates only for liveness checks
        landmark_xy = landmark_points[:, :2]
        # Landmarks are normalized separately by width and height. Measure eye
        # shape in pixels so the EAR does not change with landscape/portrait frames.
        landmark_px = landmark_xy * np.array([w, h])

        # Calculate Eye Aspect Ratio (EAR) for blink detection
        def eye_aspect_ratio(eye_points):
            A = np.linalg.norm(eye_points[1] - eye_points[5])
            B = np.linalg.norm(eye_points[2] - eye_points[4])
            C = np.linalg.norm(eye_points[0] - eye_points[3])
            return (A + B) / (2.0 * C) if C > 0 else 1.0

        left_eye = np.array([landmark_px[i] for i in LEFT_EYE_IDX])
        right_eye = np.array([landmark_px[i] for i in RIGHT_EYE_IDX])
        left_ear = eye_aspect_ratio(left_eye)
        right_ear = eye_aspect_ratio(right_eye)
        current_ear = (left_ear + right_ear) / 2.0

        # Adapt to the user's own open-eye EAR so narrow or wide eyes both work.
        # State is round-tripped via the client (see _parse_blink_state) so this works
        # correctly across multiple worker processes.
        blink_state = _parse_blink_state(blink_state)
        baseline = blink_state["baseline"]
        baseline = (
            current_ear
            if baseline is None
            else max(current_ear, baseline * EAR_BASELINE_DECAY)
        )
        blink_state["baseline"] = baseline
        closed_threshold = min(
            EAR_CLOSED_THRESHOLD, baseline * EAR_RELATIVE_CLOSED_RATIO
        )
        current_ear_open = current_ear >= closed_threshold

        # Track blink: transition from open -> closed -> open
        blink = False
        if blink_state["prev_open"] and not current_ear_open:
            blink_state["closed_seen"] = True
        elif (
            not blink_state["prev_open"]
            and current_ear_open
            and blink_state["closed_seen"]
        ):
            blink = True
            blink_state["closed_seen"] = False
        blink_state["prev_open"] = current_ear_open

        print(
            f"[DEBUG] EAR: {current_ear:.3f}, Threshold: {closed_threshold:.3f}, Open: {current_ear_open}, Blink: {blink}"
        )

        # Other liveness checks
        head_turn_direction = liveness_detector.detect_head_turn_direction(
            landmark_xy, LEFT_CHEEK_IDX, RIGHT_CHEEK_IDX, NOSE_IDX
        )
        head_turn = head_turn_direction is not None

        # Calculate confidence (use face detection confidence or default to high value)
        confidence = 0.85

        response = {
            "face_detected": True,
            "blink": bool(blink),
            "head_turn": bool(head_turn),
            "head_turn_direction": head_turn_direction,
            "confidence": float(confidence),
            # Updated temporal state for the client to send back with the next frame.
            "blink_state": json.dumps(blink_state),
        }

        print(f"[LIVENESS] Response: {response}")
        return response

    except Exception as e:
        print(f"\n[LIVENESS] ERROR in liveness detection: {str(e)}")
        import traceback

        traceback.print_exc()
        return {
            "face_detected": False,
            "blink": False,
            "head_turn": False,
            "head_turn_direction": None,
            "head_up": False,
            "head_down": False,
            "confidence": 0.0,
            "error": str(e),
        }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 7860))
    # Multiple workers let interactive calls (selfie /extract, liveness) run in parallel
    # with batch photo processing. Liveness is multi-worker-safe (state round-trips via
    # the client). Override with AI_WORKERS; set to 1 to revert. Uses the "main:app"
    # import string, required for multi-worker mode.
    workers = int(os.getenv("AI_WORKERS", "2"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, workers=workers)
