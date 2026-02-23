import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

/** Placeholder LLM reply for analysis chat. Replace with surveyAnalysisChatModel.generateContent() when ready. */
function getPlaceholderAnalysisReply(survey, summary, userMessage) {
  const lower = (userMessage || '').toLowerCase();
  const title = survey?.title || 'this survey';
  const count = summary?.responseCount ?? 0;
  const rate = summary?.completionRate ?? 0;

  if (lower.includes('summary') || lower.includes('overview') || lower.includes('how many')) {
    return `For **${title}**, the current dataset shows ${count} total response(s) and a ${rate}% completion rate. ${count > 0 ? 'Review the distributions below for question-level breakdowns.' : 'Collect more responses to get richer insights.'}`;
  }
  if (lower.includes('completion') || lower.includes('drop')) {
    return `Completion rate for **${title}** is ${rate}%. ${rate >= 80 ? 'This is a solid completion rate.' : rate >= 50 ? 'Consider shortening the survey or clarifying instructions to improve completion.' : 'Low completion may indicate survey length or friction—review question count and flow.'}`;
  }
  if (lower.includes('insight') || lower.includes('find') || lower.includes('pattern')) {
    return `Placeholder insight: With ${count} response(s), patterns will become clearer as you collect more data. Check the question distributions on this page for response spread and common answers. You can ask me for a summary or completion analysis.`;
  }
  // Default
  return `I can help you understand **${title}** (${count} responses, ${rate}% completion). Ask for a summary, completion analysis, or insights—using placeholder data for now.`;
}

function SurveyAnalysis() {
  const { surveys, getSurveyById, getResponses } = useSurveys();
  const location = useLocation();
  const navigate = useNavigate();
  const linkedSurveyId = location.state?.surveyId ?? '';

  const [selectedId, setSelectedId] = useState(linkedSurveyId || (surveys[0]?.id ?? ''));
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef(null);

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

  useEffect(() => {
    setChatMessages([]);
  }, [selectedId]);

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

  const handleChatSend = useCallback(
    async (e) => {
      e?.preventDefault();
      const text = (chatInput || '').trim();
      if (!text || chatSending) return;
      setChatInput('');
      const userMsg = { role: 'user', content: text };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatSending(true);
      try {
        // Placeholder: simulate latency and return canned reply. Replace with:
        // const result = await surveyAnalysisChatModel.generateContent(prompt);
        // const reply = result?.response?.text() ?? '';
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
        const reply = getPlaceholderAnalysisReply(selectedSurvey, summary, text);
        setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } catch {
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I couldn’t generate a response right now. Please try again.' },
        ]);
      } finally {
        setChatSending(false);
      }
    },
    [chatInput, chatSending, selectedSurvey, summary]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatSending]);

  return (
    <div className="analysis-page">
      <div className="analysis-header">
        <h1 className="analysis-title">Survey Data Analysis</h1>
        <p className="analysis-subtitle">
          Analyze and visualize survey data: response counts, completion rates,
          question-by-question distributions, and transcribed responses.
        </p>
      </div>

      <section className="analysis-select-section">
        <div className="analysis-card">
          <label htmlFor="analysis-survey-select" className="analysis-label">
            Select a survey
          </label>
          <select
            id="analysis-survey-select"
            className="analysis-select"
            value={selectedId}
            onChange={handleSurveyChange}
          >
            <option value="">— Choose a survey —</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          {surveys.length === 0 && (
            <p className="analysis-empty-hint">
              No surveys yet. Create one in Survey Execution first.
            </p>
          )}
        </div>
      </section>

      {selectedSurvey && (
        <>
        <section className="analysis-card analysis-results-card">
          <div className="analysis-results-header">
            <h2 className="analysis-results-title">Summary</h2>
            <button
              type="button"
              className="analysis-btn analysis-btn-ghost"
              onClick={() => fetchResponses(selectedId)}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {summary && (
            <div className="analysis-stats-grid">
              <div className="analysis-stat-card">
                <div className="analysis-stat-label">Responses</div>
                <div className="analysis-stat-value">{summary.responseCount}</div>
              </div>
              <div className="analysis-stat-card">
                <div className="analysis-stat-label">Completed</div>
                <div className="analysis-stat-value">{summary.completedCount}</div>
              </div>
              <div className="analysis-stat-card">
                <div className="analysis-stat-label">Completion rate</div>
                <div className="analysis-stat-value">{summary.completionRate}%</div>
              </div>
            </div>
          )}

          {loading ? (
            <p className="analysis-loading">Loading responses…</p>
          ) : responses.length === 0 ? (
            <p className="analysis-empty-state">
              No responses yet. Run this survey to collect data, then view summary here.
            </p>
          ) : (
            <>
              <h3 className="analysis-section-title">Transcribed Responses</h3>
              <div className="analysis-response-list">
                {responses.map((r, i) => (
                  <div key={r.id} className="analysis-response-card">
                    <div className="analysis-response-header">
                      <span className="analysis-response-name">Response {responses.length - i}</span>
                      <span className="analysis-response-time">{formatTimestamp(r.createdAt)}</span>
                    </div>
                    {r.question && (
                      <div className="analysis-response-question">
                        <strong>Q: </strong>
                        {r.question}
                      </div>
                    )}
                    <div className="analysis-response-answer">
                      <strong>A: </strong>
                      {r.transcription || '(no transcription)'}
                    </div>
                  </div>
                ))}
              </div>

              {summary && summary.distributions.length > 0 && (
                <>
                  <h3 className="analysis-distributions-title">Question distributions</h3>
                  {summary.distributions.map((d, i) => (
                    <div key={i} className="analysis-distribution-card">
                      <div className="analysis-distribution-question">
                        Q{i + 1}: {d.question}
                      </div>
                      <ul className="analysis-distribution-list">
                        {d.entries.map((e, j) => (
                          <li key={j}>
                            {e.label}: {e.count} ({e.pct}%)
                          </li>
                        ))}
                      </ul>
                      <div className="analysis-distribution-bars">
                        {d.entries.map((e, j) => (
                          <div
                            key={j}
                            className="analysis-distribution-bar"
                            style={{ width: `${Math.max(e.pct, 4)}%` }}
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

        {/* AI Insights chat — placeholder replies; wire surveyAnalysisChatModel.generateContent() for real LLM */}
        <section className="analysis-ai-chat" aria-label="AI survey insights">
          <div className="analysis-ai-chat__header">
            <h2>Survey Insights</h2>
            <span className="analysis-ai-badge">AI</span>
          </div>
          <div className="analysis-ai-chat__messages">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`analysis-ai-chat__message analysis-ai-chat__message--${msg.role}`}
              >
                {msg.role === 'assistant' && (
                  <div className="message-role">Insights</div>
                )}
                <div>
                  {msg.content.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                  )}
                </div>
              </div>
            ))}
            {chatSending && (
              <div className="analysis-ai-chat__typing">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form className="analysis-ai-chat__form" onSubmit={handleChatSend}>
            <input
              type="text"
              className="analysis-ai-chat__input"
              placeholder="Ask about this survey (e.g. summary, completion, insights)"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatSending}
              aria-label="Message for survey insights"
            />
            <button
              type="submit"
              className="analysis-ai-chat__send"
              disabled={chatSending || !chatInput.trim()}
            >
              {chatSending ? 'Sending…' : 'Send'}
            </button>
          </form>
          <p className="analysis-ai-chat__prompt-hint">
            Try: “Give me a summary” or “What’s the completion rate?”
          </p>
        </section>
        </>
      )}
    </div>
  );
}
export default SurveyAnalysis;
