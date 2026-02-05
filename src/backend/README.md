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
- Health: http://localhost:8000/health (includes `firebase: true/false` if Admin is configured)

## Firebase (Firestore + Storage)

The backend uses the **same Firebase project** as the frontend.

- **GOOGLE_APPLICATION_CREDENTIALS** or **FIREBASE_CREDENTIALS_PATH** – path to your Firebase service account JSON (e.g. from Project settings → Service accounts → Generate new private key). Put this in `frontend/.env` if you like.
- **FIREBASE_STORAGE_BUCKET** or **VITE_FIREBASE_STORAGE_BUCKET** – bucket name. If you already have `VITE_FIREBASE_STORAGE_BUCKET` in `frontend/.env` for the frontend, the backend will use it when `FIREBASE_STORAGE_BUCKET` is not set.

Without credentials, the app still runs; `/health` returns `firebase: false`. The backend uses Firestore for the `recordings` collection and Storage for hosting question MP3s (and optionally saved recordings).
