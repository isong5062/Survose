"""
Text-to-speech with Eleven Labs. Use text_to_speech(text) for a single phrase (e.g. one question).
"""

import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"
DEFAULT_MODEL = "eleven_multilingual_v2"
DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"


def _get_client():
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable is not set")
    return ElevenLabs(api_key=api_key)


def text_to_speech(
    text: str,
    voice_id: str = DEFAULT_VOICE_ID,
    model_id: str = DEFAULT_MODEL,
    output_format: str = DEFAULT_OUTPUT_FORMAT,
) -> bytes:
    """Convert text to MP3 bytes for use in Twilio or storage."""
    client = _get_client()
    result = client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id=model_id,
        output_format=output_format,
    )
    if isinstance(result, bytes):
        return result
    if hasattr(result, "__iter__") and not isinstance(result, (str, bytes)):
        return b"".join(result)
    return bytes(result)
