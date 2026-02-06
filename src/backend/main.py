"""
FastAPI backend for voice survey: Twilio calls, ElevenLabs TTS, Firebase storage.
"""

import sys
from pathlib import Path

# So we can import voice_agent from src when running as src/backend/main
_src = Path(__file__).resolve().parent.parent
if str(_src) not in sys.path:
    sys.path.insert(0, str(_src))

from fastapi import FastAPI
from fastapi.responses import Response

from firebase_app import get_status as firebase_status
from firebase_helpers import upload_mp3_and_get_url
from survey_generation.llm_output import generate_survey_text
from voice_agent.elevenlabs import text_to_speech

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


def _twiml_say(msg: str) -> Response:
    """Return TwiML that speaks a message (for errors)."""
    # Escape for XML
    msg = msg.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Response(
        content=f"<Response><Say>{msg}</Say></Response>",
        media_type="application/xml",
    )


@app.api_route("/voice/incoming", methods=["GET", "POST"])
def voice_incoming():
    """
    Twilio incoming-voice webhook: generate one question via LLM (llm_output), convert to speech
    with ElevenLabs, upload to Storage, return TwiML that plays it.
    """
    import os
    import time
    import traceback

    try:
        topic = os.getenv("INCOMING_TOPIC")  # optional; LLM uses its default topic if unset
        question = generate_survey_text(topic=topic).strip()
        if not question:
            return _twiml_say("Error: LLM returned no question.")
        audio_bytes = text_to_speech(question)
        path = f"question-audio/incoming/{int(time.time() * 1000)}.mp3"
        url = upload_mp3_and_get_url(audio_bytes, path)
        if not url:
            return _twiml_say("Error: could not upload audio. Check Firebase Storage.")
        url_escaped = url.replace("&", "&amp;")
        twiml = f'<Response><Play>{url_escaped}</Play><Say>Goodbye.</Say></Response>'
        return Response(content=twiml, media_type="application/xml")
    except ValueError as e:
        return _twiml_say("Error: missing ELEVENLABS_API_KEY.")
    except Exception as e:
        traceback.print_exc()
        return _twiml_say(f"Error: {str(e)[:80]}.")
