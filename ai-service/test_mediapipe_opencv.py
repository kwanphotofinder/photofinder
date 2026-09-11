import cv2
from services.liveness import FaceMeshLiveness
from services.face_blur import blur_faces
import mediapipe as mp

# Example indices for left/right eye and cheeks (468 landmark model)
LEFT_EYE_IDX = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_IDX = [362, 385, 387, 263, 373, 380]
LEFT_CHEEK_IDX = 234
RIGHT_CHEEK_IDX = 454
NOSE_IDX = 1

def main():
    liveness = FaceMeshLiveness()
    cap = cv2.VideoCapture(0)
    print('Press ESC to exit.')
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        results = liveness.process_frame(frame)
        if results.face_landmarks:
            for face_landmarks in results.face_landmarks:
                h, w, _ = frame.shape
                landmarks = [(int(pt.x * w), int(pt.y * h)) for pt in face_landmarks]
                # Draw landmarks
                for x, y in landmarks:
                    cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)
                # Liveness detection
                blink = liveness.detect_blink(landmarks, LEFT_EYE_IDX, RIGHT_EYE_IDX)
                head_turn = liveness.detect_head_turn(landmarks, LEFT_CHEEK_IDX, RIGHT_CHEEK_IDX, NOSE_IDX)
                cv2.putText(frame, f"Blink: {blink}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255) if blink else (0,255,0), 2)
                cv2.putText(frame, f"Head Turn: {head_turn}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,0,255) if head_turn else (0,255,0), 2)
        cv2.imshow('MediaPipe FaceMesh Liveness', frame)
        if cv2.waitKey(1) & 0xFF == 27:
            break
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
