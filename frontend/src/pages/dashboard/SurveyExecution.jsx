import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSurveys } from '../../context/SurveysContext';

function SurveyExecution() {
  const { surveys, addSurvey, updateSurvey, deleteSurvey } = useSurveys();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState(['']);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!title.trim()) {
      newErrors.title = 'Survey title is required';
    }
    
    const validQuestions = questions.filter((q) => q.trim());
    if (validQuestions.length === 0) {
      newErrors.questions = 'At least one question is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setTitle('');
    setQuestions(['']);
    setErrors({});
    setShowCreate(false);
    setEditingId(null);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    const qs = questions.filter((q) => q.trim());
    await addSurvey({
      title: title.trim(),
      questions: qs,
    });
    resetForm();
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    const qs = questions.filter((q) => q.trim());
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
    setQuestions(survey.questions?.length > 0 ? survey.questions : ['']);
    setErrors({});
    setShowCreate(false);
  };

  const handleDelete = async (id) => {
    const success = await deleteSurvey(id);
    if (success) {
      setDeleteConfirmId(null);
    }
  };

  const addQuestion = () => setQuestions((q) => [...q, '']);

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      setQuestions((q) => q.filter((_, i) => i !== index));
    }
  };

  const handleRun = (id) => {
    setRunningId(id);
    setTimeout(() => setRunningId(null), 3000);
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

      <div style={{ marginTop: '1.5rem' }}>
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
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={q}
                onChange={(e) => {
                  const next = [...questions];
                  next[i] = e.target.value;
                  setQuestions(next);
                  if (errors.questions) setErrors({ ...errors, questions: null });
                }}
                placeholder={`Question ${i + 1}`}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  border: `1px solid ${errors.questions ? '#ef4444' : '#d1d5db'}`,
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
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.05rem' }}>
                  {s.title}
                </div>
                {s.questions?.length > 0 && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    {s.questions.length} question{s.questions.length !== 1 ? 's' : ''}
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
