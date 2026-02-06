"""
Firebase Admin: Firestore and Storage for the same project as the frontend.
Uses service account credentials (GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CREDENTIALS_PATH).
Loads frontend/.env so backend can use the same env file (e.g. bucket, credentials path).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
_project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_project_root / "frontend" / ".env")
load_dotenv(_project_root / "src" / "voice_agent" / ".env")

_firebase_app = None
_db = None
_bucket = None


def _get_credentials_path():
    path = os.getenv("FIREBASE_CREDENTIALS_PATH") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not path or not path.strip():
        return None
    p = Path(path.strip()).expanduser()
    if not p.is_absolute():
        # Resolve relative paths from project root so e.g. "serviceAccountKey.json" or "frontend/key.json" works
        p = _project_root / p
    if p.is_file():
        return str(p)
    return None


def get_firestore():
    """Return Firestore client. Initializes Firebase Admin on first call if credentials are set."""
    global _db
    if _db is not None:
        return _db
    _ensure_firebase()
    if _firebase_app is None:
        return None
    from firebase_admin import firestore
    _db = firestore.client()
    return _db


def get_storage_bucket():
    """Return Storage bucket. Initializes Firebase Admin on first call if credentials are set."""
    global _bucket
    if _bucket is not None:
        return _bucket
    _ensure_firebase()
    if _firebase_app is None:
        return None
    from firebase_admin import storage
    bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET") or os.getenv("VITE_FIREBASE_STORAGE_BUCKET")
    _bucket = storage.bucket(bucket_name) if bucket_name else storage.bucket()
    return _bucket


def _ensure_firebase():
    global _firebase_app
    if _firebase_app is not None:
        return
    cred_path = _get_credentials_path()
    if not cred_path:
        return
    import firebase_admin
    from firebase_admin import credentials
    cred = credentials.Certificate(cred_path)
    options = {}
    bucket = os.getenv("FIREBASE_STORAGE_BUCKET") or os.getenv("VITE_FIREBASE_STORAGE_BUCKET")
    if bucket:
        options["storageBucket"] = bucket
    _firebase_app = firebase_admin.initialize_app(cred, options)


def is_available():
    """True if Firebase Admin is initialized (credentials were provided)."""
    _ensure_firebase()
    return _firebase_app is not None


def get_status():
    """
    Return dict: available (bool), reason (str | None).
    Use in /health so you can see why Firebase is false (e.g. "credentials file not found").
    """
    _ensure_firebase()
    if _firebase_app is not None:
        return {"available": True, "reason": None}
    path_var = os.getenv("FIREBASE_CREDENTIALS_PATH") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not path_var or not path_var.strip():
        return {"available": False, "reason": "FIREBASE_CREDENTIALS_PATH or GOOGLE_APPLICATION_CREDENTIALS not set in env"}
    p = Path(path_var.strip()).expanduser()
    if not p.is_absolute():
        p = _project_root / p
    if not p.is_file():
        return {"available": False, "reason": f"credentials file not found: {p}"}
    return {"available": False, "reason": "credentials file exists but Firebase init failed (check server logs)"}
