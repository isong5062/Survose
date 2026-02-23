"""
Transcribe audio files (or byte streams) to text using OpenAI's Whisper model.
Used to convert recorded call responses into text for survey analysis.
"""

# Python imports
import os
import tempfile
from pathlib import Path

# External imports
import whisper

# Options: "tiny", "base", "small", "medium", "large"
DEFAULT_MODEL_SIZE = "base"

# Module-level cache so the model is only loaded once per process
_model_cache: dict[str, whisper.Whisper] = {}


def _get_model(model_size: str = DEFAULT_MODEL_SIZE) -> whisper.Whisper:
    """Return a cached Whisper model, loading it on the first call."""
    if model_size not in _model_cache:
        _model_cache[model_size] = whisper.load_model(model_size)
    return _model_cache[model_size]


def transcribe_audio(
    source: str | bytes | os.PathLike,
    *,
    model_size: str = DEFAULT_MODEL_SIZE,
    language: str | None = None,
) -> dict:
    """
    Transcribe an audio source to text using Whisper.

    Parameters

    source : str | bytes | os.PathLike
        A file path to an audio file **or** raw audio bytes (from
        ElevenLabs/Twilio recording download).
    model_size : str, optional
        Whisper model variant to use (default base model).
    language : str | None, optional

    Returns a dictionary with the text and the language.
    Also reports the number of text segments where each segment is a small chunk of the audio with
    its own text and metadata.
    """
    model = _get_model(model_size)

    # If the caller passed raw bytes, write them to a temp file so Whisper
    # can read them (Whisper expects a file path).
    if isinstance(source, (bytes, bytearray)):
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(source)
            tmp_path = tmp.name
        try:
            result = model.transcribe(tmp_path, fp16=False, language=language)
        finally:
            os.unlink(tmp_path)
    else:
        filepath = str(source)
        if not Path(filepath).is_file():
            raise FileNotFoundError(f"Audio file not found: {filepath}")
        result = model.transcribe(filepath, fp16=False, language=language)

    return {
        "text": result.get("text", "").strip(),
        "segments": result.get("segments", []),
        "language": result.get("language", language),
    }


def transcribe_audio_text(
    source: str | bytes | os.PathLike,
    **kwargs,
) -> str:
    """Convenience wrapper that returns only the transcription text."""
    return transcribe_audio(source, **kwargs)["text"]


if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else str(
        Path(__file__).resolve().parent.parent.parent / "tests" / "data" / "test.mp3"
    )
    result = transcribe_audio(path)
    print(f"Language: {result['language']}")
    print(f"Text:     {result['text']}")
    print(f"Segments: {len(result['segments'])}")
