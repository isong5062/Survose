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

def make_call(question):
    """
    Make a voice survey call with all the inputs
    """

    # Get Twilio credentials
    # TODO maybe get these passed in somewhere else somehow?
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_num = os.getenv("TWILIO_FROM_NUMBER")
    to_num = os.getenv("TWILIO_TO_NUMBER")

    # Convert to speech using Eleven Labs
    audio_bytes = text_to_speech(question)

    # Upload audio
    audio_url = upload_audio(audio_bytes)

    # Build TwiML
    twiml = f'''<Response>
        <Play>{audio_url}</Play>
        <Record maxLength="120" timeout="5" finishOnKey="#" playBeep="true" />
        <Say>Thank you. Goodbye.</Say>
    </Response>'''

    # Place call
    client = Client(sid, token)
    call = client.calls.create(to=to_num, from_=from_num, twiml=twiml)
    return call.sid


def wait_for_call_and_transcribe(call_sid: str) -> str:
    """
    Poll a Twilio call until it completes, then download its recording
    and transcribe it with Whisper.

    Returns the transcribed text.
    """
    from voice_agent.transcribe import transcribe_audio

    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    client = Client(sid, token)

    # Poll the call status until it finishes
    while True:
        call = client.calls(call_sid).fetch()
        status = call.status

        if status == "completed":
            break
        elif status in ["failed", "busy", "no-answer", "canceled"]:
            raise RuntimeError(f"Call ended with status: {status}")

        time.sleep(2)  # Wait 2 seconds before checking again

    # Wait a bit for the recording to be processed
    time.sleep(3)

    # Fetch the recording
    recordings = client.recordings.list(call_sid=call_sid)
    if not recordings:
        raise RuntimeError("No recordings found for this call.")
    recording = recordings[0]

    # Download the recording as mp3
    recording_url = f"https://api.twilio.com{recording.uri.replace('.json', '.mp3')}"
    response = requests.get(recording_url, auth=(sid, token))
    response.raise_for_status()
    audio_bytes = response.content

    # Transcribe the audio
    result = transcribe_audio(audio_bytes)
    return result["text"]
