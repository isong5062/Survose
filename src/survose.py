"""
Survose - Simple voice survey system using Twilio, OpenAI, and ElevenLabs.
"""

# Python imports
import json
import os
import sys

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

RESULT_PREFIX = "SURVOSE_RESULT:"


if __name__ == "__main__":
    num_questions = 3

    # 1. Generate survey questions
    # print(f"Generating {num_questions} survey questions...", file=sys.stderr)
    # questions = []
    # for i in range(num_questions):
    #     q = generate_survey_text()
    #     questions.append(q)

    # 1. Hardcoded questions for testing (avoids API rate limits)
    questions = [
        "On a scale of 1 to 10, how safe do you feel walking in your neighborhood at night?",
        "What do you think is the most pressing issue facing your community today?",
        "How satisfied are you with the local public transportation options available to you?",
    ]
    for i, q in enumerate(questions):
        print(f"  Q{i+1}: {q}", file=sys.stderr)

    # 2. Place the call with all questions
    # TODO - how would we get the 'to_num' phone number in the general case?
    print("Making call...", file=sys.stderr)
    call_sid = make_call(questions)
    print(f"Call is in place (SID: {call_sid}). Waiting for completion...", file=sys.stderr)

    # 3. Wait for the call to finish, then transcribe each recording
    print("Polling call status and waiting for recordings...", file=sys.stderr)
    transcriptions = wait_for_call_and_transcribe(call_sid, expected_count=len(questions))

    for i, t in enumerate(transcriptions):
        print(f"  Q{i+1}: {questions[i]}", file=sys.stderr)
        print(f"  A{i+1}: {t}", file=sys.stderr)

    # 4. Output structured result for the frontend to consume
    result = {
        "questions": questions,
        "transcriptions": transcriptions,
        "call_sid": call_sid,
    }
    print(f"{RESULT_PREFIX}{json.dumps(result)}")
