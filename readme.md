[Wiki](https://github.com/StanfordCS194/win26-Team3/wiki)

# WORKFLOW
- Run `python3 src/survose.py` from the repo root to place a demo call.
- Run the frontend dev server (`cd frontend && npm run dev`) and click Run in UI to execute `src/survose.py`.

# Overview of calling
1. `survose.py` is the main calling function.
2. It verifies required environment variables and can load missing values from Google Secret Manager.
3. Runs `generate_survey_text` function to create text for the survey questions.
4. Runs `make_call` from `twilio.py` to make the call.
5. Within this function, it uses `elevenlabs.py` to turn the text into audio.
6. Then, it uploads the audio bytes to a temporary file held locally.
7. Then, it places the call, which you should be able to retrieve.

# Google Secret Manager (local backend)
Enable Secret Manager loading for local runs:

1. Authenticate locally with ADC:
   - `gcloud auth application-default login`

# Frontend Run Button
- The Run button in `frontend/src/pages/dashboard/SurveyExecution.jsx` calls:
  - `POST /api/surveys/run`
- That route is handled by the Vite dev server and executes `src/survose.py` directly.
