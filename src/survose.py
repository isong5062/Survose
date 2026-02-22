"""
Survose - Simple voice survey system using Twilio, OpenAI, and ElevenLabs.
"""

# Python imports
import json
import sys

# External imports
from dotenv import load_dotenv
load_dotenv()

# Internal imports
from user_survey_retriever.user_survey_retriever import (
    get_user_question_and_json_from_stdin,
)
from voice_agent.twilio import make_call, wait_for_call_and_transcribe

REQUIRED_ENV_VARS = [
    "TWILIO_TO_NUMBER",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "OPENAI_API_KEY",
    "ELEVENLABS_API_KEY",
]

RESULT_PREFIX = "SURVOSE_RESULT:"


if __name__ == "__main__":
    # 1. Take question from user
    print("Formatting survey text from user questions...", file=sys.stderr)
    question, survey_json = get_user_question_and_json_from_stdin()

    # 2. Makes the call to the 'to_num' phone number in the environment
    # TODO - how would we get the 'to_num' phone number in the general case?
    print("Making call...")
    call_sid = make_call(question)
    print(f"Call is in place (SID: {call_sid}). Waiting for completion...")

    # 3. Record and transcribe the response!
    print("Polling call status and waiting for recording...")
    transcription = wait_for_call_and_transcribe(call_sid)
    print(f"Transcription: {transcription}")

    # 4. Output structured result for the frontend to consume
    result = {
        "question": question,
        "survey_json": survey_json,
        "transcription": transcription,
        "call_sid": call_sid,
    }
    print(f"{RESULT_PREFIX}{json.dumps(result)}")
