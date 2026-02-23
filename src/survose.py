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

load_dotenv()

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

    # TODO fetch questions from the database
    # hardcoded for testing purposes
    questions = {
        "q1": 
        {
            "text": "On a scale of 1 to 10, how safe do you feel walking in your neighborhood at night?",
            "type": "response",
        },
        "q2": {
            "text": "What do you think is the most pressing issue facing your community today?",
            "type": "response",
        },
        "q3": {
            "text": "How satisfied are you with the local public transportation options available to you?",
            "type": "response",
        },
    }

    # 2. Place the call with all questions
    # TODO - how would we get the 'to_num' phone number in the general case?
    print("Making call...", file=sys.stderr)
    call_sid = make_call(questions)
    print(f"Call is in place (SID: {call_sid}). Waiting for completion...", file=sys.stderr)

    # 3. Wait for the call to finish, then transcribe each recording
    print("Polling call status and waiting for recordings...", file=sys.stderr)
    transcriptions = wait_for_call_and_transcribe(call_sid, expected_count=len(questions))

    question_list = list(questions.values())
    for i, t in enumerate(transcriptions):
        print(f"  Q{i+1}: {question_list[i]['text']}", file=sys.stderr)
        print(f"  A{i+1}: {t}", file=sys.stderr)

    # 4. Output structured result for the frontend to consume
    result = {
        "questions": questions,
        "transcriptions": transcriptions,
        "survey_json": survey_json,
        "call_sid": call_sid,
    }
    print(f"{RESULT_PREFIX}{json.dumps(result)}")
