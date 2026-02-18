"""
Survose - Simple voice survey system using Twilio, OpenAI, and ElevenLabs.
"""

# Python imports
import os

# External imports
from dotenv import load_dotenv

# Internal imports
from survey_generation.llm_output import generate_survey_text
from voice_agent.twilio import make_call, wait_for_call_and_transcribe

REQUIRED_ENV_VARS = [
    "TWILIO_TO_NUMBER",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "OPENAI_API_KEY",
    "ELEVENLABS_API_KEY",
]


if __name__ == "__main__":
    # 1. Generate the survey text
    print("Generating survey text...")
    question = generate_survey_text()
    print(f"Generated! Question - {question}")

    # 2. Makes the call to the 'to_num' phone number in the environment
    # TODO - how would we get the 'to_num' phone number in the general case?
    print("Making call...")
    call_sid = make_call(question)
    print(f"Call is in place (SID: {call_sid}). Waiting for completion...")

    # 3. Record and transcribe the response!
    print("Polling call status and waiting for recording...")
    transcription = wait_for_call_and_transcribe(call_sid)
    print(f"Transcription: {transcription}")
