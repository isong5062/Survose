import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// --- Firebase AI (Gemini) for Survey QA ---
const surveyQAReportSchema = Schema.object({
  properties: {
    bias: Schema.array({ items: Schema.string() }),
    demographics: Schema.array({ items: Schema.string() }),
    leadingQuestions: Schema.array({ items: Schema.string() }),
    clarity: Schema.array({ items: Schema.string() }),
    lengthAndFatigue: Schema.array({ items: Schema.string() }),
    sensitivityAndEthics: Schema.array({ items: Schema.string() }),
  },
});

const ai = getAI(app, { backend: new GoogleAIBackend() });
export const surveyQAModel = getGenerativeModel(ai, {
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: surveyQAReportSchema,
  },
});

// Model for QA-based suggestions (free-form JSON, no schema)
export const surveySuggestionsModel = getGenerativeModel(ai, {
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
  },
});