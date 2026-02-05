# Voice Survey API (FastAPI)

Backend for single-turn Twilio calls: play ElevenLabs question, record response, store in Firebase.

## Run locally

From project root:

```bash
pip install -r src/backend/requirements.txt
make run-backend
```

Or from this directory (`src/backend/`):

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
