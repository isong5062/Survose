"""
FastAPI backend for voice survey: Twilio calls, ElevenLabs TTS, Firebase storage.
"""

from fastapi import FastAPI

from firebase_app import get_status as firebase_status

app = FastAPI(
    title="Voice Survey API",
    description="Play ElevenLabs questions in Twilio calls and store recordings in Firebase",
    version="0.1.0",
)


@app.on_event("startup")
def startup():
    """Initialize Firebase Admin if credentials are set."""
    from firebase_app import is_available
    if is_available():
        pass  # already lazy-initialized on first use; ensure env is loaded
    # No-op if no credentials; Firebase-dependent routes will handle None


@app.get("/health")
def health():
    """Health check for load balancers and local dev. Includes firebase status and reason if false."""
    fb = firebase_status()
    return {"status": "ok", "firebase": fb["available"]}
