import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

const SurveysContext = createContext(null);

export function SurveysProvider({ children }) {
  const [surveys, setSurveys] = useState([]);
  const [uid, setUid] = useState(() => auth.currentUser?.uid ?? null);
  const [qaReports, setQaReports] = useState(() => ({}));
  const [qaSuggestions, setQaSuggestions] = useState(() => ({}));
  const [qaSelectedSurveyId, setQaSelectedSurveyId] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
  }, []);

  const normalizeQuestions = (questions) => {
    if (!Array.isArray(questions)) return [];
    return questions.map((q, idx) => {
      if (typeof q === 'string') {
        return {
          id: `q${idx}`,
          text: q,
          type: 'open_ended',
          options: {},
        };
      }
      return {
        id: q.id || `q${idx}`,
        text: q.text || '',
        type: q.type || 'open_ended',
        options: q.options || {},
      };
    });
  };

  useEffect(() => {
    if (!uid) {
      setSurveys([]);
      return;
    }
    const surveysRef = collection(db, 'surveys');
    const q = query(surveysRef, where('ownerId', '==', uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            questions: normalizeQuestions(data.questions),
          };
        });
        list.sort((a, b) => {
          const toMs = (v) => {
            if (v?.toMillis) return v.toMillis();
            if (typeof v === 'string') return new Date(v).getTime() || 0;
            return 0;
          };
          const aTime = toMs(a.updatedAt) || toMs(a.createdAt);
          const bTime = toMs(b.updatedAt) || toMs(b.createdAt);
          return bTime - aTime;
        });
        setSurveys(list);
      },
      (err) => {
        console.error('Firestore surveys listener error:', err);
        setSurveys([]);
      }
    );
    return () => unsubscribe();
  }, [uid]);

  const addSurvey = useCallback(
    async (survey) => {
      if (!uid) return null;
      try {
        const docRef = await addDoc(collection(db, 'surveys'), {
          ownerId: uid,
          title: survey.title ?? 'Untitled Survey',
          questions: survey.questions ?? [],
          createdAt: serverTimestamp(),
        });
        return docRef.id;
      } catch (e) {
        console.error('Failed to add survey:', e);
        return null;
      }
    },
    [uid]
  );

  const updateSurvey = useCallback(
    async (id, updates) => {
      if (!uid) return false;
      try {
        const surveyRef = doc(db, 'surveys', id);
        await updateDoc(surveyRef, {
          title: updates.title,
          questions: updates.questions,
          updatedAt: serverTimestamp(),
        });
        return true;
      } catch (e) {
        console.error('Failed to update survey:', e);
        return false;
      }
    },
    [uid]
  );

  const deleteSurvey = useCallback(
    async (id) => {
      if (!uid) return false;
      try {
        const surveyRef = doc(db, 'surveys', id);
        await deleteDoc(surveyRef);
        return true;
      } catch (e) {
        console.error('Failed to delete survey:', e);
        return false;
      }
    },
    [uid]
  );

  const getSurveyById = useCallback(
    (id) => surveys.find((s) => s.id === id) ?? null,
    [surveys]
  );

  const getQAReport = useCallback(
    (surveyId) => qaReports[surveyId] ?? null,
    [qaReports]
  );

  const setQAReport = useCallback((surveyId, report) => {
    setQaReports((prev) => ({ ...prev, [surveyId]: report }));
  }, []);

  const getQASuggestions = useCallback(
    (surveyId) => qaSuggestions[surveyId] ?? [],
    [qaSuggestions]
  );

  const setQASuggestions = useCallback((surveyId, list) => {
    setQaSuggestions((prev) => ({ ...prev, [surveyId]: list }));
  }, []);

  const value = {
    surveys,
    addSurvey,
    updateSurvey,
    deleteSurvey,
    getSurveyById,
    getQAReport,
    setQAReport,
    getQASuggestions,
    setQASuggestions,
    qaSelectedSurveyId,
    setQaSelectedSurveyId,
  };

  return <SurveysContext.Provider value={value}>{children}</SurveysContext.Provider>;
}

export function useSurveys() {
  const ctx = useContext(SurveysContext);
  if (!ctx) throw new Error('useSurveys must be used within SurveysProvider');
  return ctx;
}
