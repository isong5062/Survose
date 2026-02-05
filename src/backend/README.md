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
- **FIREBASE_STORAGE_BUCKET** or **VITE_FIREBASE_STORAGE_BUCKET** – bucket name. If you use `project-id.firebasestorage.app` (from Firebase Console), the backend automatically tries `project-id.appspot.com` for the Google Cloud Storage API, which is often the actual bucket name.

Without credentials, the app still runs; `/health` returns `firebase: false`. The backend uses Firestore for the `recordings` collection and Storage for hosting question MP3s (and optionally saved recordings).

## Incoming call test (ElevenLabs + Twilio)

To test “call my number → hear an ElevenLabs question”:

1. **Env** (in `frontend/.env` or wherever the backend loads): `ELEVENLABS_API_KEY` (your ElevenLabs API key). Optional: `INCOMING_TEST_QUESTION` to override the default question.
2. **Public URL**: Twilio must reach your backend over HTTPS. Run [ngrok](https://ngrok.com/) (e.g. `ngrok http 8000`) and note the `https://...` URL.
3. **Twilio**: In [Twilio Console](https://console.twilio.com/) → Phone Numbers → your number (2094008683) → Voice. Under “A call comes in” set **Webhook** to `https://YOUR_NGROK_URL/voice/incoming`, method GET. Save.
4. **Backend**: Run `make run-backend` (Firebase + Storage required so the MP3 can be hosted for `<Play>`).
5. **Call** your Twilio number; you should hear the ElevenLabs question, then “Goodbye.”

**Optional: script to call your number** – Instead of calling the number yourself, run a script that uses Twilio to place an outbound call to you. From project root:

```bash
pip install -r src/backend/requirements.txt   # includes twilio
python scripts/call_my_number.py
```

Set in `frontend/.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `BACKEND_BASE_URL` (e.g. your ngrok HTTPS URL). Optional: `TWILIO_TO_NUMBER` (default +12094008683). Your phone will ring; when you answer, you’ll hear the ElevenLabs question. No need to configure the “incoming” webhook in Twilio Console for this—the script passes the TwiML URL when creating the call.
