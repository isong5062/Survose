import { useState } from 'react';
import { useSurveys } from '../../context/SurveysContext';

function runMockQA(survey) {
  const bias = [];
  const demographics = [];
  const leadingQuestions = [];

  if (survey.questions?.length) {
    survey.questions.forEach((q, i) => {
      const questionText = q.text || q;
      
      if (questionText.toLowerCase().includes('agree') || questionText.toLowerCase().includes('support')) {
        leadingQuestions.push(`Q${i + 1}: "${questionText}" — may suggest a preferred answer.`);
      }
      if (questionText.toLowerCase().includes('gender') || questionText.toLowerCase().includes('age')) {
        demographics.push(`Q${i + 1} covers demographics.`);
      }
    });
  }
  if (leadingQuestions.length === 0 && survey.questions?.length) {
    leadingQuestions.push('No obviously leading questions detected in this sample. Add more questions to improve QA.');
  }
  if (demographics.length === 0) {
    demographics.push('Consider adding demographic questions (e.g. age, region) for representativeness.');
  }
  bias.push('Sample bias check: ensure recruitment strategy matches target population.');
  bias.push('Order bias: earlier questions may influence later answers; consider randomizing non-critical blocks.');

  return {
    surveyId: survey.id,
    runAt: new Date().toISOString(),
    sections: {
      bias,
      demographics,
      leadingQuestions,
    },
  };
}

function SurveyQA() {
  const { surveys, getSurveyById } = useSurveys();
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState(null);

  const selectedSurvey = selectedId ? getSurveyById(selectedId) : null;

  const handleRunQA = () => {
    if (!selectedSurvey) return;
    setReport(runMockQA(selectedSurvey));
  };

  return (
    <div>
      <h1>Survey QA Testing</h1>
      <p>
        Automatically identify potential bias, missing demographics, and leading questions
        before surveys are deployed.
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
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 1rem',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Run QA
          </button>
        )}
      </section>

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

          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#374151' }}>Potential bias</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#4b5563' }}>
              {report.sections.bias.map((item, i) => (
                <li key={i} style={{ marginBottom: '0.25rem' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#374151' }}>Missing demographics</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#4b5563' }}>
              {report.sections.demographics.map((item, i) => (
                <li key={i} style={{ marginBottom: '0.25rem' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#374151' }}>Leading questions</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#4b5563' }}>
              {report.sections.leadingQuestions.map((item, i) => (
                <li key={i} style={{ marginBottom: '0.25rem' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

export default SurveyQA;
