import cv2
import numpy as np
import mediapipe as mp
from mediapipe import Image, ImageFormat
from pathlib import Path
import os

FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode


class FaceMeshLiveness:
    def __init__(self, model_path=None, num_faces=1):
        if model_path is None:
            # Try multiple locations to support both local and Docker environments
            possible_paths = [
                "face_landmarker.task",
                "ai-service/face_landmarker.task",
                "/home/user/app/face_landmarker.task"
            ]
            for path in possible_paths:
                if os.path.exists(path):
                    model_path = path
                    break
            
            if not model_path:
                model_path = "face_landmarker.task" # Fallback
        
        self.options = FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=model_path),
            num_faces=num_faces,
            running_mode=VisionRunningMode.IMAGE
        )
        self.landmarker = FaceLandmarker.create_from_options(self.options)

    def process_frame(self, image):
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = Image(image_format=ImageFormat.SRGB, data=rgb_image)
        result = self.landmarker.detect(mp_image)
        return result

    @staticmethod
    def detect_blink(landmarks, left_eye_indices, right_eye_indices):
        # Simple blink detection using eye aspect ratio (EAR)
        def eye_aspect_ratio(eye_points):
            A = np.linalg.norm(eye_points[1] - eye_points[5])
            B = np.linalg.norm(eye_points[2] - eye_points[4])
            C = np.linalg.norm(eye_points[0] - eye_points[3])
            return (A + B) / (2.0 * C)
        left_eye = np.array([landmarks[i] for i in left_eye_indices])
        right_eye = np.array([landmarks[i] for i in right_eye_indices])
        left_ear = eye_aspect_ratio(left_eye)
        right_ear = eye_aspect_ratio(right_eye)
        EAR_THRESHOLD = 0.21
        return left_ear < EAR_THRESHOLD or right_ear < EAR_THRESHOLD

    @staticmethod
    def detect_head_turn(landmarks, left_cheek_idx, right_cheek_idx, nose_idx):
        # Simple head turn detection using horizontal nose position
        left_cheek = landmarks[left_cheek_idx]
        right_cheek = landmarks[right_cheek_idx]
        nose = landmarks[nose_idx]
        face_width = np.linalg.norm(np.array(left_cheek) - np.array(right_cheek))
        nose_rel = (nose[0] - left_cheek[0]) / face_width
        # If nose is too close to one side, head is turned
        return nose_rel < 0.35 or nose_rel > 0.65

    @staticmethod
    def detect_head_up_down(landmarks, nose_idx, left_eye_idx, right_eye_idx, chin_idx):
        """
        Detects if the head is tilted up or down by comparing the vertical position of the nose relative to the eyes and chin.
        Returns:
            'up' if head is up, 'down' if head is down, None if neutral
        """
        nose = np.array(landmarks[nose_idx])
        left_eye = np.array(landmarks[left_eye_idx])
        right_eye = np.array(landmarks[right_eye_idx])
        chin = np.array(landmarks[chin_idx])
        # Average eye y position
        eye_y = (left_eye[1] + right_eye[1]) / 2.0
        # Distance from eyes to chin
        eyes_to_chin = chin[1] - eye_y
        # Distance from eyes to nose
        eyes_to_nose = nose[1] - eye_y
        # Ratio: higher means nose is closer to chin (head down), lower means nose is closer to eyes (head up)
        ratio = eyes_to_nose / eyes_to_chin if eyes_to_chin != 0 else 0
        # Thresholds may need tuning based on landmark scale
        if ratio > 0.6:
            return 'down'
        elif ratio < 0.35:
            return 'up'
        else:
            return None

    @staticmethod
    def is_head_up(landmarks, nose_idx, left_eye_idx, right_eye_idx, chin_idx):
        return FaceMeshLiveness.detect_head_up_down(landmarks, nose_idx, left_eye_idx, right_eye_idx, chin_idx) == 'up'

    @staticmethod
    def is_head_down(landmarks, nose_idx, left_eye_idx, right_eye_idx, chin_idx):
        return FaceMeshLiveness.detect_head_up_down(landmarks, nose_idx, left_eye_idx, right_eye_idx, chin_idx) == 'down'
