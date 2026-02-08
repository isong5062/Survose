"""
TEMPORARY SCRIPT TO CALL NUMBER
Place an outbound Twilio call to your number. When you answer, Twilio fetches
/voice/incoming from your backend and plays the ElevenLabs question.

Usage (from project root):
  pip install twilio python-dotenv   # or use backend venv: pip install -r src/backend/requirements.txt
  python scripts/call_my_number.py

Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, BACKEND_BASE_URL
  (script loads .env, frontend/.env, and src/voice_agent/.env)
  BACKEND_BASE_URL   e.g. https://abc123.ngrok.io  (must be HTTPS so Twilio can fetch TwiML)
  TWILIO_TO_NUMBER   optional, default +12094008683
"""

import os
import sys
from pathlib import Path

# Load env from project root, frontend/.env, and src/voice_agent/.env (Twilio creds often live here)
_project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_project_root))

from dotenv import load_dotenv
load_dotenv(_project_root / ".env")
load_dotenv(_project_root / "frontend" / ".env")
load_dotenv(_project_root / "src" / "voice_agent" / ".env")

def main():
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_num = os.getenv("TWILIO_FROM_NUMBER")
    base_url = (os.getenv("BACKEND_BASE_URL") or "").rstrip("/")
    to_num = os.getenv("TWILIO_TO_NUMBER", "+12094008683").strip()
    if not to_num.startswith("+"):
        to_num = "+1" + to_num.lstrip("1")

    missing = [k for k, v in [
        ("TWILIO_ACCOUNT_SID", sid),
        ("TWILIO_AUTH_TOKEN", token),
        ("TWILIO_FROM_NUMBER", from_num),
        ("BACKEND_BASE_URL", base_url),
    ] if not v
    if missing:
        print("Missing env:", ", ".join(missing))
        print("Set them in frontend/.env, src/voice_agent/.env, or .env. BACKEND_BASE_URL must be your public HTTPS URL (e.g. ngrok).")
        sys.exit(1)

    twiml_url = f"{base_url}/voice/incoming"
    from twilio.rest import Client
    client = Client(sid, token)
    call = client.calls.create(to=to_num, from_=from_num, url=twiml_url)
    print(f"Calling {to_num}. When you answer you'll hear the ElevenLabs question.")
    print(f"Call SID: {call.sid}")

if __name__ == "__main__":
    main()
