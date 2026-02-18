import { useState, useRef, useEffect } from 'react';
import { useSurveys } from '../../context/SurveysContext';
import { surveyQAModel, surveySuggestionsModel } from '../../firebase';
import './SurveyQA.css';

const QA_SYSTEM_PROMPT = `You are a survey quality assurance expert. Analyze the given survey and return a JSON object with exactly six arrays of strings. Use these keys: bias, demographics, leadingQuestions, clarity, lengthAndFatigue, sensitivityAndEthics.

- bias: Potential sources of bias (sample, selection, order, wording). Be specific; cite question numbers where relevant.
- demographics: Whether key demographics are covered (age, gender, region, etc.) and what might be missing for representativeness.
- leadingQuestions: Questions that suggest a preferred answer, use loaded language, or could skew responses. Note question number and why.
- clarity: Ambiguous wording, double-barreled questions (two things in one), jargon, unclear instructions, or confusing flow. Cite question numbers.
- lengthAndFatigue: Survey length, repetition, risk of respondent fatigue or drop-off, or suggestions to shorten/streamline.
- sensitivityAndEthics: Sensitive topics, consent, privacy, placement of personal or sensitive questions, and whether the survey is appropriate and respectful.

If a category has no issues, include one brief positive or neutral note (e.g. "No major clarity issues detected"). Always return at least one item per array.`;

const QA_SECTION_KEYS = [
  'bias',
  'demographics',
  'leadingQuestions',
  'clarity',
  'lengthAndFatigue',
  'sensitivityAndEthics',
];

const QA_SECTION_LABELS = {
  bias: 'Potential Bias',
  demographics: 'Demographics',
  leadingQuestions: 'Leading Questions',
  clarity: 'Clarity & Wording',
  lengthAndFatigue: 'Length & Fatigue',
  sensitivityAndEthics: 'Sensitivity & Ethics',
};

const QA_SECTION_ICONS = {
  bias: '⚖️',
  demographics: '👥',
  leadingQuestions: '🎯',
  clarity: '💬',
  lengthAndFatigue: '⏱️',
  sensitivityAndEthics: '🛡️',
};

const QUESTION_TYPE_LABELS = {
  open_ended: 'Open-ended',
  scale: 'Scale',
  multiple_choice: 'Multiple Choice',
  checkbox: 'Checkbox',
  yes_no: 'Yes / No',
};

function QuestionDisplay({ question, label = null }) {
  if (!question) return null;
  const q = typeof question === 'string' ? { text: question, type: 'open_ended', options: {} } : question;
  const typeLabel = QUESTION_TYPE_LABELS[q.type] || q.type;
  return (
    <div className="qa-question-display">
      {label && <div className="qa-question-display-label">{label}</div>}
      <div className="qa-question-display-text">{q.text || '(No text)'}</div>
      <div className="qa-question-display-meta">
        Type: {typeLabel}
        {q.type === 'scale' && (q.options?.min != null || q.options?.max != null) && (
          <span className="qa-question-display-range">Range: {q.options.min ?? 1} to {q.options.max ?? 10}</span>
        )}
        {(q.type === 'multiple_choice' || q.type === 'checkbox') && (q.options?.choices?.length > 0) && (
          <div className="qa-question-display-choices">
            Options: {(q.options.choices || []).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

async function runSurveyQAWithAI(survey) {
  const questionLines =
    survey.questions?.map((q, i) => {
      const text = typeof q === 'string' ? q : q?.text ?? '';
      const type = typeof q === 'object' && q?.type ? ` [${q.type}]` : '';
      const opts = typeof q === 'object' && q?.options && Object.keys(q.options).length ? ` Options: ${JSON.stringify(q.options)}` : '';
      return `Q${i + 1}: ${text}${type}${opts}`.trim();
    }).filter(Boolean) ?? [];
  const prompt = `Survey title: ${survey.title ?? 'Untitled'}\n\nQuestions:\n${questionLines.join('\n')}`;
  const fullPrompt = `${QA_SYSTEM_PROMPT}\n\n${prompt}`;

  const result = await surveyQAModel.generateContent(fullPrompt);
  const text = result.response.text();
  if (!text || !text.trim()) {
    throw new Error('No response from AI.');
  }
  const parsed = JSON.parse(text);
  const ensureArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []);
  const sections = {};
  for (const key of QA_SECTION_KEYS) {
    sections[key] = ensureArray(parsed[key]);
  }
  return {
    surveyId: survey.id,
    runAt: new Date().toISOString(),
    sections,
  };
}

const SUGGESTIONS_SYSTEM_PROMPT = `You are a survey quality expert. Given a survey and its QA report, produce concrete actionable suggestions to improve the survey. Return a single JSON object with one key: "suggestions", an array of suggestion objects. Each suggestion must have: "type", "category", "reason". Use questionIndex as 1-based (Q1 = 1). Use these types and extra fields:

- type "edit_question": also include questionIndex (1-based), questionId (string, e.g. "q0"), originalText (current question text), suggestedText (improved wording).
- type "edit_title": also include originalTitle, suggestedTitle.
- type "add_question": also include suggestedQuestion (object with text, type, options). type is one of: open_ended, scale, multiple_choice, checkbox, yes_no. options: {} for open_ended, { min, max } for scale, { choices: string[] } for multiple_choice/checkbox, {} for yes_no.
- type "remove_question": also include questionIndex (1-based), questionId, questionText (for display).

Category must be one of: bias, demographics, leadingQuestions, clarity, lengthAndFatigue, sensitivityAndEthics. Produce 3 to 8 suggestions. Only suggest changes that directly address QA findings. Return only valid JSON.`;

function buildSuggestionsPrompt(survey, report) {
  const questionLines =
    survey.questions?.map((q, i) => {
      const text = typeof q === 'string' ? q : q?.text ?? '';
      const type = typeof q === 'object' && q?.type ? q.type : 'open_ended';
      const opts = typeof q === 'object' && q?.options && Object.keys(q.options || {}).length ? JSON.stringify(q.options) : '{}';
      return `Q${i + 1} (id: ${typeof q === 'object' && q?.id ? q.id : `q${i}`}): ${text} [type: ${type}, options: ${opts}]`;
    }).filter(Boolean) ?? [];
  const reportText = QA_SECTION_KEYS.map(
    (key) => `${QA_SECTION_LABELS[key]}:\n${(report.sections[key] ?? []).map((s) => `- ${s}`).join('\n')}`
  ).join('\n\n');
  return `${SUGGESTIONS_SYSTEM_PROMPT}\n\nSurvey title: ${survey.title ?? 'Untitled'}\n\nQuestions:\n${questionLines.join('\n')}\n\nQA Report:\n${reportText}`;
}

function normalizeSuggestions(raw) {
  const list = Array.isArray(raw?.suggestions) ? raw.suggestions : Array.isArray(raw) ? raw : [];
  return list.map((s, i) => {
    const base = {
      id: `suggestion-${Date.now()}-${i}`,
      type: s.type || 'edit_question',
      category: s.category || 'clarity',
      reason: s.reason || '',
      status: 'pending',
    };
    if (base.type === 'edit_question') {
      return {
        ...base,
        questionIndex: Math.max(0, (Number(s.questionIndex) || 1) - 1),
        questionId: s.questionId || `q${(s.questionIndex || 1) - 1}`,
        originalText: s.originalText ?? '',
        suggestedText: s.suggestedText ?? s.originalText ?? '',
        suggestedType: s.suggestedType ?? 'open_ended',
        suggestedOptions: s.suggestedOptions ?? {},
      };
    }
    if (base.type === 'edit_title') {
      return {
        ...base,
        originalTitle: s.originalTitle ?? '',
        suggestedTitle: s.suggestedTitle ?? s.originalTitle ?? '',
      };
    }
    if (base.type === 'add_question') {
      const sq = s.suggestedQuestion || {};
      return {
        ...base,
        suggestedQuestion: {
          text: sq.text ?? '',
          type: sq.type || 'open_ended',
          options: sq.options || {},
        },
      };
    }
    if (base.type === 'remove_question') {
      return {
        ...base,
        questionIndex: Math.max(0, (Number(s.questionIndex) || 1) - 1),
        questionId: s.questionId || `q${(s.questionIndex || 1) - 1}`,
        questionText: s.questionText ?? '',
      };
    }
    return base;
  });
}

async function runGenerateSuggestions(survey, report) {
  const prompt = buildSuggestionsPrompt(survey, report);
  const result = await surveySuggestionsModel.generateContent(prompt);
  const text = result.response.text();
  if (!text || !text.trim()) throw new Error('No response from AI.');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON from suggestions model.');
  }
  return normalizeSuggestions(parsed);
}

function SurveyQA() {
  const { surveys, getSurveyById, getQAReport, setQAReport, getQASuggestions, setQASuggestions, qaSelectedSurveyId, setQaSelectedSurveyId, updateSurvey } = useSurveys();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [qaReportOpen, setQaReportOpen] = useState(true);
  const [suggestedChangesOpen, setSuggestedChangesOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSurveys = surveys.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedSurvey = qaSelectedSurveyId ? getSurveyById(qaSelectedSurveyId) : null;
  const report = qaSelectedSurveyId ? getQAReport(qaSelectedSurveyId) : null;
  const suggestions = qaSelectedSurveyId ? getQASuggestions(qaSelectedSurveyId) : [];

  const handleRunQA = async () => {
    if (!selectedSurvey) return;
    setError(null);
    setLoading(true);
    try {
      const result = await runSurveyQAWithAI(selectedSurvey);
      setQAReport(selectedSurvey.id, result);
      setQASuggestions(selectedSurvey.id, []);
      setSuggestionsError(null);
    } catch (e) {
      setError(e?.message || 'QA analysis failed.');
      setQAReport(selectedSurvey.id, null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!selectedSurvey || !report) return;
    setSuggestionsError(null);
    setSuggestionsLoading(true);
    try {
      const list = await runGenerateSuggestions(selectedSurvey, report);
      const enriched = list.map((s) => {
        if (s.type === 'edit_question' && selectedSurvey?.questions?.[s.questionIndex]) {
          const q = selectedSurvey.questions[s.questionIndex];
          return {
            ...s,
            originalType: q.type || 'open_ended',
            originalOptions: q.options || {},
            suggestedType: s.suggestedType ?? q.type ?? 'open_ended',
            suggestedOptions: s.suggestedOptions ?? q.options ?? {},
          };
        }
        return s;
      });
      setQASuggestions(selectedSurvey.id, enriched);
    } catch (e) {
      setSuggestionsError(e?.message || 'Failed to generate suggestions.');
      setQASuggestions(selectedSurvey.id, []);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const updateSuggestion = (suggestionId, updates) => {
    if (!qaSelectedSurveyId) return;
    const next = suggestions.map((s) => (s.id === suggestionId ? { ...s, ...updates } : s));
    setQASuggestions(qaSelectedSurveyId, next);
  };

  const applySuggestion = async (suggestion) => {
    setSuggestionsError(null);
    if (!qaSelectedSurveyId) return;
    const survey = getSurveyById(qaSelectedSurveyId);
    if (!survey) return;

    if (suggestion.type === 'edit_question') {
      const idx = suggestion.questionIndex;
      if (idx < 0 || !Array.isArray(survey.questions) || idx >= survey.questions.length) {
        setSuggestionsError('Invalid question index for this suggestion.');
        return;
      }
      const questions = survey.questions.map((q, i) =>
        i === idx
          ? { ...q, text: suggestion.suggestedText, type: suggestion.suggestedType ?? q.type, options: suggestion.suggestedOptions ?? q.options }
          : q
      );
      const ok = await updateSurvey(survey.id, { title: survey.title, questions });
      if (ok) updateSuggestion(suggestion.id, { status: 'accepted' });
      else setSuggestionsError('Failed to update survey.');
    } else if (suggestion.type === 'edit_title') {
      const ok = await updateSurvey(survey.id, {
        title: suggestion.suggestedTitle,
        questions: survey.questions,
      });
      if (ok) updateSuggestion(suggestion.id, { status: 'accepted' });
      else setSuggestionsError('Failed to update survey.');
    } else if (suggestion.type === 'add_question') {
      const newQ = {
        id: `q${Date.now()}`,
        text: suggestion.suggestedQuestion?.text ?? '',
        type: suggestion.suggestedQuestion?.type ?? 'open_ended',
        options: suggestion.suggestedQuestion?.options ?? {},
      };
      const questions = [...(survey.questions || []), newQ];
      const ok = await updateSurvey(survey.id, { title: survey.title, questions });
      if (ok) updateSuggestion(suggestion.id, { status: 'accepted' });
      else setSuggestionsError('Failed to update survey.');
    } else if (suggestion.type === 'remove_question') {
      const questions = (survey.questions || []).filter((q) => q.id !== suggestion.questionId);
      if (questions.length === survey.questions.length) {
        setSuggestionsError('Question not found for removal.');
        return;
      }
      const ok = await updateSurvey(survey.id, { title: survey.title, questions });
      if (ok) updateSuggestion(suggestion.id, { status: 'accepted' });
      else setSuggestionsError('Failed to update survey.');
    }
  };

  const denySuggestion = (suggestionId) => {
    updateSuggestion(suggestionId, { status: 'denied' });
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  const suggestionTypeLabel = (type) => {
    const labels = { edit_question: 'Edit Question', edit_title: 'Edit Title', add_question: 'Add Question', remove_question: 'Remove Question' };
    return labels[type] || type;
  };

  return (
    <div className="qa-page">
      <div className="qa-header">
        <div>
          <h1 className="qa-title">QA Testing</h1>
          <p className="qa-subtitle">
            Analyze surveys for bias, clarity, and quality before deployment
          </p>
        </div>
      </div>

      <section className="qa-select-section">
        <div className="qa-select-card">
          <label className="qa-label">Select a survey to analyze</label>
          <div className="qa-dropdown" ref={dropdownRef}>
            <button
              type="button"
              className={`qa-dropdown-trigger ${dropdownOpen ? 'qa-dropdown-trigger-open' : ''}`}
              onClick={() => { setDropdownOpen((o) => !o); setSearchQuery(''); }}
            >
              {selectedSurvey ? (
                <div className="qa-dropdown-selected">
                  <div className="qa-dropdown-selected-text">
                    <span className="qa-dropdown-selected-title">{selectedSurvey.title}</span>
                    <span className="qa-dropdown-selected-meta">
                      {selectedSurvey.questions?.length || 0} question{(selectedSurvey.questions?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="qa-dropdown-placeholder">Choose a survey...</span>
              )}
              <svg className={`qa-dropdown-chevron ${dropdownOpen ? 'qa-dropdown-chevron-open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {dropdownOpen && (
              <div className="qa-dropdown-menu">
                {surveys.length > 3 && (
                  <div className="qa-dropdown-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search surveys..."
                      className="qa-dropdown-search-input"
                      autoFocus
                    />
                  </div>
                )}
                <div className="qa-dropdown-list">
                  {filteredSurveys.length === 0 ? (
                    <div className="qa-dropdown-empty">
                      {surveys.length === 0 ? 'No surveys yet. Create one in the Execution tab.' : 'No matching surveys found.'}
                    </div>
                  ) : (
                    filteredSurveys.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`qa-dropdown-item ${qaSelectedSurveyId === s.id ? 'qa-dropdown-item-active' : ''}`}
                        onClick={() => {
                          setQaSelectedSurveyId(s.id);
                          setDropdownOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="qa-dropdown-item-text">
                          <span className="qa-dropdown-item-title">{s.title}</span>
                          <span className="qa-dropdown-item-meta">
                            {s.questions?.length || 0} question{(s.questions?.length || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {qaSelectedSurveyId === s.id && (
                          <svg className="qa-dropdown-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {qaSelectedSurveyId && (
            <div className="qa-select-action-row">
              <button
                type="button"
                onClick={handleRunQA}
                disabled={loading}
                className="qa-btn qa-btn-primary"
              >
                {loading && <span className="qa-spinner"></span>}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                {loading ? 'Analyzing...' : 'Run QA Analysis'}
              </button>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="qa-error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      {report && (
        <section className="qa-panel">
          <button
            type="button"
            onClick={() => setQaReportOpen((o) => !o)}
            className="qa-panel-toggle"
          >
            <div className="qa-panel-toggle-left">
              <svg className={`qa-chevron ${qaReportOpen ? 'qa-chevron-open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <div>
                <h2 className="qa-panel-title">QA Report</h2>
                <span className="qa-panel-meta">Analyzed {new Date(report.runAt).toLocaleString()}</span>
              </div>
            </div>
            <span className="qa-badge qa-badge-info">
              {QA_SECTION_KEYS.reduce((sum, key) => sum + (report.sections[key]?.length || 0), 0)} findings
            </span>
          </button>

          {qaReportOpen && (
            <div className="qa-panel-body">
              <div className="qa-report-grid">
                {QA_SECTION_KEYS.map((key) => {
                  const items = report.sections[key] ?? [];
                  return (
                    <div key={key} className="qa-report-section">
                      <div className="qa-report-section-header">
                        <span className="qa-report-section-icon">{QA_SECTION_ICONS[key]}</span>
                        <h3 className="qa-report-section-title">{QA_SECTION_LABELS[key]}</h3>
                        <span className="qa-badge qa-badge-count">{items.length}</span>
                      </div>
                      <ul className="qa-report-list">
                        {items.map((item, i) => (
                          <li key={i} className="qa-report-item">{item}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className="qa-panel-footer">
                <button
                  type="button"
                  onClick={handleGenerateSuggestions}
                  disabled={suggestionsLoading}
                  className="qa-btn qa-btn-ai"
                >
                  {suggestionsLoading && <span className="qa-spinner"></span>}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  {suggestionsLoading ? 'Generating...' : 'Generate Suggestions'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {suggestionsError && (
        <div className="qa-error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {suggestionsError}
        </div>
      )}

      {report && suggestions.length > 0 && (
        <section className="qa-panel">
          <button
            type="button"
            onClick={() => setSuggestedChangesOpen((o) => !o)}
            className="qa-panel-toggle"
          >
            <div className="qa-panel-toggle-left">
              <svg className={`qa-chevron ${suggestedChangesOpen ? 'qa-chevron-open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <div>
                <h2 className="qa-panel-title">Suggested Changes</h2>
                <span className="qa-panel-meta">{pendingSuggestions.length} pending of {suggestions.length} total</span>
              </div>
            </div>
            {pendingSuggestions.length > 0 && (
              <span className="qa-badge qa-badge-pending">{pendingSuggestions.length} pending</span>
            )}
          </button>
          {suggestedChangesOpen && (
            <div className="qa-panel-body">
              {pendingSuggestions.length === 0 ? (
                <div className="qa-suggestions-empty">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  All suggestions have been reviewed.
                </div>
              ) : (
                <div className="qa-suggestions-list">
                  {pendingSuggestions.map((s) => (
                    <div key={s.id} className="qa-suggestion-card">
                      <div className="qa-suggestion-header">
                        <span className="qa-suggestion-type-badge">{suggestionTypeLabel(s.type)}</span>
                        <span className="qa-suggestion-category">{QA_SECTION_LABELS[s.category] || s.category}</span>
                      </div>
                      <p className="qa-suggestion-reason">{s.reason}</p>

                      {s.type === 'edit_question' && (
                        <div className="qa-suggestion-body">
                          <QuestionDisplay
                            question={selectedSurvey?.questions?.[s.questionIndex]}
                            label="Current question"
                          />
                          <div className="qa-suggestion-edit-block">
                            <label className="qa-label-sm">Suggested (editable)</label>
                            <input
                              type="text"
                              value={s.suggestedText}
                              onChange={(e) => updateSuggestion(s.id, { suggestedText: e.target.value })}
                              placeholder="Question text"
                              className="qa-input"
                            />
                            <div className="qa-suggestion-type-select">
                              <label className="qa-label-sm">Type</label>
                              <select
                                value={s.suggestedType ?? 'open_ended'}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  let opts = {};
                                  if (v === 'scale') opts = { min: 1, max: 10 };
                                  if (v === 'multiple_choice' || v === 'checkbox') opts = { choices: ['', ''] };
                                  updateSuggestion(s.id, { suggestedType: v, suggestedOptions: opts });
                                }}
                                className="qa-select qa-select-sm"
                              >
                                {Object.entries(QUESTION_TYPE_LABELS).map(([val, lbl]) => (
                                  <option key={val} value={val}>{lbl}</option>
                                ))}
                              </select>
                            </div>
                            {s.suggestedType === 'scale' && (
                              <div className="qa-scale-row">
                                <label className="qa-label-sm">Range</label>
                                <div className="qa-scale-inputs">
                                  <input
                                    type="number"
                                    value={s.suggestedOptions?.min ?? 1}
                                    onChange={(e) => updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, min: Number(e.target.value) || 1 } })}
                                    className="qa-input qa-input-sm"
                                  />
                                  <span className="qa-scale-sep">to</span>
                                  <input
                                    type="number"
                                    value={s.suggestedOptions?.max ?? 10}
                                    onChange={(e) => updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, max: Number(e.target.value) || 10 } })}
                                    className="qa-input qa-input-sm"
                                  />
                                </div>
                              </div>
                            )}
                            {(s.suggestedType === 'multiple_choice' || s.suggestedType === 'checkbox') && (
                              <div className="qa-choices-section">
                                <label className="qa-label-sm">Choices</label>
                                {(s.suggestedOptions?.choices || ['', '']).map((choice, ci) => (
                                  <div key={ci} className="qa-choice-row">
                                    <input
                                      type="text"
                                      value={choice}
                                      onChange={(e) => {
                                        const choices = [...(s.suggestedOptions?.choices || ['', ''])];
                                        choices[ci] = e.target.value;
                                        updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, choices } });
                                      }}
                                      placeholder={`Option ${ci + 1}`}
                                      className="qa-input"
                                    />
                                    {(s.suggestedOptions?.choices?.length > 2) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const choices = (s.suggestedOptions?.choices || []).filter((_, i) => i !== ci);
                                          updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, choices } });
                                        }}
                                        className="qa-btn-icon-remove"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, choices: [...(s.suggestedOptions?.choices || []), ''] } })}
                                  className="qa-btn-add-option"
                                >
                                  + Add option
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {s.type === 'edit_title' && (
                        <div className="qa-suggestion-body">
                          <div className="qa-current-value">Current: {s.originalTitle}</div>
                          <label className="qa-label-sm">Suggested (editable)</label>
                          <input
                            type="text"
                            value={s.suggestedTitle}
                            onChange={(e) => updateSuggestion(s.id, { suggestedTitle: e.target.value })}
                            className="qa-input"
                          />
                        </div>
                      )}

                      {s.type === 'add_question' && (
                        <div className="qa-suggestion-body">
                          <div className="qa-suggestion-edit-block">
                            <label className="qa-label-sm">New question (editable)</label>
                            <input
                              type="text"
                              value={s.suggestedQuestion?.text ?? ''}
                              onChange={(e) =>
                                updateSuggestion(s.id, {
                                  suggestedQuestion: { ...s.suggestedQuestion, text: e.target.value },
                                })
                              }
                              placeholder="Question text"
                              className="qa-input"
                            />
                            <div className="qa-suggestion-type-select">
                              <label className="qa-label-sm">Type</label>
                              <select
                                value={s.suggestedQuestion?.type ?? 'open_ended'}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  let opts = {};
                                  if (v === 'scale') opts = { min: 1, max: 10 };
                                  if (v === 'multiple_choice' || v === 'checkbox') opts = { choices: ['', ''] };
                                  updateSuggestion(s.id, { suggestedQuestion: { ...s.suggestedQuestion, type: v, options: opts } });
                                }}
                                className="qa-select qa-select-sm"
                              >
                                {Object.entries(QUESTION_TYPE_LABELS).map(([val, lbl]) => (
                                  <option key={val} value={val}>{lbl}</option>
                                ))}
                              </select>
                            </div>
                            {s.suggestedQuestion?.type === 'scale' && (
                              <div className="qa-scale-row">
                                <label className="qa-label-sm">Range</label>
                                <div className="qa-scale-inputs">
                                  <input
                                    type="number"
                                    value={s.suggestedQuestion?.options?.min ?? 1}
                                    onChange={(e) => updateSuggestion(s.id, {
                                      suggestedQuestion: {
                                        ...s.suggestedQuestion,
                                        options: { ...s.suggestedQuestion?.options, min: Number(e.target.value) || 1 },
                                      },
                                    })}
                                    className="qa-input qa-input-sm"
                                  />
                                  <span className="qa-scale-sep">to</span>
                                  <input
                                    type="number"
                                    value={s.suggestedQuestion?.options?.max ?? 10}
                                    onChange={(e) => updateSuggestion(s.id, {
                                      suggestedQuestion: {
                                        ...s.suggestedQuestion,
                                        options: { ...s.suggestedQuestion?.options, max: Number(e.target.value) || 10 },
                                      },
                                    })}
                                    className="qa-input qa-input-sm"
                                  />
                                </div>
                              </div>
                            )}
                            {(s.suggestedQuestion?.type === 'multiple_choice' || s.suggestedQuestion?.type === 'checkbox') && (
                              <div className="qa-choices-section">
                                <label className="qa-label-sm">Choices</label>
                                {(s.suggestedQuestion?.options?.choices || ['', '']).map((choice, ci) => (
                                  <div key={ci} className="qa-choice-row">
                                    <input
                                      type="text"
                                      value={choice}
                                      onChange={(e) => {
                                        const choices = [...(s.suggestedQuestion?.options?.choices || ['', ''])];
                                        choices[ci] = e.target.value;
                                        updateSuggestion(s.id, {
                                          suggestedQuestion: {
                                            ...s.suggestedQuestion,
                                            options: { ...s.suggestedQuestion?.options, choices },
                                          },
                                        });
                                      }}
                                      placeholder={`Option ${ci + 1}`}
                                      className="qa-input"
                                    />
                                    {((s.suggestedQuestion?.options?.choices || []).length > 2) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const choices = (s.suggestedQuestion?.options?.choices || []).filter((_, i) => i !== ci);
                                          updateSuggestion(s.id, {
                                            suggestedQuestion: {
                                              ...s.suggestedQuestion,
                                              options: { ...s.suggestedQuestion?.options, choices },
                                            },
                                          });
                                        }}
                                        className="qa-btn-icon-remove"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => updateSuggestion(s.id, {
                                    suggestedQuestion: {
                                      ...s.suggestedQuestion,
                                      options: { ...s.suggestedQuestion?.options, choices: [...(s.suggestedQuestion?.options?.choices || []), ''] },
                                    },
                                  })}
                                  className="qa-btn-add-option"
                                >
                                  + Add option
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {s.type === 'remove_question' && (
                        <div className="qa-suggestion-body">
                          {selectedSurvey?.questions?.[s.questionIndex] ? (
                            <QuestionDisplay
                              question={selectedSurvey.questions[s.questionIndex]}
                              label="Question to remove"
                            />
                          ) : (
                            <div className="qa-current-value">
                              Remove: &quot;{s.questionText || 'this question'}&quot;
                            </div>
                          )}
                        </div>
                      )}

                      <div className="qa-suggestion-actions">
                        <button
                          type="button"
                          onClick={() => applySuggestion(s)}
                          disabled={s.type === 'add_question' && !(s.suggestedQuestion?.text ?? '').trim()}
                          className="qa-btn qa-btn-accept"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => denySuggestion(s.id)}
                          className="qa-btn qa-btn-deny"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default SurveyQA;
