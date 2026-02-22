"""Unit tests for survey prompt formatting in survose.py."""

import pytest

from user_survey_retriever.user_survey_retriever import (
    UserInputError,
    build_question_block,
    build_survey_prompt,
)


def test_build_question_block_open_ended():
    result = build_question_block(
        {
            "text": "How was your experience today?",
            "type": "open_ended",
            "options": {},
        }
    )

    assert result.skipped is False
    assert result.text == (
        "This is a open-ended question.\n"
        "How was your experience today?"
    )


def test_build_question_block_multiple_choice_includes_options():
    result = build_question_block(
        {
            "text": "Which service did you use?",
            "type": "multiple_choice",
            "options": {"choices": ["Billing", "Support", "Sales"]},
        }
    )

    assert result.skipped is False
    assert "Options: Billing, Support, Sales" in result.text


def test_build_question_block_checkbox_includes_options():
    result = build_question_block(
        {
            "text": "Which channels do you use?",
            "type": "checkbox",
            "options": {"choices": ["App", "Website", "Phone"]},
        }
    )

    assert result.skipped is False
    assert "Options: App, Website, Phone" in result.text


def test_build_question_block_scale_includes_range():
    result = build_question_block(
        {
            "text": "Rate your satisfaction.",
            "type": "scale",
            "options": {"min": 1, "max": 10},
        }
    )

    assert result.skipped is False
    assert "Range: 1 to 10" in result.text


def test_build_question_block_invalid_scale_is_skipped():
    result = build_question_block(
        {
            "text": "Rate your satisfaction.",
            "type": "scale",
            "options": {"min": 5, "max": 2},
        }
    )

    assert result.skipped is True
    assert "min < max" in result.skip_reason


def test_build_question_block_missing_text_is_skipped():
    result = build_question_block(
        {
            "text": "   ",
            "type": "open_ended",
            "options": {},
        }
    )

    assert result.skipped is True
    assert "empty" in result.skip_reason


def test_build_survey_prompt_mixed_valid_and_invalid_questions():
    prompt = build_survey_prompt(
        [
            {"text": "  ", "type": "open_ended", "options": {}},
            {"text": "How likely are you to recommend us?", "type": "scale", "options": {"min": 1, "max": 5}},
            {"text": "Pick your favorite", "type": "multiple_choice", "options": {"choices": ["A", "", "B"]}},
            {"text": "Broken type", "type": "unknown", "options": {}},
        ]
    )

    assert "This is a scale question." in prompt
    assert "Range: 1 to 5" in prompt
    assert "This is a multiple choice question." in prompt
    assert "Options: A, B" in prompt


def test_build_survey_prompt_all_invalid_raises():
    with pytest.raises(UserInputError, match="No valid questions to run"):
        build_survey_prompt(
            [
                {"text": "   ", "type": "open_ended", "options": {}},
                {"text": "Rate", "type": "scale", "options": {"min": 10, "max": 1}},
            ]
        )
