#!/usr/bin/env python3
"""
Helper script to download a public Google Drive folder using gdown.
Outputs JSON on stdout so parent processes (Next.js Node.js or scripts) can consume it.
"""

import sys
import os
import re
import json
import argparse
from pathlib import Path

try:
    import gdown
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "gdown is not installed. Please run: pip install gdown"
    }))
    sys.exit(1)

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp"}

def extract_folder_id(url_or_id: str) -> str:
    """Extract folder ID from various Google Drive folder URL formats."""
    url_or_id = url_or_id.strip()
    
    # Check if already a clean ID
    if re.match(r'^[a-zA-Z0-9_-]{15,}$', url_or_id):
        return url_or_id
        
    patterns = [
        r'/folders/([a-zA-Z0-9_-]+)',
        r'[?&]id=([a-zA-Z0-9_-]+)',
        r'/d/([a-zA-Z0-9_-]+)',
    ]
    for pattern in patterns:
        m = re.search(pattern, url_or_id)
        if m:
            return m.group(1)
            
    return url_or_id

def download_drive_folder(url_or_id: str, output_dir: Path) -> dict:
    folder_id = extract_folder_id(url_or_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Use gdown to download folder by ID
        # If url was passed, construct standard folder url or pass id
        folder_url = f"https://drive.google.com/drive/folders/{folder_id}"
        
        # Download files
        downloaded = gdown.download_folder(
            url=folder_url,
            output=str(output_dir),
            quiet=True,
            use_cookies=False,
            resume=True
        )
        
        if downloaded is None:
            # Check directory if files were downloaded directly
            downloaded = []
            for root, _, files in os.walk(output_dir):
                for f in files:
                    downloaded.append(os.path.join(root, f))
        
        # Find all valid image files
        image_files = []
        for file_path in downloaded:
            p = Path(file_path)
            if p.suffix.lower() in SUPPORTED_EXTENSIONS and not p.name.startswith("."):
                image_files.append({
                    "path": str(p.resolve()),
                    "name": p.name,
                    "size": p.stat().st_size if p.exists() else 0
                })
                
        return {
            "success": True,
            "folderId": folder_id,
            "totalDownloaded": len(downloaded),
            "imageCount": len(image_files),
            "images": image_files
        }
    except Exception as e:
        return {
            "success": False,
            "folderId": folder_id,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="Download Google Drive folder using gdown")
    parser.add_argument("url_or_id", help="Google Drive folder URL or ID")
    parser.add_argument("--output", default="./temp_gdown", help="Output directory")
    args = parser.parse_args()

    result = download_drive_folder(args.url_or_id, Path(args.output))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    if not result["success"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
