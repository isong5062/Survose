import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSurveys } from '../../context/SurveysContext';

function questionText(q) {
  return typeof q === 'string' ? q : (q?.text ?? '');
}

function computeSummary(survey, responses) {
  const questions = survey.questions || [{ text: 'Default question', type: 'short_text' }];
  const completed = responses.filter((r) => r.completed).length;
  const completionRate = responses.length ? Math.round((completed / responses.length) * 100) : 0;

  const distributions = questions.map((q, qIdx) => {
    const qText = questionText(q);
    const counts = {};
    responses.forEach((r) => {
      const val = r.answers?.[qIdx] ?? '(skipped)';
      counts[val] = (counts[val] ?? 0) + 1;
    });
    const total = responses.length;
    const entries = Object.entries(counts).map(([label, n]) => ({
      label,
      count: n,
      pct: total ? Math.round((n / total) * 100) : 0,
    }));
    return { question: qText, entries, total };
  });

  return {
    responseCount: responses.length,
    completedCount: completed,
    completionRate,
    distributions,
  };
}

function SurveyAnalysis() {
  const { surveys, getSurveyById, getResponses } = useSurveys();
  const location = useLocation();
  const navigate = useNavigate();
  const linkedSurveyId = location.state?.surveyId ?? '';

  const [selectedId, setSelectedId] = useState(linkedSurveyId || (surveys[0]?.id ?? ''));
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);

  const selectedSurvey = selectedId ? getSurveyById(selectedId) : null;

  const summary = useMemo(() => {
    if (!selectedSurvey) return null;
    return computeSummary(selectedSurvey, responses);
  }, [selectedSurvey, responses]);

  const fetchResponses = useCallback(async (surveyId) => {
    if (!surveyId) {
      setResponses([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getResponses(surveyId);
      setResponses(data);
    } catch {
      setResponses([]);
    } finally {
      setLoading(false);
    }
  }, [getResponses]);

  useEffect(() => {
    fetchResponses(selectedId);
  }, [selectedId, fetchResponses]);

  const handleSurveyChange = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    if (id && location.state?.surveyId) {
      navigate('/dashboard/analysis', { replace: true, state: {} });
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts.toMillis ? ts.toMillis() : ts);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <h1>Survey Data Analysis and Display</h1>
      <p>
        Analyze and visualize survey data: response counts, completion rates,
        , question-by-question distributions, and transcribed responses.
      </p>

      <section style={{ marginTop: '1.5rem' }}>
        <label htmlFor="analysis-survey-select" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          Select a survey
        </label>
        <select
          id="analysis-survey-select"
          value={selectedId}
          onChange={handleSurveyChange}
          style={{
            padding: '0.5rem 0.75rem',
            minWidth: '280px',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
          }}
        >
          <option value="">— Choose a survey —</option>
          {surveys.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        {surveys.length === 0 && (
          <p style={{ color: '#6b7280', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            No surveys yet. Create one in Survey Execution first.
          </p>
        )}
      </section>

      {selectedSurvey && (
        <section
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            maxWidth: '720px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Results</h2>
            <button
              type="button"
              onClick={() => fetchResponses(selectedId)}
              disabled={loading}
              style={{
                padding: '0.375rem 0.75rem',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.8125rem',
                color: '#374151',
              }}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {summary && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  padding: '1rem',
                  background: '#fff',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Responses
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' }}>
                  {summary.responseCount}
                </div>
              </div>
              <div
                style={{
                  padding: '1rem',
                  background: '#fff',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Completed
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' }}>
                  {summary.completedCount}
                </div>
              </div>
              <div
                style={{
                  padding: '1rem',
                  background: '#fff',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Completion rate
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' }}>
                  {summary.completionRate}%
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <p style={{ color: '#6b7280', fontSize: '0.9375rem' }}>Loading responses...</p>
          ) : responses.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.9375rem' }}>
              No responses yet. Run this survey to collect data, then view results here.
            </p>
          ) : (
            <>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#374151' }}>
                Transcribed Responses
              </h3>
              {responses.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    background: '#fff',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9375rem' }}>
                      Response {responses.length - i}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {formatTimestamp(r.createdAt)}
                    </span>
                  </div>
                  {r.question && (
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <span style={{ fontWeight: 500 }}>Q: </span>
                      {r.question}
                    </div>
                  )}
                  <div style={{ fontSize: '0.9375rem', color: '#1f2937', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 500, color: '#374151' }}>A: </span>
                    {r.transcription || '(no transcription)'}
                  </div>
                </div>
              ))}

              {summary && summary.distributions.length > 0 && (
                <>
                  <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1rem', color: '#374151' }}>
                    Question distributions
                  </h3>
                  {summary.distributions.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: '1.25rem',
                        padding: '1rem',
                        background: '#fff',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
                        Q{i + 1}: {d.question}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#4b5563' }}>
                        {d.entries.map((e, j) => (
                          <li key={j} style={{ marginBottom: '0.25rem' }}>
                            {e.label}: {e.count} ({e.pct}%)
                          </li>
                        ))}
                      </ul>
                      <div
                        style={{
                          display: 'flex',
                          gap: '4px',
                          marginTop: '0.5rem',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        {d.entries.map((e, j) => (
                          <div
                            key={j}
                            style={{
                              height: '8px',
                              width: `${Math.max(e.pct, 4)}%`,
                              minWidth: '20px',
                              background: ['#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe'][j % 4],
                              borderRadius: '4px',
                            }}
                            title={`${e.label}: ${e.pct}%`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
export default SurveyAnalysis;
