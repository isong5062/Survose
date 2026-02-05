"""
FastAPI backend for voice survey: Twilio calls, ElevenLabs TTS, Firebase storage.
"""

from fastapi import FastAPI

app = FastAPI(
    title="Voice Survey API",
    description="Play ElevenLabs questions in Twilio calls and store recordings in Firebase",
    version="0.1.0",
)


@app.get("/health")
def health():
    """Health check for load balancers and local dev."""
    return {"status": "ok"}
