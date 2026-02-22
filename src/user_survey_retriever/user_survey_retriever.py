"""Utilities to read and format user-authored survey questions."""

import json
import sys

VALID_QUESTION_TYPES = {
    "open_ended",
    "scale",
    "multiple_choice",
    "checkbox",
    "yes_no",
}


# converts internal question type ids to spoken labels. called by build_question_block before question text is assembled for twilio playback.
def format_question_type(question_type: str) -> str:
    labels = {
        "open_ended": "open-ended",
        "scale": "scale",
        "multiple_choice": "multiple choice",
        "checkbox": "checkbox",
        "yes_no": "yes/no",
    }
    return labels[question_type]


# parses numeric values from int/float/string inputs. need this so that invalid ranges can be skipped. for example, if some mf puts in a min value that's greater than the max value, we need to skip that question.
def _parse_number(value):
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return float(stripped)
        except ValueError:
            return None
    return None


# render whole numbers without decimal suffix. used to keep spoken ranges clean
def _format_number(value: float) -> str:
    return str(int(value)) if value.is_integer() else str(value)


# this function takes in all of the frontend text and organizes it into two things: the spoken text that'll be used by the ai agent and the json
def build_question_block(question):
    if not isinstance(question, dict):
        return None, None

    text = str(question.get("text", "")).strip()
    if not text:
        return None, None

    question_type = question.get("type")
    if not isinstance(question_type, str) or question_type not in VALID_QUESTION_TYPES:
        return None, None

    lines = [f"This is a {format_question_type(question_type)} question.", text]
    question_data = {
        "question": text,
        "type": question_type,
    }
    options = question.get("options", {})
    options = options if isinstance(options, dict) else {}

    if question_type in {"multiple_choice", "checkbox", "yes_no"}:
        raw_choices = options.get("choices", [])
        choices = []
        if isinstance(raw_choices, list):
            choices = [str(choice).strip() for choice in raw_choices if str(choice).strip()]
        if len(choices) < 2:
            return None, None
        lines.append(f"Options: {', '.join(choices)}")
        question_data["details"] = {"options": choices}
    elif question_type == "scale":
        minimum = _parse_number(options.get("min"))
        maximum = _parse_number(options.get("max"))
        if minimum is None or maximum is None or minimum >= maximum:
            return None, None
        lines.append(f"Range: {_format_number(minimum)} to {_format_number(maximum)}")
        question_data["details"] = {
            "range": {
                "min": _format_number(minimum),
                "max": _format_number(maximum),
            }
        }

    return "\n".join(lines), question_data


# build full spoken prompt text from all valid questions
def build_survey_prompt(questions):
    if not isinstance(questions, list):
        raise ValueError("'questions' must be an array")

    blocks = []

    for question in questions:
        block_text, _ = build_question_block(question)
        if block_text is None:
            continue
        blocks.append(block_text)

    if not blocks:
        raise ValueError("No valid questions to run")

    return "\n\n".join(blocks)


# build spoken text and structured question json keyed by survey title. this is the main builder used by survose.py
def build_survey_prompt_and_question_json(questions, survey_title):
    if not isinstance(questions, list):
        raise ValueError("'questions' must be an array")

    blocks = []
    question_entries = []

    for question in questions:
        block_text, question_data = build_question_block(question)
        if block_text is None:
            continue
        blocks.append(block_text)
        question_entries.append(question_data)

    if not blocks:
        raise ValueError("No valid questions to run")

    title = str(survey_title or "").strip() or "Untitled Survey"
    question_json = {title: question_entries}
    return "\n\n".join(blocks), question_json


# reads frontend data and parses it into a json object
def parse_stdin_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("Request body is empty")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("Request body is not valid JSON") from exc

    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object")
    return payload


# read stdin json payload and return spoken prompt text.
def get_user_question_from_stdin():
    payload = parse_stdin_payload()
    questions = payload.get("questions", [])
    return build_survey_prompt(questions)


# read stdin json payload and return spoken prompt text + question json. this is the step-1 entrypoint currently called by survose.py before make_call is executed.
def get_user_question_and_json_from_stdin():
    payload = parse_stdin_payload()
    questions = payload.get("questions", [])
    survey_title = payload.get("title")
    return build_survey_prompt_and_question_json(questions, survey_title)
