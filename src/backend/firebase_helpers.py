"""
Helpers for Firebase Storage (upload MP3, get URL) and Firestore (store recording metadata).
"""

from datetime import datetime, timedelta
from typing import Any

from firebase_app import get_firestore, get_storage_bucket, is_available


# Firestore collection for call recordings (same project as frontend surveys)
RECORDINGS_COLLECTION = "recordings"


def upload_mp3_and_get_url(
    data: bytes,
    path: str,
    content_type: str = "audio/mpeg",
    signed: bool = True,
    expiration_minutes: int = 60,
) -> str | None:
    """
    Upload bytes (e.g. ElevenLabs MP3) to Firebase Storage and return a URL Twilio can use for <Play>.
    path: e.g. "question-audio/survey123/0.mp3"
    If signed=True, returns a signed URL (default; works with private buckets). Else makes blob public and returns public_url.
    """
    bucket = get_storage_bucket()
    if not bucket:
        return None
    blob = bucket.blob(path)
    blob.upload_from_string(data, content_type=content_type)
    if signed:
        url = blob.generate_signed_url(expiration=timedelta(minutes=expiration_minutes))
        return url
    blob.make_public()
    return blob.public_url


def save_recording(
    call_sid: str,
    recording_url: str,
    *,
    survey_id: str | None = None,
    question_index: int | None = None,
    owner_id: str | None = None,
    duration_seconds: int | None = None,
    recording_sid: str | None = None,
    extra: dict[str, Any] | None = None,
) -> str | None:
    """
    Write a recording document to Firestore (recordings collection).
    Returns the document id, or None if Firestore is not available.
    """
    db = get_firestore()
    if not db:
        return None
    col = db.collection(RECORDINGS_COLLECTION)
    doc_data: dict[str, Any] = {
        "callSid": call_sid,
        "recordingUrl": recording_url,
        "createdAt": datetime.utcnow(),
    }
    if survey_id is not None:
        doc_data["surveyId"] = survey_id
    if question_index is not None:
        doc_data["questionIndex"] = question_index
    if owner_id is not None:
        doc_data["ownerId"] = owner_id
    if duration_seconds is not None:
        doc_data["durationSeconds"] = duration_seconds
    if recording_sid is not None:
        doc_data["recordingSid"] = recording_sid
    if extra:
        doc_data.update(extra)
    ref = col.add(doc_data)
    return ref[1].id
