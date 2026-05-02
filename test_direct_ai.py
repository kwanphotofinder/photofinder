#!/usr/bin/env python3
import requests
import cv2
import numpy as np

AI_URL = 'http://localhost:8000/liveness/detect'

# create similar image
img = np.ones((720, 1280, 3), dtype=np.uint8) * 220
cv2.ellipse(img, (640, 360), (180, 220), 0, 0, 360, (200,160,140), -1)
cv2.ellipse(img, (580, 320), (16,10), 0, 0, 360, (255,255,255), -1)
cv2.ellipse(img, (700, 320), (16,10), 0, 0, 360, (255,255,255), -1)
cv2.circle(img, (582,318), 4, (0,0,0), -1)
cv2.circle(img, (702,318), 4, (0,0,0), -1)

success, buf = cv2.imencode('.jpg', img)
if not success:
    print('Failed to encode')
    raise SystemExit(1)

files = {'file': ('frame.jpg', buf.tobytes(), 'image/jpeg')}
print('Posting directly to AI:', AI_URL)
resp = requests.post(AI_URL, files=files, timeout=10)
print('Status:', resp.status_code)
try:
    print('Body:', resp.json())
except Exception:
    print('Raw:', resp.text)
