import cv2
import numpy as np

def blur_faces(image, bounding_boxes, ksize=(51, 51)):
    output = image.copy()
    for (x, y, w, h) in bounding_boxes:
        face_roi = output[y:y+h, x:x+w]
        blurred_face = cv2.GaussianBlur(face_roi, ksize, 0)
        output[y:y+h, x:x+w] = blurred_face
    return output
