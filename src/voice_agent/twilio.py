"""
Use Twilio to place a call, play survey audio, and record user responses.

Required environment variables:
    TWILIO_ACCOUNT_SID    Twilio Account SID
    TWILIO_AUTH_TOKEN     Twilio Auth Token
    TWILIO_FROM_NUMBER    Your Twilio phone number (E.164 format, e.g. +14155551234)
    TWILIO_TO_NUMBER      Recipient phone number (E.164 format)
    BASE_URL              Public base URL for your webhook server (e.g. https://abc123.ngrok.io)
"""

import os
from tempfile import NamedTemporaryFile
from typing import Optional

import requests
from dotenv import load_dotenv
from flask import Flask, request, url_for
from twilio.rest import Client as TwilioClient
from twilio.twiml.voice_response import VoiceResponse, Gather

# Internal imports
from voice_agent.elevenlabs import generate_survey_audio
from voice_agent.whisper import transcribe_audio

load_dotenv()

# ---------------------------------------------------------------------------
# Twilio credentials & settings (loaded once at module level)
# ---------------------------------------------------------------------------
TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM = os.getenv("TWILIO_FROM_NUMBER")
BASE_URL = os.getenv("BASE_URL", "")  # e.g. https://<your-ngrok>.ngrok.io

app = Flask(__name__)

# In-memory store for demo; replace with a database in production
recordings: dict[str, dict] = {}


def upload_audio_to_public_url(audio_bytes: bytes) -> Optional[str]:
    """
    Upload audio bytes to a temporary public host (file.io) and return the URL.
    In production, use S3, GCS, or your own CDN.
    """
    with NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
        tf.write(audio_bytes)
        tmp_path = tf.name

    try:
        with open(tmp_path, "rb") as f:
            resp = requests.post(
                "https://file.io",
                files={"file": (os.path.basename(tmp_path), f, "audio/mpeg")},
            )
            resp.raise_for_status()
            return resp.json().get("link")
    except Exception as e:
        print(f"[upload_audio] Failed: {e}")
        return None


def initiate_survey_call(to_number: str, survey_audio: bytes) -> str:
    """
    Place an outbound call to `to_number`, play the survey audio, and record the response.

    Args:
        to_number: Recipient phone number in E.164 format.
        survey_audio: MP3 audio bytes of the survey question.

    Returns:
        The Twilio Call SID.
    """
    if not all([TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, BASE_URL]):
        raise EnvironmentError(
            "Missing one or more required env vars: "
            "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, BASE_URL"
        )

    audio_url = upload_audio_to_public_url(survey_audio)
    if not audio_url:
        raise RuntimeError("Could not upload survey audio to a public URL.")

    # Build TwiML: play the survey question, then record the caller's response
    response = VoiceResponse()
    response.play(audio_url)
    response.say("Please leave your response after the beep. Press pound when finished.")
    response.record(
        max_length=120,  # seconds
        action=f"{BASE_URL}/handle_recording",
        recording_status_callback=f"{BASE_URL}/recording_status",
        transcribe=False,  # we use Whisper instead
        play_beep=True,
        finish_on_key="#",
    )
    response.say("Thank you for your response. Goodbye!")
    response.hangup()

    tw_client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
    call = tw_client.calls.create(
        to=to_number,
        from_=TWILIO_FROM,
        twiml=str(response),
    )
    print(f"[initiate_survey_call] Call SID: {call.sid}")
    return call.sid


# ---------------------------------------------------------------------------
# Flask webhook endpoints (Twilio will POST here)
# ---------------------------------------------------------------------------

@app.route("/handle_recording", methods=["POST"])
def handle_recording():
    """
    Called by Twilio when the recording finishes.
    We acknowledge the recording and let the call continue.
    """
    call_sid = request.form.get("CallSid")
    recording_url = request.form.get("RecordingUrl")
    print(f"[handle_recording] CallSid={call_sid}, RecordingUrl={recording_url}")

    # Respond with empty TwiML to let the call proceed to hangup
    resp = VoiceResponse()
    return str(resp), 200, {"Content-Type": "application/xml"}


@app.route("/recording_status", methods=["POST"])
def recording_status():
    """
    Called by Twilio when the recording status changes (e.g., completed).
    Download the recording and transcribe it with Whisper.
    """
    call_sid = request.form.get("CallSid")
    recording_sid = request.form.get("RecordingSid")
    recording_url = request.form.get("RecordingUrl")  # .wav by default
    status = request.form.get("RecordingStatus")

    print(f"[recording_status] CallSid={call_sid}, Status={status}, URL={recording_url}")

    if status == "completed" and recording_url:
        # Twilio recordings are protected; authenticate to download
        audio_url = f"{recording_url}.mp3"
        audio_resp = requests.get(audio_url, auth=(TWILIO_SID, TWILIO_TOKEN))
        if audio_resp.ok:
            with NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp.write(audio_resp.content)
                tmp_path = tmp.name

            transcript = transcribe_audio(tmp_path)
            print(f"[recording_status] Transcript: {transcript}")

            # Store transcript for later retrieval
            recordings[call_sid] = {
                "recording_sid": recording_sid,
                "transcript": transcript,
            }
        else:
            print(f"[recording_status] Failed to download recording: {audio_resp.status_code}")

    return "", 204


@app.route("/get_transcript/<call_sid>", methods=["GET"])
def get_transcript(call_sid: str):
    """Retrieve the transcript for a given call."""
    data = recordings.get(call_sid)
    if data:
        return {"call_sid": call_sid, **data}, 200
    return {"error": "Transcript not found"}, 404


# ---------------------------------------------------------------------------
# CLI helper to run a survey call
# ---------------------------------------------------------------------------

def run_survey(to_number: Optional[str] = None, topic: Optional[str] = None):
    """
    High-level helper: generate survey audio and place a call.

    Args:
        to_number: Recipient number (defaults to TWILIO_TO_NUMBER env var).
        topic: Survey topic (passed to LLM for question generation).
    """
    to_number = to_number or os.getenv("TWILIO_TO_NUMBER")
    if not to_number:
        raise ValueError("Recipient phone number is required (to_number or TWILIO_TO_NUMBER).")

    print("[run_survey] Generating survey audio...")
    audio = generate_survey_audio(topic=topic)

    print(f"[run_survey] Placing call to {to_number}...")
    call_sid = initiate_survey_call(to_number, audio)
    print(f"[run_survey] Call initiated. SID={call_sid}")
    return call_sid


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "server":
        # Run Flask webhook server (use with ngrok for public URL)
        print("Starting webhook server on http://0.0.0.0:5000")
        app.run(host="0.0.0.0", port=5000)
    else:
        # Place a survey call
        run_survey()
