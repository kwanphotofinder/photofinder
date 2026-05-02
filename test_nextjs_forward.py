#!/usr/bin/env python3
"""
Send a synthetic test frame to Next.js liveness API to verify forwarding to AI service.
"""
import requests
import cv2
import numpy as np

NEXTJS_URL = "http://localhost:3000/api/student/liveness-detect"

# create a simple realistic-ish face-like image
img = np.ones((720, 1280, 3), dtype=np.uint8) * 220
cv2.ellipse(img, (640, 360), (180, 220), 0, 0, 360, (200,160,140), -1)
cv2.ellipse(img, (580, 320), (16,10), 0, 0, 360, (255,255,255), -1)
cv2.ellipse(img, (700, 320), (16,10), 0, 0, 360, (255,255,255), -1)
cv2.circle(img, (582,318), 4, (0,0,0), -1)
cv2.circle(img, (702,318), 4, (0,0,0), -1)

success, buf = cv2.imencode('.jpg', img)
if not success:
    print('Failed to encode image')
    raise SystemExit(1)

files = {'frame': ('frame.jpg', buf.tobytes(), 'image/jpeg')}
print('Posting to', NEXTJS_URL)
try:
    r = requests.post(NEXTJS_URL, files=files, timeout=10)
    print('Status:', r.status_code)
    try:
        print('Body:', r.json())
    except Exception:
        print('Body (raw):', r.text)
except Exception as e:
    print('Request failed:', e)
