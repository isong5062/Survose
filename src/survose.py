"""
Survose - Simple voice survey system using Twilio, OpenAI, and ElevenLabs.
"""

# Python imports
import os

# Internal imports
from survey_generation.llm_output import generate_survey_text
from voice_agent.twilio import make_call

REQUIRED_ENV_VARS = [
    "TWILIO_TO_NUMBER",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "OPENAI_API_KEY",
    "ELEVENLABS_API_KEY",
]

if __name__ == "__main__":

    for var in REQUIRED_ENV_VARS:
        if not os.getenv(var):
            raise ValueError(f"{var} is not set")

    # 1. Generate survey text using LLM prompt
    # TODO will need to be connected to the frontend!
    print("Generating survey text...")
    question = generate_survey_text()
    print(f"Generated! Question - {question}")

    # 2. Makes the call to the 'to_num' phone number in the environment
    # TODO - how would we get the 'to_num' phone number in the general case?
    print("Making call...")
    make_call(question)
    print("Call is in place. Please wait a little bit...")

    # 3. Record and transcribe the response!
    # NOTE - there is a way to do this in twilio.py.
    # we can wait for the survey to be completed and then fetch the file using the call SID
