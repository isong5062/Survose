import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSurveys } from '../../context/SurveysContext';
import './SurveyAnalysis.css';

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

  const BAR_COLORS = ['var(--primary)', '#34d399', '#6ee7b7', '#a7f3d0'];

  return (
    <div className="sa-page">
      <div className="sa-header">
        <h1 className="sa-title">Survey Analysis</h1>
        <p className="sa-subtitle">
          Analyze and visualize survey data: response counts, completion rates, and transcribed responses.
        </p>
      </div>

      <section className="sa-select-section">
        <label htmlFor="analysis-survey-select" className="sa-label">
          Select a survey
        </label>
        <select
          id="analysis-survey-select"
          value={selectedId}
          onChange={handleSurveyChange}
          className="sa-select"
        >
          <option value="">-- Choose a survey --</option>
          {surveys.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        {surveys.length === 0 && (
          <p className="sa-empty-hint">
            No surveys yet. Create one in Survey Execution first.
          </p>
        )}
      </section>

      {selectedSurvey && (
        <section className="sa-results">
          <div className="sa-results-header">
            <h2 className="sa-results-title">Results</h2>
            <button
              type="button"
              onClick={() => fetchResponses(selectedId)}
              disabled={loading}
              className="sa-refresh-btn"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {summary && (
            <div className="sa-stats-grid">
              <div className="sa-stat-card">
                <div className="sa-stat-label">Responses</div>
                <div className="sa-stat-value">{summary.responseCount}</div>
              </div>
              <div className="sa-stat-card">
                <div className="sa-stat-label">Completed</div>
                <div className="sa-stat-value">{summary.completedCount}</div>
              </div>
              <div className="sa-stat-card">
                <div className="sa-stat-label">Completion rate</div>
                <div className="sa-stat-value">{summary.completionRate}%</div>
              </div>
            </div>
          )}

          {loading ? (
            <p className="sa-loading-text">Loading responses...</p>
          ) : responses.length === 0 ? (
            <p className="sa-loading-text">
              No responses yet. Run this survey to collect data, then view results here.
            </p>
          ) : (
            <>
              <h3 className="sa-section-heading">Transcribed Responses</h3>
              {responses.map((r, i) => (
                <div key={r.id} className="sa-response-card">
                  <div className="sa-response-top">
                    <span className="sa-response-label">Response {responses.length - i}</span>
                    <span className="sa-response-date">{formatTimestamp(r.createdAt)}</span>
                  </div>
                  {r.question && (
                    <div className="sa-response-question">
                      <span className="sa-response-q">Q: </span>
                      {r.question}
                    </div>
                  )}
                  <div className="sa-response-answer">
                    <span className="sa-response-a">A: </span>
                    {r.transcription || '(no transcription)'}
                  </div>
                </div>
              ))}

              {summary && summary.distributions.length > 0 && (
                <>
                  <h3 className="sa-section-heading sa-section-heading-mt">
                    Question distributions
                  </h3>
                  {summary.distributions.map((d, i) => (
                    <div key={i} className="sa-distribution-card">
                      <div className="sa-distribution-question">
                        Q{i + 1}: {d.question}
                      </div>
                      <ul className="sa-distribution-list">
                        {d.entries.map((e, j) => (
                          <li key={j} className="sa-distribution-item">
                            {e.label}: {e.count} ({e.pct}%)
                          </li>
                        ))}
                      </ul>
                      <div className="sa-distribution-bars">
                        {d.entries.map((e, j) => (
                          <div
                            key={j}
                            className="sa-distribution-bar"
                            style={{
                              width: `${Math.max(e.pct, 4)}%`,
                              minWidth: '20px',
                              background: BAR_COLORS[j % BAR_COLORS.length],
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
