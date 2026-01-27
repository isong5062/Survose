import os
from pathlib import Path
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play

load_dotenv()

api_key = os.getenv("ELEVENLABS_API_KEY")
if not api_key:
    raise ValueError("ELEVENLABS_API_KEY environment variable is not set")

client = ElevenLabs(api_key=api_key)

# TODO: Generate surveys using LLM (Claude, GPT, etc.) and then convert to audio using Eleven Labs
# TODO: Pass LLM survey into QA testing pipeline to identify potential bias, missing demographics, and leading questions

audio = client.text_to_speech.convert(
    text="The first move is what sets everything in motion.",
    voice_id="JBFqnCBsd6RMkjVDRZzb",
    model_id="eleven_multilingual_v2",
    output_format="mp3_44100_128",
)

play(audio)