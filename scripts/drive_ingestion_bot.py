#!/usr/bin/env python3
"""
MFU Drive / Google Drive Photo Ingestion Bot
---------------------------------------------
Scans an MFU Drive folder, Google Drive synced folder, or local directory for new event photos,
and automatically ingests/uploads them to PhotoFinder API for face embedding extraction.

Features:
- Watches folder or runs batch sync
- Automatic duplicate avoidance using SHA-256 and manifest file
- Automatic batching with progress tracking and error retry
- Supports configurable backend endpoint and credentials
"""

import os
import sys
import time
import json
import hashlib
import argparse
import logging
from pathlib import Path
from typing import Set, Dict, Any, List

try:
    import requests
except ImportError:
    print("Please install requests: pip install requests")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("drive_bot")

MANIFEST_FILENAME = ".ingested_manifest.json"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def get_file_hash(filepath: Path) -> str:
    """Calculates SHA-256 checksum of a file to prevent redundant uploads."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class DriveIngestionBot:
    def __init__(
        self,
        api_base: str,
        watch_dir: Path,
        event_id: str,
        auth_token: str = None,
        email: str = None,
        password: str = None,
    ):
        self.api_base = api_base.rstrip("/")
        self.watch_dir = watch_dir.resolve()
        self.event_id = event_id
        self.auth_token = auth_token
        self.email = email
        self.password = password
        self.manifest_path = self.watch_dir / MANIFEST_FILENAME
        self.manifest = self._load_manifest()

    def _load_manifest(self) -> Dict[str, Any]:
        if self.manifest_path.exists():
            try:
                with open(self.manifest_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read existing manifest: {e}")
        return {"processed_hashes": {}, "failed_files": {}}

    def _save_manifest(self):
        try:
            with open(self.manifest_path, "w", encoding="utf-8") as f:
                json.dump(self.manifest, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save manifest: {e}")

    def authenticate(self) -> bool:
        """Authenticates with the PhotoFinder API if no static auth token was provided."""
        if self.auth_token:
            return True

        if not self.email or not self.password:
            logger.warning("No auth_token or credentials provided; proceeding unauthenticated (or using cookie/mock).")
            return False

        login_url = f"{self.api_base}/api/auth/login"
        logger.info(f"Authenticating as {self.email} against {login_url}...")
        try:
            resp = requests.post(
                login_url,
                json={"email": self.email, "password": self.password},
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                self.auth_token = data.get("token") or data.get("authToken")
                logger.info("Authentication successful!")
                return True
            else:
                logger.error(f"Login failed (status {resp.status_code}): {resp.text}")
                return False
        except Exception as e:
            logger.error(f"Error during login: {e}")
            return False

    def scan_directory(self) -> List[Path]:
        """Scans the watch directory recursively for image files."""
        if not self.watch_dir.exists():
            logger.error(f"Directory not found: {self.watch_dir}")
            return []

        images = []
        for root, _, files in os.walk(self.watch_dir):
            for file in files:
                p = Path(root) / file
                if p.suffix.lower() in SUPPORTED_EXTENSIONS and not p.name.startswith("."):
                    images.append(p)
        return images

    def upload_photo(self, filepath: Path) -> bool:
        """Uploads a single photo to the PhotoFinder upload endpoint."""
        file_hash = get_file_hash(filepath)

        if file_hash in self.manifest.get("processed_hashes", {}):
            logger.debug(f"Skipping already ingested file: {filepath.name}")
            return True

        upload_url = f"{self.api_base}/api/photos/upload"
        headers = {}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"

        logger.info(f"Uploading {filepath.name} ({filepath.stat().st_size / 1024:.1f} KB) to event '{self.event_id}'...")

        try:
            with open(filepath, "rb") as f:
                files = {"file": (filepath.name, f, "image/jpeg")}
                data = {"eventId": self.event_id}

                resp = requests.post(upload_url, headers=headers, data=data, files=files, timeout=120)

                if resp.status_code in (200, 201):
                    res_json = resp.json()
                    logger.info(f" Successfully processed: {filepath.name} -> {res_json.get('photoId', 'OK')}")
                    self.manifest["processed_hashes"][file_hash] = {
                        "name": filepath.name,
                        "timestamp": time.time(),
                        "photoId": res_json.get("photoId"),
                        "status": res_json.get("status", "success"),
                    }
                    self._save_manifest()
                    return True
                else:
                    logger.error(f"❌ Failed to upload {filepath.name} [{resp.status_code}]: {resp.text}")
                    self.manifest["failed_files"][str(filepath)] = {
                        "error": resp.text[:200],
                        "status_code": resp.status_code,
                    }
                    self._save_manifest()
                    return False
        except Exception as e:
            logger.error(f"❌ Network/file error uploading {filepath.name}: {e}")
            return False

    def sync_once(self) -> int:
        """Performs a single pass sync over the target directory."""
        images = self.scan_directory()
        logger.info(f"Found {len(images)} images in {self.watch_dir}")

        uploaded_count = 0
        for img in images:
            if self.upload_photo(img):
                uploaded_count += 1
            time.sleep(0.5)  # gentle rate limit between uploads

        logger.info(f"Batch sync finished. Ingested {uploaded_count}/{len(images)} files.")
        return uploaded_count

    def watch(self, poll_interval_sec: int = 15):
        """Monitors the watch directory continuously for new photos."""
        logger.info(f"Starting watch mode on '{self.watch_dir}' (polling every {poll_interval_sec}s)...")
        while True:
            try:
                self.sync_once()
            except KeyboardInterrupt:
                logger.info("Watch mode stopped by user.")
                break
            except Exception as e:
                logger.error(f"Unexpected error during watch loop: {e}")
            time.sleep(poll_interval_sec)


def main():
    parser = argparse.ArgumentParser(description="MFU Drive / Google Drive Ingestion Bot for PhotoFinder")
    parser.add_argument("--dir", required=True, help="Path to MFU Drive / Google Drive folder with photos")
    parser.add_argument("--event-id", required=True, help="Target Event ID in PhotoFinder")
    parser.add_argument("--api-url", default="http://localhost:3000", help="PhotoFinder API base URL")
    parser.add_argument("--token", default=None, help="Photographer / Admin JWT token")
    parser.add_argument("--email", default=None, help="Photographer email (for auto-login)")
    parser.add_argument("--password", default=None, help="Photographer password")
    parser.add_argument("--watch", action="store_true", help="Run in continuous watch mode")
    parser.add_argument("--interval", type=int, default=30, help="Watch interval in seconds")

    args = parser.parse_args()

    watch_path = Path(args.dir)
    if not watch_path.exists():
        logger.error(f"Target folder does not exist: {watch_path}")
        sys.exit(1)

    bot = DriveIngestionBot(
        api_base=args.api_url,
        watch_dir=watch_path,
        event_id=args.event_id,
        auth_token=args.token,
        email=args.email,
        password=args.password,
    )

    bot.authenticate()

    if args.watch:
        bot.watch(poll_interval_sec=args.interval)
    else:
        bot.sync_once()


if __name__ == "__main__":
    main()
