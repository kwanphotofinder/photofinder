


import cv2
import numpy as np
import mediapipe as mp
from mediapipe import Image, ImageFormat

FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode


class FaceMeshLiveness:
    def __init__(self, model_path=None, num_faces=1):
        if model_path is None:
            # Use relative path from project root
            model_path = "ai-service/face_landmarker.task"
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
        return nose_rel < 0.3 or nose_rel > 0.7
