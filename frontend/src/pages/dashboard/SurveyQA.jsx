import { useState } from 'react';
import { useSurveys } from '../../context/SurveysContext';
import { surveyQAModel } from '../../firebase';

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

function SurveyQA() {
  const { surveys, getSurveyById } = useSurveys();
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectedSurvey = selectedId ? getSurveyById(selectedId) : null;

  const handleRunQA = async () => {
    if (!selectedSurvey) return;
    setError(null);
    setLoading(true);
    try {
      const result = await runSurveyQAWithAI(selectedSurvey);
      setReport(result);
    } catch (e) {
      setError(e?.message || 'QA analysis failed.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

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
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setReport(null);
          }}
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
        {selectedId && (
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
        </section>
      )}
    </div>
  );
}

export default SurveyQA;
