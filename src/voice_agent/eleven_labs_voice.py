"""
Generate survey using LLM and convert to speech using Eleven Labs
"""

import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from survey_generation.llm_output import generate_survey_text

def fetch_env():
    load_dotenv()
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable is not set")
    return api_key

def generate_survey_text(api_key=fetch_env()):
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

    return audio
