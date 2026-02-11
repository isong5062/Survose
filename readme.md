[Wiki](https://github.com/StanfordCS194/win26-Team3/wiki)

# WORKFLOW
- run `python3 src/survose.py` from root, and it will place a demo call about Stockton crime rates.

# Overview of calling
1. `survose.py` is the main calling function.
2. First, verify required environment variables.
3. Runs `generate_survey_text` function to create text for the survey questions.
4. Runs `make_call` from `twilio.py` to make the call.
5. Within this function, it uses `elevenlabs.py` to turn the text into audio.
6. Then, it uploads the audio bytes to a temporary file held locally.
7. Then, it places the call, which you should be able to retrieve.

# Make targets
- `make install-requirements` installs required dependencies to run SurVose
