import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const STORAGE_KEY_PREFIX = 'survose_surveys_';

const SurveysContext = createContext(null);

export function SurveysProvider({ children }) {
  const [surveys, setSurveys] = useState([]);
  const [uid, setUid] = useState(() => auth.currentUser?.uid ?? null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
  }, []);

  const loadSurveys = useCallback(() => {
    if (!uid) {
      setSurveys([]);
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + uid);
      const list = raw ? JSON.parse(raw) : [];
      setSurveys(Array.isArray(list) ? list : []);
    } catch {
      setSurveys([]);
    }
  }, [uid]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  const saveSurveys = useCallback(
    (list) => {
      if (!uid) return;
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + uid, JSON.stringify(list));
        setSurveys(list);
      } catch (e) {
        console.error('Failed to save surveys', e);
      }
    },
    [uid]
  );

  const addSurvey = useCallback(
    (survey) => {
      if (!uid) return;
      const newSurvey = {
        id: crypto.randomUUID?.() ?? Date.now().toString(36),
        ownerId: uid,
        createdAt: new Date().toISOString(),
        ...survey,
      };
      const next = [newSurvey, ...surveys];
      saveSurveys(next);
      return newSurvey.id;
    },
    [uid, surveys, saveSurveys]
  );

  const getSurveyById = useCallback(
    (id) => surveys.find((s) => s.id === id) ?? null,
    [surveys]
  );

  const value = {
    surveys,
    addSurvey,
    getSurveyById,
    loadSurveys,
  };

  return <SurveysContext.Provider value={value}>{children}</SurveysContext.Provider>;
}

export function useSurveys() {
  const ctx = useContext(SurveysContext);
  if (!ctx) throw new Error('useSurveys must be used within SurveysProvider');
  return ctx;
}
