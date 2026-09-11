


import cv2
import numpy as np
import mediapipe as mp
from mediapipe import Image, ImageFormat
from pathlib import Path

FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode


class FaceMeshLiveness:
    def __init__(self, model_path=None, num_faces=1):
        if model_path is None:
            model_path = self._resolve_default_model_path()
        else:
            model_path = self._resolve_model_path(model_path)

        print(f"[FaceMeshLiveness] Initializing with model: {model_path}")
        print(f"[FaceMeshLiveness] Model file exists: {Path(model_path).exists()}")
        
        self.options = FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=model_path),
            num_faces=num_faces,
            running_mode=VisionRunningMode.IMAGE
        )
        print("[FaceMeshLiveness] FaceLandmarkerOptions created")
        
        self.landmarker = FaceLandmarker.create_from_options(self.options)
        print("[FaceMeshLiveness] FaceLandmarker successfully created")

    @staticmethod
    def _resolve_model_path(model_path):
        candidate = Path(model_path)
        if candidate.is_file():
            return str(candidate)

        module_dir = Path(__file__).resolve().parent
        project_root = module_dir.parent.parent
        fallback_candidates = [
            module_dir / model_path,
            module_dir.parent / model_path,
            project_root / model_path,
            project_root / "face_landmarker.task",
            module_dir.parent / "face_landmarker.task",
        ]

        for fallback in fallback_candidates:
            if fallback.is_file():
                return str(fallback)

        return str(candidate)

    @classmethod
    def _resolve_default_model_path(cls):
        return cls._resolve_model_path("face_landmarker.task")

    def process_frame(self, image):
        try:
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            print(f"[FaceMeshLiveness] Image converted to RGB. Shape: {rgb_image.shape}")
            
            mp_image = Image(image_format=ImageFormat.SRGB, data=rgb_image)
            print(f"[FaceMeshLiveness] MediaPipe Image created")
            
            result = self.landmarker.detect(mp_image)
            print(f"[FaceMeshLiveness] Detection completed. Faces found: {len(result.face_landmarks) if result.face_landmarks else 0}")
            
            return result
        except Exception as e:
            print(f"[FaceMeshLiveness] ERROR in process_frame: {str(e)}")
            import traceback
            traceback.print_exc()
            raise

    @staticmethod
    def detect_blink(landmarks, left_eye_indices, right_eye_indices):
        # Simple blink detection using eye aspect ratio (EAR)
        # landmarks are normalized (0-1) or pixel coordinates
        def eye_aspect_ratio(eye_points):
            # Calculate distances between eye landmarks
            A = np.linalg.norm(eye_points[1] - eye_points[5])
            B = np.linalg.norm(eye_points[2] - eye_points[4])
            C = np.linalg.norm(eye_points[0] - eye_points[3])
            return (A + B) / (2.0 * C) if C > 0 else 0
        
        left_eye = np.array([landmarks[i] for i in left_eye_indices])
        right_eye = np.array([landmarks[i] for i in right_eye_indices])
        left_ear = eye_aspect_ratio(left_eye)
        right_ear = eye_aspect_ratio(right_eye)
        EAR_THRESHOLD = 0.21
        return left_ear < EAR_THRESHOLD or right_ear < EAR_THRESHOLD

    @staticmethod
    def detect_head_turn_direction(
        landmarks,
        left_cheek_idx,
        right_cheek_idx,
        nose_idx,
        threshold=0.40,
    ):
        # Determine whether the user's head is turned left or right using the nose position
        # relative to the cheeks. Returns 'left', 'right', or None.
        left_cheek = landmarks[left_cheek_idx]
        right_cheek = landmarks[right_cheek_idx]
        nose = landmarks[nose_idx]
        
        face_width = np.linalg.norm(np.array(left_cheek) - np.array(right_cheek))
        if face_width == 0:
            return None
            
        nose_rel = (nose[0] - left_cheek[0]) / face_width
        if nose_rel < threshold:
            return 'right'
        if nose_rel > 1.0 - threshold:
            return 'left'
        return None

    @staticmethod
    def detect_head_turn(landmarks, left_cheek_idx, right_cheek_idx, nose_idx):
        return FaceMeshLiveness.detect_head_turn_direction(landmarks, left_cheek_idx, right_cheek_idx, nose_idx) is not None


