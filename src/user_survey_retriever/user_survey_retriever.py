"""Utilities to read and format user-authored survey questions."""

import json
import sys
from dataclasses import dataclass

VALID_QUESTION_TYPES = {
    "open_ended",
    "scale",
    "multiple_choice",
    "checkbox",
    "yes_no",
}


class UserInputError(ValueError):
    """Raised for request validation/input errors."""


@dataclass
class QuestionBuildResult:
    text: str
    skipped: bool = False
    skip_reason: str = ""
    question_data: dict | None = None


def format_question_type(question_type: str) -> str:
    labels = {
        "open_ended": "open-ended",
        "scale": "scale",
        "multiple_choice": "multiple choice",
        "checkbox": "checkbox",
        "yes_no": "yes/no",
    }
    return labels[question_type]


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


def _format_number(value: float) -> str:
    return str(int(value)) if value.is_integer() else str(value)


def build_question_block(question) -> QuestionBuildResult:
    if not isinstance(question, dict):
        return QuestionBuildResult(text="", skipped=True, skip_reason="question must be an object")

    text = str(question.get("text", "")).strip()
    if not text:
        return QuestionBuildResult(text="", skipped=True, skip_reason="question text is empty")

    question_type = question.get("type")
    if not isinstance(question_type, str) or question_type not in VALID_QUESTION_TYPES:
        return QuestionBuildResult(text="", skipped=True, skip_reason="question type is invalid")

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
            return QuestionBuildResult(
                text="",
                skipped=True,
                skip_reason=f"{question_type} question needs at least 2 options",
            )
        lines.append(f"Options: {', '.join(choices)}")
        question_data["details"] = {"options": choices}
    elif question_type == "scale":
        minimum = _parse_number(options.get("min"))
        maximum = _parse_number(options.get("max"))
        if minimum is None or maximum is None or minimum >= maximum:
            return QuestionBuildResult(
                text="",
                skipped=True,
                skip_reason="scale question requires numeric min < max",
            )
        lines.append(f"Range: {_format_number(minimum)} to {_format_number(maximum)}")
        question_data["details"] = {
            "range": {
                "min": _format_number(minimum),
                "max": _format_number(maximum),
            }
        }

    return QuestionBuildResult(text="\n".join(lines), question_data=question_data)


def build_survey_prompt(questions):
    if not isinstance(questions, list):
        raise UserInputError("'questions' must be an array")

    blocks = []

    for question in questions:
        result = build_question_block(question)
        if result.skipped:
            continue
        blocks.append(result.text)

    if not blocks:
        raise UserInputError("No valid questions to run")

    return "\n\n".join(blocks)


def build_survey_prompt_and_question_json(questions, survey_title):
    if not isinstance(questions, list):
        raise UserInputError("'questions' must be an array")

    blocks = []
    question_entries = []

    for question in questions:
        result = build_question_block(question)
        if result.skipped:
            continue
        blocks.append(result.text)
        question_entries.append(result.question_data)

    if not blocks:
        raise UserInputError("No valid questions to run")

    title = str(survey_title or "").strip() or "Untitled Survey"
    question_json = {title: question_entries}
    return "\n\n".join(blocks), question_json


def parse_stdin_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        raise UserInputError("Request body is empty")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise UserInputError("Request body is not valid JSON") from exc

    if not isinstance(payload, dict):
        raise UserInputError("Request body must be a JSON object")
    return payload


def get_user_question_from_stdin():
    """Read stdin JSON payload and return spoken prompt text."""
    payload = parse_stdin_payload()
    questions = payload.get("questions", [])
    return build_survey_prompt(questions)


def get_user_question_and_json_from_stdin():
    """Read stdin JSON payload and return spoken prompt text + question JSON."""
    payload = parse_stdin_payload()
    questions = payload.get("questions", [])
    survey_title = payload.get("title")
    return build_survey_prompt_and_question_json(questions, survey_title)
