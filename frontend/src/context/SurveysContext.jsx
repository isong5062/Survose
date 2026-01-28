import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

const SurveysContext = createContext(null);

export function SurveysProvider({ children }) {
  const [surveys, setSurveys] = useState([]);
  const [uid, setUid] = useState(() => auth.currentUser?.uid ?? null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
  }, []);

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
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        list.sort((a, b) => {
          const toMs = (v) => {
            if (v?.toMillis) return v.toMillis();
            if (typeof v === 'string') return new Date(v).getTime() || 0;
            return 0;
          };
          return toMs(b.createdAt) - toMs(a.createdAt);
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

  const getSurveyById = useCallback(
    (id) => surveys.find((s) => s.id === id) ?? null,
    [surveys]
  );

  const value = {
    surveys,
    addSurvey,
    getSurveyById,
  };

  return <SurveysContext.Provider value={value}>{children}</SurveysContext.Provider>;
}

export function useSurveys() {
  const ctx = useContext(SurveysContext);
  if (!ctx) throw new Error('useSurveys must be used within SurveysProvider');
  return ctx;
}
