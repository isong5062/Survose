"""
This file aims to transcribe audio files from elevenlabs to text used for analysis.
"""

import whisper

def transcribe_audio(filepath):
    """Transcribe audio file to text using OpenAI API."""

    # Load base whisper model
    model = whisper.load_model("base")

    # TODO we can create a tempfile in case the file is a bitstream from elevenlabs
    result = model.transcribe(filepath, fp16=False)

    print(result)

# just testing rn but it works wil have a quick unit test for this
transcribe_audio("../../tests/data/test.mp3")
