"""
Twilio helpers: place outbound calls, build TwiML for playing audio + recording
the respondent's answer, and download completed recordings.
"""

# Python imports
import tempfile
import time
import os
from dotenv import load_dotenv
from twilio.rest import Client as TwilioClient

# External imports
import requests
from twilio.rest import Client

# Internal imports
from voice_agent.elevenlabs import text_to_speech

def upload_audio(audio_bytes: bytes):
    """Upload audio to temporary hosting service and return public URL."""

    # General assertion check
    assert isinstance(audio_bytes, bytes), "audio_bytes must be bytes type"

    # Write audio bytes to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    # Use tmpfiles.org to upload the data
    try:
        with open(tmp_path, "rb") as f:
            files = {"file": ("audio.mp3", f, "audio/mpeg")}
            resp = requests.post("https://tmpfiles.org/api/v1/upload", files=files)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == "success" and "data" in data:
                url = data["data"]["url"].replace("tmpfiles.org/", "tmpfiles.org/dl/")
                return url
        raise Exception(f"Upload failed: {data}")
    finally:
        os.unlink(tmp_path)

def make_call(questions):
    """
    Make a voice survey call that plays each question and records a response
    for each one.  Accepts a single question string or a list of strings.
    The respondent presses # to finish each answer.
    """
    if isinstance(questions, str):
        questions = [questions]

    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_num = os.getenv("TWILIO_FROM_NUMBER")
    to_num = os.getenv("TWILIO_TO_NUMBER")

    # Convert each question to speech and upload
    audio_urls = []
    for q in questions:
        audio_bytes = text_to_speech(q)
        audio_urls.append(upload_audio(audio_bytes))

    # Build TwiML with a Play+Record pair per question
    verbs = []
    for url in audio_urls:
        verbs.append(f'<Play>{url}</Play>')
        verbs.append('<Record maxLength="120" timeout="5" finishOnKey="#" playBeep="true" />')
    verbs.append('<Say>Thank you for completing the survey. Goodbye.</Say>')

    twiml = f'<Response>{"".join(verbs)}</Response>'

    client = Client(sid, token)
    call = client.calls.create(to=to_num, from_=from_num, twiml=twiml)
    return call.sid


def wait_for_call_and_transcribe(call_sid: str, expected_count: int = 1) -> list[str]:
    """
    Poll a Twilio call until it completes, then download all recordings
    and transcribe each one with Whisper.

    Returns a list of transcribed texts, one per recording, in
    chronological order (matching the question order).
    """
    from voice_agent.transcribe import transcribe_audio

    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    client = Client(sid, token)

    while True:
        call = client.calls(call_sid).fetch()
        status = call.status

        if status == "completed":
            break
        elif status in ["failed", "busy", "no-answer", "canceled"]:
            raise RuntimeError(f"Call ended with status: {status}")

        time.sleep(2)

    time.sleep(3)

    recordings = client.recordings.list(call_sid=call_sid)
    if not recordings:
        raise RuntimeError("No recordings found for this call.")

    # Sort by creation time so they match the question order
    recordings.sort(key=lambda r: r.date_created)

    transcriptions = []
    for recording in recordings:
        recording_url = f"https://api.twilio.com{recording.uri.replace('.json', '.mp3')}"
        resp = requests.get(recording_url, auth=(sid, token))
        resp.raise_for_status()
        result = transcribe_audio(resp.content)
        transcriptions.append(result["text"])

    return transcriptions
