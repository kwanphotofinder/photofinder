import cv2
import numpy as np

def blur_faces(image, bounding_boxes):
    output = image.copy()
    for (x, y, w, h) in bounding_boxes:
        # Ensure coordinates are within image bounds
        y_end = min(y + h, image.shape[0])
        x_end = min(x + w, image.shape[1])
        y = max(0, y)
        x = max(0, x)
        
        face_roi = output[y:y_end, x:x_end]
        if face_roi.size == 0:
            continue
            
        # Extreme Pixelation (Mosaic) effect
        # Shrink the face to a tiny 8x8 block image
        blocks = 8
        small = cv2.resize(face_roi, (blocks, blocks), interpolation=cv2.INTER_LINEAR)
        
        # Scale it back up using nearest neighbor to create giant pixels
        pixelated_face = cv2.resize(small, (x_end - x, y_end - y), interpolation=cv2.INTER_NEAREST)

        output[y:y_end, x:x_end] = pixelated_face
        
    return output
