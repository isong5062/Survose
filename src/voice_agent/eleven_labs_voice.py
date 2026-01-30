import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
from survey_generation.llm_output import generate_survey_text
from tempfile import NamedTemporaryFile
from twilio.rest import Client as TwilioClient
import requests


def main():
    load_dotenv()

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable is not set")

    client = ElevenLabs(api_key=api_key)

    # Generate survey text using LLM
    print("Generating survey questions...")
    survey_text = generate_survey_text()
    print(f"\nGenerated survey:\n{survey_text}\n")

    # Convert survey text to speech using Eleven Labs
    print("Converting to speech...")
    audio = client.text_to_speech.convert(
        text=survey_text,
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )

    # Save audio bytes to a temporary MP3 file so we can host/send it
    with NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
        tf.write(audio)
        tmp_path = tf.name

    # If Twilio credentials and phone numbers are provided, place a call
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_from = os.getenv("TWILIO_FROM_NUMBER")
    twilio_to = os.getenv("TWILIO_TO_NUMBER")

    if twilio_sid and twilio_token and twilio_from and twilio_to:
        print("Uploading audio to a temporary public URL via a simple file host (file.io)...")
        # NOTE: In production, host this MP3 on a public URL (S3, CDN) reachable by Twilio.
        # For a quick demo we upload to https://file.io which returns a temporary link.
        try:
            with open(tmp_path, "rb") as f:
                files = {"file": (os.path.basename(tmp_path), f, "audio/mpeg")}
                resp = requests.post("https://file.io", files=files)
                resp.raise_for_status()
                link = resp.json().get("link")
        except Exception:
            link = None

        if not link:
            print("Failed to upload audio to a public URL; will play locally instead.")
            print("Playing audio locally...")
            play(audio)
        else:
            print(f"Making Twilio call to {twilio_to} and playing the uploaded audio...")
            tw_client = TwilioClient(twilio_sid, twilio_token)
            # plas the uploaded audio URL
            twiml = f"<Response><Play>{link}</Play></Response>"
            call = tw_client.calls.create(to=twilio_to, from_=twilio_from, twiml=twiml)
            print(f"Call initiated: SID={call.sid}")
    else:
        print("Twilio credentials or phone numbers not set; playing audio locally instead.")
        play(audio)

if __name__ == "__main__":
    main()
