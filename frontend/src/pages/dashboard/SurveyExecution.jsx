import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSurveys } from '../../context/SurveysContext';

function SurveyExecution() {
  const { surveys, addSurvey } = useSurveys();
  const [showCreate, setShowCreate] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState(['']);

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const qs = questions.filter((q) => q.trim());
    addSurvey({
      title: title.trim() || 'Untitled Survey',
      questions: qs.length ? qs : ['Default question'],
    });
    setTitle('');
    setQuestions(['']);
    setShowCreate(false);
  };

  const addQuestion = () => setQuestions((q) => [...q, '']);

  const handleRun = (id) => {
    setRunningId(id);
    setTimeout(() => setRunningId(null), 3000);
  };

  return (
    <div>
      <h1>Autonomous Survey Execution</h1>
      <p>
        Voice AI autonomously conducts surveys, screens participants in real-time,
        and collects structured responses at scale.
      </p>

      <div style={{ marginTop: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={{
            padding: '0.5rem 1rem',
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Create survey
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreateSubmit}
          style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '0.75rem',
            maxWidth: '480px',
          }}
        >
          <h3 style={{ marginBottom: '1rem' }}>New survey</h3>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Survey title"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              marginBottom: '1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
            }}
          />
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Questions
          </label>
          {questions.map((q, i) => (
            <input
              key={i}
              type="text"
              value={q}
              onChange={(e) => {
                const next = [...questions];
                next[i] = e.target.value;
                setQuestions(next);
              }}
              placeholder={`Question ${i + 1}`}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                marginBottom: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
              }}
            />
          ))}
          <button
            type="button"
            onClick={addQuestion}
            aria-label="Add question"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.5rem',
              background: '#e5e7eb',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            + Add question
          </button>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              type="submit"
              style={{
                padding: '0.5rem 1rem',
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setTitle('');
                setQuestions(['']);
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Your surveys</h2>
        {surveys.length === 0 && !showCreate && (
          <p style={{ color: '#6b7280' }}>No surveys yet. Create one to get started.</p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {surveys.map((s) => (
            <li
              key={s.id}
              style={{
                padding: '1rem',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                marginBottom: '0.75rem',
                maxWidth: '560px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{s.title}</div>
              {s.questions?.length > 0 && (
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  {s.questions.length} question(s)
                </div>
              )}
              {runningId === s.id ? (
                <div
                  style={{
                    padding: '0.75rem',
                    background: '#eef2ff',
                    color: '#4f46e5',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                >
                  Survey in progress — integration with voice pipeline (e.g. eleven_labs) coming later.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleRun(s.id)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      background: '#4f46e5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Run
                  </button>
                  <Link
                    to="/dashboard/analysis"
                    state={{ surveyId: s.id }}
                    style={{
                      padding: '0.375rem 0.75rem',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    View responses
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default SurveyExecution;
