import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSurveys } from '../../context/SurveysContext';
import { generateSurveyWithAI } from '../../lib/aiSurveyGeneration';

function SurveyExecution() {
  const { surveys, addSurvey, updateSurvey, deleteSurvey } = useSurveys();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [runningId, setRunningId] = useState(null);
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

  const handleRun = (id) => {
    setRunningId(id);
    setTimeout(() => setRunningId(null), 3000);
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
  const formTitle = isEditing ? 'Edit survey' : 'New survey';
  const submitHandler = isEditing ? handleEditSubmit : handleCreateSubmit;

  return (
    <div>
      <h1>Autonomous Survey Execution</h1>
      <p>
        Voice AI autonomously conducts surveys, screens participants in real-time,
        and collects structured responses at scale.
      </p>

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={isEditing}
          style={{
            padding: '0.5rem 1rem',
            background: isEditing ? '#9ca3af' : '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isEditing ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          Create survey
        </button>
        <button
          type="button"
          onClick={() => {
            setShowAIGenerateModal(true);
            setAiError(null);
            setAiPrompt('');
          }}
          disabled={isEditing}
          style={{
            padding: '0.5rem 1rem',
            background: isEditing ? '#9ca3af' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isEditing ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          Generate with AI
        </button>
      </div>

      {(showCreate || isEditing) && (
        <form
          onSubmit={submitHandler}
          style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            background: '#f9fafb',
            borderRadius: '0.75rem',
            maxWidth: '560px',
            border: '2px solid #e5e7eb',
          }}
        >
          <h3 style={{ marginBottom: '1rem' }}>{formTitle}</h3>
          
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Title <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors({ ...errors, title: null });
            }}
            placeholder="Survey title"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.25rem',
              border: `1px solid ${errors.title ? '#ef4444' : '#d1d5db'}`,
              borderRadius: '0.5rem',
              outline: 'none',
            }}
          />
          {errors.title && (
            <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem', marginTop: '0.25rem' }}>
              {errors.title}
            </p>
          )}
          
          <label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: 500 }}>
            Questions <span style={{ color: '#ef4444' }}>*</span>
          </label>
          {questions.map((q, i) => (
            <div 
              key={q.id} 
              style={{ 
                padding: '1rem',
                background: '#fff',
                border: `1px solid ${errors[`q${i}_options`] || errors.questions ? '#ef4444' : '#e5e7eb'}`,
                borderRadius: '0.5rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => updateQuestion(i, 'text', e.target.value)}
                  placeholder={`Question ${i + 1}`}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    outline: 'none',
                  }}
                />
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    aria-label={`Remove question ${i + 1}`}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: '#6b7280' }}>
                  Question type
                </label>
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(i, 'type', e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    fontSize: '0.875rem',
                    minWidth: '180px',
                  }}
                >
                  <option value="open_ended">Open-ended</option>
                  <option value="scale">Scale</option>
                  <option value="multiple_choice">Multiple choice</option>
                  <option value="checkbox">Checkbox (multi-select)</option>
                  <option value="yes_no">Yes/No</option>
                </select>
              </div>

              {q.type === 'scale' && (
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.875rem', color: '#6b7280' }}>Range:</label>
                  <input
                    type="number"
                    value={q.options.min || 1}
                    onChange={(e) => updateQuestionOption(i, 'min', e.target.value)}
                    placeholder="Min"
                    style={{
                      width: '70px',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      outline: 'none',
                      fontSize: '0.875rem',
                    }}
                  />
                  <span style={{ color: '#6b7280' }}>to</span>
                  <input
                    type="number"
                    value={q.options.max || 10}
                    onChange={(e) => updateQuestionOption(i, 'max', e.target.value)}
                    placeholder="Max"
                    style={{
                      width: '70px',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      outline: 'none',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              )}

              {(q.type === 'multiple_choice' || q.type === 'checkbox') && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem', display: 'block' }}>
                    Options{q.type === 'checkbox' ? ' (select multiple)' : ''}:
                  </label>
                  {(q.options.choices || []).map((choice, ci) => (
                    <div key={ci} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <input
                        type="text"
                        value={choice}
                        onChange={(e) => updateMCChoice(i, ci, e.target.value)}
                        placeholder={`Option ${ci + 1}`}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          outline: 'none',
                          fontSize: '0.875rem',
                        }}
                      />
                      {(q.options.choices || []).length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeMCChoice(i, ci)}
                          style={{
                            padding: '0.5rem',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addMCChoice(i)}
                    style={{
                      padding: '0.375rem 0.5rem',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    + Add option
                  </button>
                </div>
              )}

              {errors[`q${i}_options`] && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {errors[`q${i}_options`]}
                </p>
              )}
            </div>
          ))}
          {errors.questions && (
            <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {errors.questions}
            </p>
          )}
          
          <button
            type="button"
            onClick={addQuestion}
            aria-label="Add question"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              marginTop: '0.5rem',
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
          
          {errors.submit && (
            <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '1rem', padding: '0.75rem', background: '#fee2e2', borderRadius: '0.5rem' }}>
              {errors.submit}
            </p>
          )}
          
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
                fontWeight: 600,
              }}
            >
              {isEditing ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={resetForm}
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
        {surveys.length === 0 ? (
          <div
            style={{
              padding: '3rem 2rem',
              background: '#fff',
              border: '2px dashed #d1d5db',
              borderRadius: '0.75rem',
              textAlign: 'center',
              maxWidth: '560px',
            }}
          >
            <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '0.5rem' }}>
              No surveys yet
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Create your first survey to get started with voice AI data collection
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {surveys.map((s) => (
              <li
                key={s.id}
                style={{
                  padding: '1.25rem',
                  background: '#fff',
                  border: editingId === s.id ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  marginBottom: '0.75rem',
                  maxWidth: '640px',
                  boxShadow: editingId === s.id ? '0 4px 6px -1px rgba(79, 70, 229, 0.1)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.125rem', color: '#1f2937' }}>
                    {s.title}
                  </div>
                  <span
                    style={{
                      padding: '0.25rem 0.625rem',
                      background: runningId === s.id ? '#dbeafe' : '#f3f4f6',
                      color: runningId === s.id ? '#1e40af' : '#6b7280',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.025em',
                    }}
                  >
                    {runningId === s.id ? 'Running' : 'Draft'}
                  </span>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.25rem', fontWeight: 500 }}>
                    {s.questions?.length || 0} Question{(s.questions?.length || 0) !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                    Created on: {s.createdAt ? new Date(s.createdAt.toMillis ? s.createdAt.toMillis() : s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                  </div>
                  {s.updatedAt && (
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                      Last edited on: {new Date(s.updatedAt.toMillis ? s.updatedAt.toMillis() : s.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
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
                    Survey in progress — integration with voice pipeline (e.g. eleven_labs) coming later.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleRun(s.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
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
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {showAIGenerateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !aiLoading && setShowAIGenerateModal(false)}
        >
          <div
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '0.75rem',
              maxWidth: '480px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem', color: '#1f2937' }}>
              Generate survey with AI
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Describe your survey topic or goals. AI will create a draft, refine it with our QA criteria, and pre-fill the form so you can save and edit.
            </p>
            <form onSubmit={handleAIGenerateSubmit}>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Customer satisfaction for a coffee shop: satisfaction with taste, wait time, and cleanliness; demographics; NPS."
                disabled={aiLoading}
                rows={5}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${aiError ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '0.5rem',
                  outline: 'none',
                  fontSize: '0.9375rem',
                  resize: 'vertical',
                  marginBottom: '1rem',
                  boxSizing: 'border-box',
                }}
              />
              {aiError && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  {aiError}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAIGenerateModal(false)}
                  disabled={aiLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={aiLoading || !aiPrompt.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    background: aiLoading || !aiPrompt.trim() ? '#9ca3af' : '#7c3aed',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: aiLoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {aiLoading ? 'Creating survey…' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '0.75rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', color: '#1f2937' }}>
              Delete Survey?
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
              Are you sure you want to delete this survey? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SurveyExecution;
