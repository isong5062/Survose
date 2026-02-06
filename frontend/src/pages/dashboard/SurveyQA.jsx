import { useState } from 'react';
import { useSurveys } from '../../context/SurveysContext';
import { surveyQAModel, surveySuggestionsModel } from '../../firebase';

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
  bias: 'Potential bias',
  demographics: 'Demographics',
  leadingQuestions: 'Leading questions',
  clarity: 'Clarity & wording',
  lengthAndFatigue: 'Length & fatigue',
  sensitivityAndEthics: 'Sensitivity & ethics',
};

const QUESTION_TYPE_LABELS = {
  open_ended: 'Open-ended',
  scale: 'Scale (1-10)',
  multiple_choice: 'Multiple choice',
  checkbox: 'Checkbox (multi-select)',
  yes_no: 'Yes/No',
};

function QuestionDisplay({ question, label = null }) {
  if (!question) return null;
  const q = typeof question === 'string' ? { text: question, type: 'open_ended', options: {} } : question;
  const typeLabel = QUESTION_TYPE_LABELS[q.type] || q.type;
  return (
    <div style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb', marginBottom: '0.5rem' }}>
      {label && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</div>}
      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827', marginBottom: '0.25rem' }}>{q.text || '(No text)'}</div>
      <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
        Type: {typeLabel}
        {q.type === 'scale' && (q.options?.min != null || q.options?.max != null) && (
          <span style={{ marginLeft: '0.5rem' }}>Range: {q.options.min ?? 1} to {q.options.max ?? 10}</span>
        )}
        {(q.type === 'multiple_choice' || q.type === 'checkbox') && (q.options?.choices?.length > 0) && (
          <div style={{ marginTop: '0.25rem' }}>
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

  return (
    <div>
      <h1>Survey QA Testing</h1>
      <p>
        Automatically check bias, demographics, leading questions, clarity, length and fatigue,
        and sensitivity/ethics before surveys are deployed.
      </p>

      <section style={{ marginTop: '1.5rem' }}>
        <label htmlFor="qa-survey-select" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          Select a survey to analyze
        </label>
        <select
          id="qa-survey-select"
          value={qaSelectedSurveyId}
          onChange={(e) => setQaSelectedSurveyId(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            minWidth: '280px',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            marginRight: '0.5rem',
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
        {qaSelectedSurveyId && (
          <button
            type="button"
            onClick={handleRunQA}
            disabled={loading}
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 1rem',
              background: loading ? '#9ca3af' : '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'Analyzing…' : 'Run QA'}
          </button>
        )}
      </section>

      {error && (
        <section
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#fef2f2',
            borderRadius: '0.5rem',
            border: '1px solid #fecaca',
            color: '#991b1b',
          }}
        >
          {error}
        </section>
      )}

      {report && (
        <section
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            maxWidth: '640px',
          }}
        >
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>QA Report</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
            Run at {new Date(report.runAt).toLocaleString()}
          </p>

          {QA_SECTION_KEYS.map((key) => {
            const items = report.sections[key] ?? [];
            return (
              <div key={key} style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#374151' }}>
                  {QA_SECTION_LABELS[key]}
                </h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#4b5563' }}>
                  {items.map((item, i) => (
                    <li key={i} style={{ marginBottom: '0.25rem' }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <button
              type="button"
              onClick={handleGenerateSuggestions}
              disabled={suggestionsLoading}
              style={{
                padding: '0.5rem 1rem',
                background: suggestionsLoading ? '#9ca3af' : '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: suggestionsLoading ? 'wait' : 'pointer',
                fontWeight: 600,
              }}
            >
              {suggestionsLoading ? 'Generating…' : 'Generate suggestions'}
            </button>
          </div>
        </section>
      )}

      {suggestionsError && (
        <section
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#fef2f2',
            borderRadius: '0.5rem',
            border: '1px solid #fecaca',
            color: '#991b1b',
            maxWidth: '640px',
          }}
        >
          {suggestionsError}
        </section>
      )}

      {report && suggestions.length > 0 && (
        <section
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            maxWidth: '640px',
          }}
        >
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Suggested changes</h2>
          {pendingSuggestions.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              No pending suggestions. Accept or deny the ones above, or generate again.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pendingSuggestions.map((s) => (
                <li
                  key={s.id}
                  style={{
                    padding: '1rem',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                    {QA_SECTION_LABELS[s.category] || s.category}
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>
                    {s.reason}
                  </p>
                  {s.type === 'edit_question' && (
                    <>
                      <QuestionDisplay
                        question={selectedSurvey?.questions?.[s.questionIndex]}
                        label="Current question"
                      />
                      <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                        Suggested (editable):
                      </label>
                      <div style={{ padding: '0.75rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          value={s.suggestedText}
                          onChange={(e) => updateSuggestion(s.id, { suggestedText: e.target.value })}
                          placeholder="Question text"
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            marginBottom: '0.5rem',
                          }}
                        />
                        <div style={{ marginBottom: '0.5rem' }}>
                          <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem' }}>Type</label>
                          <select
                            value={s.suggestedType ?? 'open_ended'}
                            onChange={(e) => {
                              const v = e.target.value;
                              let opts = {};
                              if (v === 'scale') opts = { min: 1, max: 10 };
                              if (v === 'multiple_choice' || v === 'checkbox') opts = { choices: ['', ''] };
                              updateSuggestion(s.id, { suggestedType: v, suggestedOptions: opts });
                            }}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.5rem',
                              fontSize: '0.875rem',
                              minWidth: '180px',
                            }}
                          >
                            {Object.entries(QUESTION_TYPE_LABELS).map(([val, lbl]) => (
                              <option key={val} value={val}>{lbl}</option>
                            ))}
                          </select>
                        </div>
                        {(s.suggestedType === 'scale') && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Range:</label>
                            <input
                              type="number"
                              value={s.suggestedOptions?.min ?? 1}
                              onChange={(e) => updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, min: Number(e.target.value) || 1 } })}
                              style={{ width: '70px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                            />
                            <span style={{ color: '#6b7280' }}>to</span>
                            <input
                              type="number"
                              value={s.suggestedOptions?.max ?? 10}
                              onChange={(e) => updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, max: Number(e.target.value) || 10 } })}
                              style={{ width: '70px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                            />
                          </div>
                        )}
                        {(s.suggestedType === 'multiple_choice' || s.suggestedType === 'checkbox') && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <label style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem', display: 'block' }}>Choices</label>
                            {(s.suggestedOptions?.choices || ['', '']).map((choice, ci) => (
                              <div key={ci} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <input
                                  type="text"
                                  value={choice}
                                  onChange={(e) => {
                                    const choices = [...(s.suggestedOptions?.choices || ['', ''])];
                                    choices[ci] = e.target.value;
                                    updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, choices } });
                                  }}
                                  placeholder={`Option ${ci + 1}`}
                                  style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                                />
                                {(s.suggestedOptions?.choices?.length > 2) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const choices = (s.suggestedOptions?.choices || []).filter((_, i) => i !== ci);
                                      updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, choices } });
                                    }}
                                    style={{ padding: '0.5rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateSuggestion(s.id, { suggestedOptions: { ...s.suggestedOptions, choices: [...(s.suggestedOptions?.choices || []), ''] } })}
                              style={{ padding: '0.375rem 0.5rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.25rem' }}
                            >
                              + Add option
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {s.type === 'edit_title' && (
                    <>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Current: {s.originalTitle}
                      </div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                        Suggested (editable):
                      </label>
                      <input
                        type="text"
                        value={s.suggestedTitle}
                        onChange={(e) => updateSuggestion(s.id, { suggestedTitle: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          marginBottom: '0.75rem',
                        }}
                      />
                    </>
                  )}
                  {s.type === 'add_question' && (
                    <div style={{ padding: '0.75rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: 500 }}>New question (editable)</label>
                      <input
                        type="text"
                        value={s.suggestedQuestion?.text ?? ''}
                        onChange={(e) =>
                          updateSuggestion(s.id, {
                            suggestedQuestion: { ...s.suggestedQuestion, text: e.target.value },
                          })
                        }
                        placeholder="Question text"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          marginBottom: '0.5rem',
                        }}
                      />
                      <div style={{ marginBottom: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem' }}>Type</label>
                        <select
                          value={s.suggestedQuestion?.type ?? 'open_ended'}
                          onChange={(e) => {
                            const v = e.target.value;
                            let opts = {};
                            if (v === 'scale') opts = { min: 1, max: 10 };
                            if (v === 'multiple_choice' || v === 'checkbox') opts = { choices: ['', ''] };
                            updateSuggestion(s.id, { suggestedQuestion: { ...s.suggestedQuestion, type: v, options: opts } });
                          }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            minWidth: '180px',
                          }}
                        >
                          {Object.entries(QUESTION_TYPE_LABELS).map(([val, lbl]) => (
                            <option key={val} value={val}>{lbl}</option>
                          ))}
                        </select>
                      </div>
                      {(s.suggestedQuestion?.type === 'scale') && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Range:</label>
                          <input
                            type="number"
                            value={s.suggestedQuestion?.options?.min ?? 1}
                            onChange={(e) => updateSuggestion(s.id, {
                              suggestedQuestion: {
                                ...s.suggestedQuestion,
                                options: { ...s.suggestedQuestion?.options, min: Number(e.target.value) || 1 },
                              },
                            })}
                            style={{ width: '70px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                          />
                          <span style={{ color: '#6b7280' }}>to</span>
                          <input
                            type="number"
                            value={s.suggestedQuestion?.options?.max ?? 10}
                            onChange={(e) => updateSuggestion(s.id, {
                              suggestedQuestion: {
                                ...s.suggestedQuestion,
                                options: { ...s.suggestedQuestion?.options, max: Number(e.target.value) || 10 },
                              },
                            })}
                            style={{ width: '70px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                          />
                        </div>
                      )}
                      {(s.suggestedQuestion?.type === 'multiple_choice' || s.suggestedQuestion?.type === 'checkbox') && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <label style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem', display: 'block' }}>Choices</label>
                          {(s.suggestedQuestion?.options?.choices || ['', '']).map((choice, ci) => (
                            <div key={ci} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
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
                                style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }}
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
                                  style={{ padding: '0.5rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}
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
                            style={{ padding: '0.375rem 0.5rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.25rem' }}
                          >
                            + Add option
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {s.type === 'remove_question' && (
                    <>
                      {selectedSurvey?.questions?.[s.questionIndex] ? (
                        <QuestionDisplay
                          question={selectedSurvey.questions[s.questionIndex]}
                          label="Question to remove"
                        />
                      ) : (
                        <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.75rem' }}>
                          Remove: &quot;{s.questionText || 'this question'}&quot;
                        </div>
                      )}
                    </>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => applySuggestion(s)}
                      disabled={s.type === 'add_question' && !(s.suggestedQuestion?.text ?? '').trim()}
                      style={{
                        padding: '0.375rem 0.75rem',
                        background: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => denySuggestion(s.id)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        background: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Deny
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default SurveyQA;
