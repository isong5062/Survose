"""
Generate survey using LLM and convert to speech using Eleven Labs
"""

import os
from typing import Optional

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from survey_generation.llm_output import generate_survey_text


def _get_api_key() -> str:
    load_dotenv()
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable is not set")
    return api_key


def generate_survey_audio(topic: Optional[str] = None) -> bytes:
    """
    Generate a survey question with LLM and convert it to speech via Eleven Labs.

    Args:
        topic: Optional survey topic passed to the LLM.

    Returns:
        MP3 audio bytes of the spoken survey question.
    """
    api_key = _get_api_key()
    client = ElevenLabs(api_key=api_key)

    # Generate survey text using LLM
    print("[generate_survey_audio] Generating survey questions...")
    survey_text = generate_survey_text(topic=topic)
    print(f"[generate_survey_audio] Survey text:\n{survey_text}\n")

    # Convert survey text to speech using Eleven Labs
    print("[generate_survey_audio] Converting to speech...")
    audio = client.text_to_speech.convert(
        text=survey_text,
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )

    # The SDK may return a generator; collect bytes
    if hasattr(audio, "__iter__") and not isinstance(audio, (bytes, bytearray)):
        audio = b"".join(audio)

    return audio
