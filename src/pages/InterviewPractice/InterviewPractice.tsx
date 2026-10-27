import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession, getNextQuestion, submitAnswer, completeSession } from '../../api/sessionService';
import type {
  SessionDetailResponse,
  SessionNextQuestionResponse,
  SessionSubmitAnswerResponse,
  InterviewSessionSummaryResponse,
  SessionQuestionItem,
} from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorDisplay from '../../components/ui/ErrorDisplay';
import './InterviewPractice.css';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'session-ready' }         // Session loaded, ready to generate questions
  | { kind: 'generating-question' }    // Waiting for next question from LLM
  | { kind: 'answering' }              // User is typing answer
  | { kind: 'evaluating' }             // Waiting for evaluation from LLM
  | { kind: 'evaluated' }              // Showing evaluation result
  | { kind: 'completing' }             // Completing session
  | { kind: 'completed' };             // Showing session summary

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    if ('response' in err) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: { detail?: string | Array<{ msg?: string; loc?: string[] }> };
        };
      };
      const status = axiosErr.response?.status;
      const detail = axiosErr.response?.data?.detail;

      if (typeof detail === 'string') {
        return detail;
      } else if (Array.isArray(detail) && detail.length > 0 && detail[0].msg) {
        return detail.map((d) => d.msg).join('; ');
      }

      if (status === 503) {
        return 'AI inference service is currently unavailable. Please verify Ollama is running with qwen2.5:1.5b.';
      } else if (status === 502) {
        return 'The local AI model returned an unexpected response. Please retry.';
      } else if (status === 404) {
        return 'Interview session not found. It may have expired or been removed.';
      } else if (status === 400) {
        return 'Invalid session request. Please check question status.';
      }
    } else if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
      const msg = (err as { message: string }).message;
      if (msg.includes('timeout') || msg.includes('timed out')) {
        return 'Request timed out waiting for local AI inference. Ollama may be busy or loading the model.';
      } else if (msg.includes('Network Error')) {
        return 'Network error: Cannot reach the backend API. Please verify FastAPI is running on port 8000.';
      }
      return msg;
    }
  }
  return 'An unexpected error occurred during evaluation.';
}

export default function InterviewPractice() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<SessionNextQuestionResponse | null>(null);
  const [lastEvaluation, setLastEvaluation] = useState<SessionSubmitAnswerResponse | null>(null);
  const [evaluatedQuestionText, setEvaluatedQuestionText] = useState<string>('');
  const [submittedAnswerText, setSubmittedAnswerText] = useState<string>('');
  const [summary, setSummary] = useState<InterviewSessionSummaryResponse | null>(null);
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [viewState, setViewState] = useState<ViewState>({ kind: 'loading' });

  // Answer submission error & retry handling (preserves typed answer)
  const [submitError, setSubmitError] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedSample, setCopiedSample] = useState<boolean>(false);

  // Load session on mount
  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    setViewState({ kind: 'loading' });
    setSubmitError('');
    setValidationError('');

    try {
      const data = await getSession(sessionId);
      setSession(data);

      if (data.status === 'completed') {
        setViewState({ kind: 'completed' });
        return;
      }

      // Check if there is an active unanswered question already generated
      const unanswered = data.questions.find((q) => q.candidate_answer === null);
      if (unanswered) {
        setCurrentQuestion({
          session_id: data.session_id,
          question_number: unanswered.question_number,
          total_questions: data.total_questions,
          question: unanswered.question,
          expected_answer_points: unanswered.expected_answer_points,
          follow_up_question: unanswered.follow_up_question,
          difficulty: unanswered.difficulty,
          topic: unanswered.topic,
        });
        setCandidateAnswer('');
        setViewState({ kind: 'answering' });
      } else if (data.questions.length > 0) {
        // All generated questions so far are answered
        const lastQ: SessionQuestionItem = data.questions[data.questions.length - 1];
        if (lastQ.evaluation) {
          setLastEvaluation({
            session_id: data.session_id,
            question_number: lastQ.question_number,
            completed_questions: data.completed_questions,
            total_questions: data.total_questions,
            status: data.status,
            evaluation: lastQ.evaluation,
          });
          setEvaluatedQuestionText(lastQ.question);
          setSubmittedAnswerText(lastQ.candidate_answer || '');
          setViewState({ kind: 'evaluated' });
        } else if (data.completed_questions >= data.total_questions) {
          setViewState({ kind: 'completed' });
        } else {
          setViewState({ kind: 'session-ready' });
        }
      } else {
        setViewState({ kind: 'session-ready' });
      }
    } catch (err: unknown) {
      setViewState({ kind: 'error', message: extractErrorMessage(err) });
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Generate next question
  async function handleNextQuestion() {
    if (!sessionId) return;
    setViewState({ kind: 'generating-question' });
    setLastEvaluation(null);
    setCandidateAnswer('');
    setSubmitError('');
    setValidationError('');

    try {
      const question = await getNextQuestion(sessionId);
      setCurrentQuestion(question);

      // Re-fetch session to sync progress
      const updatedSession = await getSession(sessionId);
      setSession(updatedSession);
      setViewState({ kind: 'answering' });
    } catch (err: unknown) {
      setViewState({ kind: 'error', message: extractErrorMessage(err) });
    }
  }

  // Submit candidate answer
  async function handleSubmitAnswer(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!sessionId || !currentQuestion || isSubmitting) return;

    setSubmitError('');
    setValidationError('');

    const trimmed = candidateAnswer.trim();
    if (!trimmed) {
      setValidationError('Please type your answer before submitting.');
      return;
    }

    if (trimmed.length < 2) {
      setValidationError('Answer must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);
    setViewState({ kind: 'evaluating' });

    try {
      const result = await submitAnswer(sessionId, {
        candidate_answer: trimmed,
        question_number: currentQuestion.question_number,
      });

      setLastEvaluation(result);
      setEvaluatedQuestionText(currentQuestion.question);
      setSubmittedAnswerText(trimmed);

      // Re-fetch session to sync updated questions and evaluations
      const updatedSession = await getSession(sessionId);
      setSession(updatedSession);

      if (result.status === 'completed') {
        setViewState({ kind: 'completed' });
      } else {
        setViewState({ kind: 'evaluated' });
      }
    } catch (err: unknown) {
      // Preserve candidateAnswer in state, return to answering mode and display error banner
      const errorMsg = extractErrorMessage(err);
      setSubmitError(errorMsg);
      setViewState({ kind: 'answering' });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Complete session
  async function handleCompleteSession() {
    if (!sessionId) return;
    setViewState({ kind: 'completing' });

    try {
      const result = await completeSession(sessionId);
      setSummary(result);
      setViewState({ kind: 'completed' });
    } catch (err: unknown) {
      setViewState({ kind: 'error', message: extractErrorMessage(err) });
    }
  }

  // Copy sample answer
  function handleCopySample(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  }

  // Rating color helper
  function ratingColor(rating: string): string {
    switch (rating) {
      case 'Excellent':
        return 'var(--color-success)';
      case 'Good':
        return 'var(--color-info)';
      case 'Fair':
        return 'var(--color-warning)';
      default:
        return 'var(--color-error)';
    }
  }

  if (viewState.kind === 'loading') {
    return <LoadingSpinner message="Loading interview session…" />;
  }

  if (viewState.kind === 'error') {
    return <ErrorDisplay message={viewState.message} onRetry={loadSession} />;
  }

  if (!session) {
    return <ErrorDisplay message="Session not found" />;
  }

  return (
    <div className="practice-page animate-fade-in" id="practice-page">
      {/* Session Progress Header */}
      <div className="session-bar glass-card" id="session-info-bar">
        <div className="bar-info">
          <div className="bar-title-row">
            <span className="bar-role">{session.role}</span>
            <span className={`badge ${session.status === 'completed' ? 'badge-success' : 'badge-warning'}`} id="session-status-badge">
              {session.status === 'completed' ? 'Completed' : 'In Progress'}
            </span>
          </div>
          <span className="bar-details">
            📌 {session.topic} · {session.difficulty} · {session.experience_level} · {session.question_type}
          </span>
        </div>

        <div className="bar-progress">
          <div className="bar-progress-track">
            <div
              className="bar-progress-fill"
              style={{
                width: `${(session.completed_questions / session.total_questions) * 100}%`,
              }}
            ></div>
          </div>
          <span className="bar-progress-text" id="progress-text">
            {session.completed_questions} of {session.total_questions} answered
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="practice-content">
        {/* State: Session Ready (No questions generated yet) */}
        {viewState.kind === 'session-ready' && (
          <div className="practice-prompt glass-card" id="session-ready-prompt">
            <div className="prompt-icon">🎯</div>
            <h3>Ready to begin your interview?</h3>
            <p>
              Click below to generate question {session.completed_questions + 1}.
              The local AI will tailor questions based on your configured role and topic.
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleNextQuestion}
              id="generate-first-question-btn"
            >
              🚀 Generate Question {session.completed_questions + 1}
            </button>
          </div>
        )}

        {/* State: Generating question with LLM */}
        {viewState.kind === 'generating-question' && (
          <div className="eval-loading-card glass-card animate-fade-in" id="generating-question-spinner">
            <LoadingSpinner message="Local AI (Qwen 2.5) is generating your next interview question…" size="lg" />
            <p className="eval-loading-subtext">
              Generating structured technical question tailored for <strong>{session.role}</strong>…
            </p>
          </div>
        )}

        {/* State: Answering — Display Question + Answer Textarea */}
        {viewState.kind === 'answering' && currentQuestion && (
          <div className="question-section animate-fade-in" id="question-answering-section">
            {/* Question Card */}
            <div className="question-card glass-card" id="current-question-card">
              <div className="question-header">
                <div className="question-header-left">
                  <span className="question-number" id="question-number-tag">
                    Question {currentQuestion.question_number} of {currentQuestion.total_questions}
                  </span>
                  <span className={`badge badge-diff badge-diff-${currentQuestion.difficulty.toLowerCase()}`}>
                    {currentQuestion.difficulty}
                  </span>
                  <span className="badge badge-info">
                    {session.question_type}
                  </span>
                </div>
                <span className="question-topic-pill">
                  📌 {currentQuestion.topic}
                </span>
              </div>

              <h3 className="question-text" id="practice-question-text">
                {currentQuestion.question}
              </h3>

              {/* Follow-up question probe (if provided) */}
              {currentQuestion.follow_up_question && (
                <div className="practice-followup glass-card" id="practice-followup-box">
                  <div className="followup-title-row">
                    <span className="followup-icon">💡</span>
                    <span className="followup-title">Interviewer Follow-Up Probe</span>
                  </div>
                  <p className="followup-text">{currentQuestion.follow_up_question}</p>
                  <span className="followup-tip">
                    Tip: A comprehensive response touches upon this aspect as well.
                  </span>
                </div>
              )}
            </div>

            {/* Answer Form */}
            <form className="answer-form glass-card" onSubmit={handleSubmitAnswer} id="answer-form" noValidate>
              <div className="answer-form-header">
                <label htmlFor="candidate-answer" className="form-label">
                  Your Technical Response *
                </label>
                <span className="answer-hint">
                  Explain your reasoning, architectural considerations, and code patterns clearly.
                </span>
              </div>

              <textarea
                id="candidate-answer"
                className={`form-textarea answer-textarea ${validationError ? 'input-error' : ''}`}
                placeholder="Type your answer here… Be as detailed and structured as you would in an actual technical interview."
                value={candidateAnswer}
                onChange={(e) => {
                  setCandidateAnswer(e.target.value);
                  if (validationError) setValidationError('');
                  if (submitError) setSubmitError('');
                }}
                minLength={2}
                maxLength={10000}
                disabled={isSubmitting}
                rows={9}
                required
              />

              {/* Validation error */}
              {validationError && (
                <div className="answer-validation-error" role="alert" id="answer-validation-error">
                  ⚠️ {validationError}
                </div>
              )}

              {/* API error banner with retry */}
              {submitError && (
                <div className="form-error" role="alert" id="answer-api-error">
                  <div className="error-icon-box">⚠️</div>
                  <div className="error-content-box">
                    <strong>Evaluation Failed:</strong>
                    <p>{submitError}</p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm retry-btn"
                      onClick={() => handleSubmitAnswer()}
                      id="retry-answer-btn"
                    >
                      🔄 Retry Submission
                    </button>
                  </div>
                </div>
              )}

              <div className="answer-actions">
                <span className="char-count" id="char-counter">
                  {candidateAnswer.length} / 10,000 characters
                </span>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={isSubmitting || candidateAnswer.trim().length === 0}
                  id="submit-answer-btn"
                >
                  {isSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Evaluating Answer…
                    </>
                  ) : (
                    <>🎯 Submit Answer for Evaluation</>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* State: Evaluating with LLM */}
        {viewState.kind === 'evaluating' && (
          <div className="eval-loading-card glass-card animate-fade-in" id="evaluating-spinner">
            <LoadingSpinner message="AI is evaluating your response…" size="lg" />
            <p className="eval-loading-subtext">
              Using local <strong>Qwen 2.5</strong> via Ollama. Evaluating technical correctness, missing concepts, strengths, and rubric score (~5–15s)…
            </p>
          </div>
        )}

        {/* State: Evaluated — Display Evaluation Results */}
        {viewState.kind === 'evaluated' && lastEvaluation && (
          <div className="evaluation-section animate-fade-in" id="evaluation-results-section">
            {/* Evaluated Question Banner */}
            <div className="eval-context-card glass-card">
              <div className="eval-context-header">
                <span className="question-number">
                  Question {lastEvaluation.question_number} of {lastEvaluation.total_questions}
                </span>
                <span className="badge badge-success">✓ Evaluated & Persisted</span>
              </div>
              <p className="eval-context-question" id="evaluated-question-prompt">
                {evaluatedQuestionText || (currentQuestion?.question ?? '')}
              </p>
            </div>

            {/* Score & Rating Hero Card */}
            <div className="score-hero-card glass-card" id="evaluation-score-card">
              <div
                className="score-ring-lg"
                style={{ borderColor: ratingColor(lastEvaluation.evaluation.rating) }}
                id="score-ring"
              >
                <span className="score-value-lg" id="overall-score-value">
                  {lastEvaluation.evaluation.overall_score}
                </span>
                <span className="score-denominator">/ 100</span>
              </div>

              <div className="score-details-col">
                <div className="rating-badge-row">
                  <span className="rating-label">Performance Rating:</span>
                  <span
                    className="score-rating-pill"
                    style={{
                      color: ratingColor(lastEvaluation.evaluation.rating),
                      borderColor: ratingColor(lastEvaluation.evaluation.rating),
                    }}
                    id="evaluation-rating-pill"
                  >
                    {lastEvaluation.evaluation.rating}
                  </span>
                </div>
                <p className="score-desc">
                  {lastEvaluation.evaluation.overall_score >= 80 && 'Outstanding answer covering core concepts, edge cases, and architectural best practices.'}
                  {lastEvaluation.evaluation.overall_score >= 60 && lastEvaluation.evaluation.overall_score < 80 && 'Solid technical grasp of the fundamentals with minor gaps in depth or edge-case handling.'}
                  {lastEvaluation.evaluation.overall_score >= 40 && lastEvaluation.evaluation.overall_score < 60 && 'Basic understanding demonstrated, but essential technical points were omitted.'}
                  {lastEvaluation.evaluation.overall_score < 40 && 'Needs improvement. Key foundational concepts were missing or inaccurate.'}
                </p>
              </div>
            </div>

            {/* Candidate Submitted Answer Card */}
            {submittedAnswerText && (
              <div className="submitted-answer-card glass-card" id="submitted-answer-display">
                <div className="submitted-header">
                  <span className="submitted-title">📝 Your Submitted Response</span>
                  <span className="submitted-length">{submittedAnswerText.length} characters</span>
                </div>
                <p className="submitted-text">{submittedAnswerText}</p>
              </div>
            )}

            {/* Detailed Feedback Sections */}
            <div className="eval-details-grid">
              {/* Correct Points */}
              {lastEvaluation.evaluation.correct_points && lastEvaluation.evaluation.correct_points.length > 0 && (
                <div className="eval-card eval-card-correct glass-card" id="correct-points-card">
                  <h4 className="eval-card-title">
                    <span className="eval-icon">✅</span> Correct Points Covered
                  </h4>
                  <ul className="eval-bullet-list">
                    {lastEvaluation.evaluation.correct_points.map((p, i) => (
                      <li key={i} className="eval-bullet-item bullet-correct">
                        <span className="bullet-mark">✓</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Points */}
              {lastEvaluation.evaluation.missing_points && lastEvaluation.evaluation.missing_points.length > 0 && (
                <div className="eval-card eval-card-missing glass-card" id="missing-points-card">
                  <h4 className="eval-card-title">
                    <span className="eval-icon">⚠️</span> Missing Technical Points
                  </h4>
                  <ul className="eval-bullet-list">
                    {lastEvaluation.evaluation.missing_points.map((p, i) => (
                      <li key={i} className="eval-bullet-item bullet-missing">
                        <span className="bullet-mark">✗</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths */}
              {lastEvaluation.evaluation.strengths && lastEvaluation.evaluation.strengths.length > 0 && (
                <div className="eval-card eval-card-strengths glass-card" id="strengths-card">
                  <h4 className="eval-card-title">
                    <span className="eval-icon">💪</span> Key Strengths
                  </h4>
                  <ul className="eval-bullet-list">
                    {lastEvaluation.evaluation.strengths.map((s, i) => (
                      <li key={i} className="eval-bullet-item bullet-strength">
                        <span className="bullet-mark">★</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {lastEvaluation.evaluation.improvements && lastEvaluation.evaluation.improvements.length > 0 && (
                <div className="eval-card eval-card-improvements glass-card" id="improvements-card">
                  <h4 className="eval-card-title">
                    <span className="eval-icon">📈</span> Growth & Improvement Areas
                  </h4>
                  <ul className="eval-bullet-list">
                    {lastEvaluation.evaluation.improvements.map((s, i) => (
                      <li key={i} className="eval-bullet-item bullet-improvement">
                        <span className="bullet-mark">→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Sample / Model Answer */}
            {lastEvaluation.evaluation.sample_answer && (
              <div className="sample-answer-card glass-card" id="sample-answer-card">
                <div className="sample-header">
                  <h4 className="sample-title">
                    <span>💡 Model / Benchmark Answer</span>
                  </h4>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm copy-btn"
                    onClick={() => handleCopySample(lastEvaluation.evaluation.sample_answer)}
                    id="copy-sample-btn"
                  >
                    {copiedSample ? '✓ Copied!' : '📋 Copy Answer'}
                  </button>
                </div>
                <p className="sample-answer-text" id="sample-answer-text">
                  {lastEvaluation.evaluation.sample_answer}
                </p>
              </div>
            )}

            {/* Action Bar */}
            <div className="eval-actions">
              {session.completed_questions < session.total_questions ? (
                <button
                  className="btn btn-primary btn-lg action-cta-btn"
                  onClick={handleNextQuestion}
                  id="next-question-btn"
                >
                  🚀 Next Question → ({session.completed_questions + 1} of {session.total_questions})
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-lg action-cta-btn"
                  onClick={handleCompleteSession}
                  id="complete-session-btn"
                >
                  🎉 Complete Session & View Final Summary
                </button>
              )}

              {session.completed_questions >= 1 && session.completed_questions < session.total_questions && (
                <button
                  className="btn btn-secondary"
                  onClick={handleCompleteSession}
                  id="early-complete-btn"
                >
                  🏁 Finish Early & Summarize
                </button>
              )}
            </div>
          </div>
        )}

        {/* State: Completing Session */}
        {viewState.kind === 'completing' && (
          <div className="eval-loading-card glass-card animate-fade-in" id="completing-spinner">
            <LoadingSpinner message="Calculating overall interview performance summary…" size="lg" />
          </div>
        )}

        {/* State: Completed — Show Overall Summary */}
        {viewState.kind === 'completed' && (
          <div className="summary-section animate-fade-in" id="session-summary-section">
            {summary ? (
              <div className="summary-card glass-card">
                <h3 className="summary-title">🎉 Interview Complete!</h3>
                <div
                  className="summary-score-ring"
                  style={{ borderColor: ratingColor(summary.overall_rating) }}
                  id="summary-score-ring"
                >
                  <span className="summary-score">{Math.round(summary.average_score)}</span>
                  <span className="summary-label">Average</span>
                </div>
                <span
                  className="summary-rating"
                  style={{ color: ratingColor(summary.overall_rating) }}
                  id="summary-rating-text"
                >
                  {summary.overall_rating}
                </span>

                <div className="summary-stats">
                  <div className="summary-stat">
                    <span className="stat-number">{summary.questions_answered}</span>
                    <span className="stat-desc">Answered</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-number">{summary.total_questions}</span>
                    <span className="stat-desc">Total</span>
                  </div>
                </div>

                {summary.aggregated_strengths.length > 0 && (
                  <div className="summary-feedback">
                    <h4>💪 Cumulative Strengths</h4>
                    <ul>
                      {summary.aggregated_strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.aggregated_improvement_areas.length > 0 && (
                  <div className="summary-feedback">
                    <h4>📈 Priority Growth Areas</h4>
                    <ul>
                      {summary.aggregated_improvement_areas.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="summary-card glass-card">
                <h3 className="summary-title">Session Completed</h3>
                <p>This interview practice session is marked as completed.</p>
              </div>
            )}

            <div className="summary-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate('/start')}
                id="new-session-btn"
              >
                Start New Interview
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/results')}
                id="view-results-btn"
              >
                View Evaluation History
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
