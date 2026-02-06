"""
Transcribe audio files to text using OpenAI Whisper.
"""

import whisper

# Load model once at module level for efficiency
_model = None


def _get_model(model_name: str = "base"):
    global _model
    if _model is None:
        _model = whisper.load_model(model_name)
    return _model


def transcribe_audio(filepath: str, model_name: str = "base") -> str:
    """
    Transcribe an audio file to text using OpenAI Whisper.

    Args:
        filepath: Path to the audio file (mp3, wav, etc.).
        model_name: Whisper model size ('tiny', 'base', 'small', 'medium', 'large').

    Returns:
        The transcribed text.
    """
    model = _get_model(model_name)
    result = model.transcribe(filepath, fp16=False)
    return result.get("text", "")


if __name__ == "__main__":
    # Quick test
    text = transcribe_audio("../../tests/data/test.mp3")
    print(text)
