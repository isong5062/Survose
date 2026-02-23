import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSurveys } from '../../context/SurveysContext';
import { generateSurveyWithAI } from '../../lib/aiSurveyGeneration';
import './SurveyExecution.css';

function SurveyExecution() {
  const { surveys, addSurvey, updateSurvey, deleteSurvey, addResponse } = useSurveys();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [runMessages, setRunMessages] = useState({});
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([
    { id: 'q0', text: '', type: 'open_ended', options: {} }
  ]);
  const [errors, setErrors] = useState({});
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const validateForm = () => {
    const newErrors = {};
    
    if (!title.trim()) {
      newErrors.title = 'Survey title is required';
    }
    
    const validQuestions = questions.filter((q) => q.text.trim());
    if (validQuestions.length === 0) {
      newErrors.questions = 'At least one question is required';
    }

    questions.forEach((q, i) => {
      if (q.text.trim()) {
        if (q.type === 'scale') {
          const min = parseInt(q.options.min);
          const max = parseInt(q.options.max);
          if (isNaN(min) || isNaN(max) || min >= max) {
            newErrors[`q${i}_options`] = 'Scale must have valid min < max';
          }
        }
        if (q.type === 'multiple_choice' || q.type === 'checkbox') {
          const choices = (q.options.choices || []).filter(c => c.trim());
          if (choices.length < 2) {
            newErrors[`q${i}_options`] = `${q.type === 'checkbox' ? 'Checkbox' : 'Multiple choice'} needs at least 2 options`;
          }
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setTitle('');
    setQuestions([{ id: 'q0', text: '', type: 'open_ended', options: {} }]);
    setErrors({});
    setShowCreate(false);
    setEditingId(null);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    const qs = questions.filter((q) => q.text.trim());
    await addSurvey({
      title: title.trim(),
      questions: qs,
    });
    resetForm();
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    const qs = questions.filter((q) => q.text.trim());
    const success = await updateSurvey(editingId, {
      title: title.trim(),
      questions: qs,
    });
    
    if (success) {
      resetForm();
    } else {
      setErrors({ submit: 'Failed to update survey. Please try again.' });
    }
  };

  const startEdit = (survey) => {
    setEditingId(survey.id);
    setTitle(survey.title);
    setQuestions(
      survey.questions?.length > 0 
        ? survey.questions 
        : [{ id: 'q0', text: '', type: 'open_ended', options: {} }]
    );
    setErrors({});
    setShowCreate(false);
  };

  const handleDelete = async (id) => {
    const success = await deleteSurvey(id);
    if (success) {
      setDeleteConfirmId(null);
    }
  };

  const addQuestion = () => {
    const newId = `q${Date.now()}`;
    setQuestions((q) => [...q, { id: newId, text: '', type: 'open_ended', options: {} }]);
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions((q) => q.filter((_, i) => i !== index));
      const newErrors = { ...errors };
      delete newErrors[`q${index}_options`];
      setErrors(newErrors);
    }
  };

  const updateQuestion = (index, field, value) => {
    const next = [...questions];
    if (field === 'text') {
      next[index].text = value;
    } else if (field === 'type') {
      next[index].type = value;
      if (value === 'scale') {
        next[index].options = { min: 1, max: 10 };
      } else if (value === 'multiple_choice' || value === 'checkbox') {
        next[index].options = { choices: ['', ''] };
      } else if (value === 'yes_no') {
        next[index].options = { choices: ['Yes', 'No'] };
      } else {
        next[index].options = {};
      }
      const newErrors = { ...errors };
      delete newErrors[`q${index}_options`];
      setErrors(newErrors);
    }
    setQuestions(next);
    if (errors.questions) setErrors({ ...errors, questions: null });
  };

  const updateQuestionOption = (index, optionField, value) => {
    const next = [...questions];
    next[index].options = { ...next[index].options, [optionField]: value };
    setQuestions(next);
    const newErrors = { ...errors };
    delete newErrors[`q${index}_options`];
    setErrors(newErrors);
  };

  const updateMCChoice = (qIndex, choiceIndex, value) => {
    const next = [...questions];
    const choices = [...(next[qIndex].options.choices || [])];
    choices[choiceIndex] = value;
    next[qIndex].options.choices = choices;
    setQuestions(next);
  };

  const addMCChoice = (qIndex) => {
    const next = [...questions];
    const choices = [...(next[qIndex].options.choices || []), ''];
    next[qIndex].options.choices = choices;
    setQuestions(next);
  };

  const removeMCChoice = (qIndex, choiceIndex) => {
    const next = [...questions];
    const choices = (next[qIndex].options.choices || []).filter((_, i) => i !== choiceIndex);
    if (choices.length >= 2) {
      next[qIndex].options.choices = choices;
      setQuestions(next);
    }
  };

  const handleRun = async (survey) => {
    setRunningId(survey.id);
    setRunMessages((prev) => {
      const next = { ...prev };
      delete next[survey.id];
      return next;
    });

    try {
      const response = await fetch('/api/surveys/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surveyId: survey.id,
          title: survey.title,
          questions: survey.questions || [],
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.detail || 'Failed to run survey.');
      }

      const transcription = body?.transcription;
      const question = body?.question;

      if (transcription) {
        await addResponse(survey.id, {
          question,
          transcription,
          callSid: body?.callSid,
        });
      }

      setRunMessages((prev) => ({
        ...prev,
        [survey.id]: {
          type: 'success',
          text: body?.message || 'Survey call completed.',
          transcription: transcription || null,
          question: question || null,
        },
      }));
    } catch (error) {
      setRunMessages((prev) => ({
        ...prev,
        [survey.id]: {
          type: 'error',
          text: error?.message || 'Failed to run survey.',
        },
      }));
    } finally {
      setRunningId(null);
    }
  };

  const handleAIGenerateSubmit = async (e) => {
    e.preventDefault();
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    setAiError(null);
    setAiLoading(true);
    try {
      const { title: aiTitle, questions: aiQuestions } = await generateSurveyWithAI(prompt);
      setTitle(aiTitle);
      setQuestions(aiQuestions.length > 0 ? aiQuestions : [{ id: 'q0', text: '', type: 'open_ended', options: {} }]);
      setErrors({});
      setShowCreate(true);
      setEditingId(null);
      setShowAIGenerateModal(false);
      setAiPrompt('');
    } catch (err) {
      setAiError(err?.message || 'AI survey generation failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const isEditing = editingId !== null;
  const formTitle = isEditing ? 'Edit Survey' : 'Create New Survey';
  const submitHandler = isEditing ? handleEditSubmit : handleCreateSubmit;

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp.toMillis ? timestamp.toMillis() : timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const questionTypeLabels = {
    open_ended: 'Open-ended',
    scale: 'Scale',
    multiple_choice: 'Multiple Choice',
    checkbox: 'Checkbox',
    yes_no: 'Yes / No',
  };

  return (
    <div className="se-page">
      <div className="se-header">
        <div>
          <h1 className="se-title">Survey Execution</h1>
          <p className="se-subtitle">
            Create, manage, and deploy voice AI surveys at scale
          </p>
        </div>
        <div className="se-header-actions">
          <button
            type="button"
            className="se-btn se-btn-primary"
            onClick={() => { setShowCreate(true); setEditingId(null); resetForm(); setShowCreate(true); }}
            disabled={isEditing}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Survey
          </button>
          <button
            type="button"
            className="se-btn se-btn-ai"
            onClick={() => { setShowAIGenerateModal(true); setAiError(null); setAiPrompt(''); }}
            disabled={isEditing}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Generate with AI
          </button>
        </div>
      </div>

      {(showCreate || isEditing) && (
        <form onSubmit={submitHandler} className="se-form">
          <div className="se-form-header">
            <h3 className="se-form-title">{formTitle}</h3>
            <button type="button" className="se-form-close" onClick={resetForm}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          
          <div className="se-field">
            <label className="se-label">
              Survey Title <span className="se-required">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: null });
              }}
              placeholder="e.g. Customer Satisfaction Q1 2026"
              className={`se-input ${errors.title ? 'se-input-error' : ''}`}
            />
            {errors.title && <p className="se-error">{errors.title}</p>}
          </div>
          
          <div className="se-field">
            <label className="se-label">
              Questions <span className="se-required">*</span>
            </label>
            <div className="se-questions-list">
              {questions.map((q, i) => (
                <div 
                  key={q.id} 
                  className={`se-question-card ${errors[`q${i}_options`] || errors.questions ? 'se-question-card-error' : ''}`}
                >
                  <div className="se-question-header">
                    <span className="se-question-number">{i + 1}</span>
                    <input
                      type="text"
                      value={q.text}
                      onChange={(e) => updateQuestion(i, 'text', e.target.value)}
                      placeholder={`Enter question ${i + 1}...`}
                      className="se-input se-question-input"
                    />
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(i)}
                        aria-label={`Remove question ${i + 1}`}
                        className="se-btn-icon se-btn-icon-danger"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="se-question-type-row">
                    <label className="se-label-sm">Type</label>
                    <div className="se-type-pills">
                      {Object.entries(questionTypeLabels).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`se-type-pill ${q.type === value ? 'se-type-pill-active' : ''}`}
                          onClick={() => updateQuestion(i, 'type', value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {q.type === 'scale' && (
                    <div className="se-scale-row">
                      <label className="se-label-sm">Range</label>
                      <div className="se-scale-inputs">
                        <input
                          type="number"
                          value={q.options.min || 1}
                          onChange={(e) => updateQuestionOption(i, 'min', e.target.value)}
                          placeholder="Min"
                          className="se-input se-input-sm"
                        />
                        <span className="se-scale-sep">to</span>
                        <input
                          type="number"
                          value={q.options.max || 10}
                          onChange={(e) => updateQuestionOption(i, 'max', e.target.value)}
                          placeholder="Max"
                          className="se-input se-input-sm"
                        />
                      </div>
                    </div>
                  )}

                  {(q.type === 'multiple_choice' || q.type === 'checkbox') && (
                    <div className="se-choices-section">
                      <label className="se-label-sm">
                        Options{q.type === 'checkbox' ? ' (select multiple)' : ''}
                      </label>
                      <div className="se-choices-list">
                        {(q.options.choices || []).map((choice, ci) => (
                          <div key={ci} className="se-choice-row">
                            <span className="se-choice-indicator">
                              {q.type === 'multiple_choice' ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                              )}
                            </span>
                            <input
                              type="text"
                              value={choice}
                              onChange={(e) => updateMCChoice(i, ci, e.target.value)}
                              placeholder={`Option ${ci + 1}`}
                              className="se-input se-choice-input"
                            />
                            {(q.options.choices || []).length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeMCChoice(i, ci)}
                                className="se-btn-icon se-btn-icon-muted"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => addMCChoice(i)}
                        className="se-btn-add-choice"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Add option
                      </button>
                    </div>
                  )}

                  {errors[`q${i}_options`] && (
                    <p className="se-error">{errors[`q${i}_options`]}</p>
                  )}
                </div>
              ))}
            </div>
            {errors.questions && <p className="se-error">{errors.questions}</p>}
          </div>
          
          <button type="button" onClick={addQuestion} aria-label="Add question" className="se-btn-add-question">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Question
          </button>
          
          {errors.submit && (
            <div className="se-error-banner">{errors.submit}</div>
          )}
          
          <div className="se-form-actions">
            <button type="submit" className="se-btn se-btn-primary">
              {isEditing ? 'Update Survey' : 'Save Survey'}
            </button>
            <button type="button" onClick={resetForm} className="se-btn se-btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="se-surveys-section">
        <div className="se-surveys-header">
          <h2 className="se-surveys-title">Your Surveys</h2>
          <span className="se-surveys-count">{surveys.length}</span>
        </div>
        {surveys.length === 0 ? (
          <div className="se-empty-state">
            <div className="se-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <p className="se-empty-title">No surveys yet</p>
            <p className="se-empty-desc">
              Create your first survey manually or generate one with AI to get started
            </p>
          </div>
        ) : (
          <div className="se-survey-list">
            {surveys.map((s) => (
              <div
                key={s.id}
                className={`se-survey-card ${editingId === s.id ? 'se-survey-card-editing' : ''}`}
              >
                <div className="se-survey-card-top">
                  <div className="se-survey-card-info">
                    <div className="se-survey-card-title-row">
                      <h3 className="se-survey-card-title">{s.title}</h3>
                      <span className={`se-status-badge ${runningId === s.id ? 'se-status-running' : 'se-status-draft'}`}>
                        {runningId === s.id ? 'Running' : 'Draft'}
                      </span>
                    </div>
                    <div className="se-survey-card-meta">
                      <span>{s.questions?.length || 0} question{(s.questions?.length || 0) !== 1 ? 's' : ''}</span>
                      <span className="se-meta-dot"></span>
                      <span>Created {formatDate(s.createdAt)}</span>
                      {s.updatedAt && (
                        <>
                          <span className="se-meta-dot"></span>
                          <span>Edited {formatDate(s.updatedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
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
                    Survey call is being started through the backend.
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleRun(s)}
                        disabled={runningId !== null}
                        style={{
                          padding: '0.5rem 1rem',
                          background: runningId !== null ? '#9ca3af' : '#4f46e5',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: runningId !== null ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                        }}
                      >
                        Run
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        disabled={isEditing && editingId !== s.id}
                        style={{
                          padding: '0.5rem 1rem',
                          background: isEditing && editingId !== s.id ? '#f3f4f6' : '#fff',
                          color: isEditing && editingId !== s.id ? '#9ca3af' : '#4f46e5',
                          border: `1px solid ${isEditing && editingId !== s.id ? '#e5e7eb' : '#4f46e5'}`,
                          borderRadius: '0.5rem',
                          cursor: isEditing && editingId !== s.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                        }}
                      >
                        Edit
                      </button>
                      <Link
                        to="/dashboard/analysis"
                        state={{ surveyId: s.id }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          textDecoration: 'none',
                          display: 'inline-block',
                          fontWeight: 500,
                        }}
                      >
                        View responses
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(s.id)}
                        disabled={isEditing}
                        style={{
                          padding: '0.5rem 1rem',
                          background: isEditing ? '#fef2f2' : '#fee2e2',
                          color: isEditing ? '#fca5a5' : '#dc2626',
                          border: `1px solid ${isEditing ? '#fecaca' : '#fca5a5'}`,
                          borderRadius: '0.5rem',
                          cursor: isEditing ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    {runMessages[s.id] && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          background: runMessages[s.id].type === 'error' ? '#fee2e2' : '#ecfdf5',
                          color: runMessages[s.id].type === 'error' ? '#b91c1c' : '#065f46',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                        }}
                      >
                        <div>{runMessages[s.id].text}</div>
                        {runMessages[s.id].transcription && (
                          <div
                            style={{
                              marginTop: '0.75rem',
                              padding: '0.75rem',
                              background: '#fff',
                              border: '1px solid #d1fae5',
                              borderRadius: '0.375rem',
                              color: '#1f2937',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                            }}
                          >
                            {(Array.isArray(runMessages[s.id].transcription)
                              ? runMessages[s.id].transcription
                              : [runMessages[s.id].transcription]
                            ).map((t, i) => (
                              <div key={i}>
                                {runMessages[s.id].question && (
                                  <div style={{ marginBottom: '0.25rem' }}>
                                    <span style={{ fontWeight: 600, color: '#374151' }}>Q{i + 1}: </span>
                                    {Array.isArray(runMessages[s.id].question)
                                      ? runMessages[s.id].question[i]
                                      : runMessages[s.id].question}
                                  </div>
                                )}
                                <div>
                                  <span style={{ fontWeight: 600, color: '#374151' }}>A{i + 1}: </span>
                                  {t}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {showAIGenerateModal && (
        <div className="se-modal-overlay" onClick={() => !aiLoading && setShowAIGenerateModal(false)}>
          <div className="se-modal" onClick={(e) => e.stopPropagation()}>
            <div className="se-modal-header">
              <div className="se-modal-icon-ai">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <div>
                <h3 className="se-modal-title">Generate with AI</h3>
                <p className="se-modal-desc">
                  Describe your survey topic or goals. AI will create a draft, run QA, refine it, and pre-fill the form for you.
                </p>
              </div>
            </div>
            <form onSubmit={handleAIGenerateSubmit}>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Customer satisfaction for a coffee shop: satisfaction with taste, wait time, and cleanliness; demographics; NPS."
                disabled={aiLoading}
                rows={5}
                className={`se-textarea ${aiError ? 'se-input-error' : ''}`}
              />
              {aiError && <p className="se-error">{aiError}</p>}
              <div className="se-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowAIGenerateModal(false)}
                  disabled={aiLoading}
                  className="se-btn se-btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="se-btn se-btn-ai"
                >
                  {aiLoading && <span className="se-spinner"></span>}
                  {aiLoading ? 'Generating...' : 'Generate Survey'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="se-modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="se-modal se-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="se-modal-header">
              <div className="se-modal-icon-danger">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </div>
              <div>
                <h3 className="se-modal-title">Delete Survey</h3>
                <p className="se-modal-desc">
                  This action cannot be undone. The survey and all associated data will be permanently removed.
                </p>
              </div>
            </div>
            <div className="se-modal-actions">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="se-btn se-btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="se-btn se-btn-danger"
              >
                Delete Survey
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SurveyExecution;
