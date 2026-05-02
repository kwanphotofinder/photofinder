#!/usr/bin/env python3
"""
Test script to diagnose face detection in the AI service.
Sends test images to the diagnostic endpoint.
"""

import requests
import cv2
import numpy as np
import sys
from pathlib import Path

AI_SERVICE_URL = "http://localhost:8000"

def create_test_image():
    """Create a test image with a more realistic face-like pattern."""
    img = np.ones((480, 640, 3), dtype=np.uint8) * 220  # Light background
    
    # Draw a realistic-ish face outline
    center = (320, 240)
    
    # Face oval
    cv2.ellipse(img, center, (90, 110), 0, 0, 360, (200, 160, 140), -1)  # Skin tone
    
    # Left eye
    cv2.ellipse(img, (290, 210), (12, 18), 0, 0, 360, (255, 255, 255), -1)  # White
    cv2.ellipse(img, (290, 210), (8, 12), 0, 0, 360, (100, 100, 100), -1)  # Iris
    cv2.circle(img, (291, 208), 4, (0, 0, 0), -1)  # Pupil
    cv2.circle(img, (292, 207), 2, (255, 255, 255), -1)  # Shine
    
    # Right eye
    cv2.ellipse(img, (350, 210), (12, 18), 0, 0, 360, (255, 255, 255), -1)
    cv2.ellipse(img, (350, 210), (8, 12), 0, 0, 360, (100, 100, 100), -1)
    cv2.circle(img, (351, 208), 4, (0, 0, 0), -1)
    cv2.circle(img, (352, 207), 2, (255, 255, 255), -1)
    
    # Eyebrows
    pts = np.array([[270, 190], [310, 185], [310, 190]], np.int32)
    cv2.polylines(img, [pts], False, (80, 60, 40), 2)
    pts = np.array([[330, 185], [370, 190], [330, 190]], np.int32)
    cv2.polylines(img, [pts], False, (80, 60, 40), 2)
    
    # Nose
    pts = np.array([[320, 220], [315, 250], [325, 250]], np.int32)
    cv2.polylines(img, [pts], False, (180, 140, 120), 2)
    
    # Mouth
    cv2.ellipse(img, (320, 280), (25, 12), 0, 0, 180, (150, 80, 80), 2)
    
    # Chin shadow
    cv2.ellipse(img, (320, 330), (85, 20), 0, 0, 180, (150, 100, 80), -1)
    
    return img

def test_with_created_image():
    """Test face detection with a created test image."""
    print("[TEST] Creating synthetic test image...")
    img = create_test_image()
    
    # Save for reference
    cv2.imwrite("/tmp/test_image.jpg", img)
    print("[TEST] Test image created and saved")
    
    # Encode as JPEG
    success, buffer = cv2.imencode('.jpg', img)
    if not success:
        print("[ERROR] Failed to encode image")
        return
    
    file_bytes = buffer.tobytes()
    print(f"[TEST] Image size: {len(file_bytes)} bytes")
    
    # Send to diagnostic endpoint
    print(f"[TEST] Sending to {AI_SERVICE_URL}/test/face-landmarks")
    try:
        response = requests.post(
            f"{AI_SERVICE_URL}/test/face-landmarks",
            files={"file": ("test.jpg", file_bytes, "image/jpeg")}
        )
        print(f"[TEST] Response status: {response.status_code}")
        print(f"[TEST] Response body: {response.json()}")
    except Exception as e:
        print(f"[ERROR] Request failed: {e}")

def test_with_real_image():
    """Test with a real image if available."""
    # Check if there's a test image in the project
    test_image_paths = [
        Path("test_image.jpg"),
        Path("test_face.jpg"),
        Path("public/test.jpg"),
    ]
    
    for path in test_image_paths:
        if path.exists():
            print(f"[TEST] Found test image at {path}")
            with open(path, 'rb') as f:
                file_bytes = f.read()
            
            print(f"[TEST] Image size: {len(file_bytes)} bytes")
            print(f"[TEST] Sending to {AI_SERVICE_URL}/test/face-landmarks")
            try:
                response = requests.post(
                    f"{AI_SERVICE_URL}/test/face-landmarks",
                    files={"file": ("test.jpg", file_bytes, "image/jpeg")}
                )
                print(f"[TEST] Response status: {response.status_code}")
                print(f"[TEST] Response body: {response.json()}")
            except Exception as e:
                print(f"[ERROR] Request failed: {e}")
            return
    
    print("[TEST] No test images found, downloading real face image from web...")
    try:
        # Download a real face image
        import urllib.request
        url = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Person.jpg/220px-Person.jpg"
        print(f"[TEST] Downloading from {url}")
        with urllib.request.urlopen(url, timeout=10) as response:
            file_bytes = response.read()
        
        print(f"[TEST] Image size: {len(file_bytes)} bytes")
        print(f"[TEST] Sending to {AI_SERVICE_URL}/test/face-landmarks")
        response = requests.post(
            f"{AI_SERVICE_URL}/test/face-landmarks",
            files={"file": ("test.jpg", file_bytes, "image/jpeg")}
        )
        print(f"[TEST] Response status: {response.status_code}")
        print(f"[TEST] Response body: {response.json()}")
    except Exception as e:
        print(f"[ERROR] Failed to download image: {e}")
        print("[TEST] Creating synthetic test image instead...")
        test_with_created_image()

if __name__ == "__main__":
    print(f"[TEST] Face Detection Diagnostic Tool")
    print(f"[TEST] AI Service URL: {AI_SERVICE_URL}")
    print()
    
    # First, check if service is running
    try:
        response = requests.get(f"{AI_SERVICE_URL}/")
        print(f"[TEST] Service is running: {response.json()}")
    except Exception as e:
        print(f"[ERROR] Service is not responding: {e}")
        sys.exit(1)
    
    print()
    test_with_real_image()
