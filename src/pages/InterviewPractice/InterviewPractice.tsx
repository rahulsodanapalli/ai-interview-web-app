import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession, getNextQuestion, submitAnswer, completeSession } from '../../api/sessionService';
import { formatApiError, isRequestAborted } from '../../utils/error';
import { getDifficultyBadgeClass, getRatingBadgeClass, getRatingColor } from '../../utils/format';
import type {
  SessionDetailResponse,
  SessionQuestionItem,
} from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorDisplay from '../../components/ui/ErrorDisplay';
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  CopyIcon,
  RefreshIcon,
  SparklesIcon,
} from '../../components/ui/Icons';
import './InterviewPractice.css';

export default function InterviewPractice() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<number>(1);
  const [draftAnswers, setDraftAnswers] = useState<Record<number, string>>({});

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');

  const [copiedQuestionNum, setCopiedQuestionNum] = useState<number | null>(null);

  const isSubmittingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const isCompletingRef = useRef(false);
  const actionAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      actionAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    const controller = new AbortController();

    async function fetchInitial() {
      try {
        const data = await getSession(sessionId!, { signal: controller.signal });
        if (!active) return;

        setSession(data);
        setLoadError('');
        setInitialLoading(false);

        if (data.status === 'completed') {
          navigate(`/results/${data.session_id}`, { replace: true });
          return;
        }

        if (data.questions.length > 0) {
          const firstUnanswered = data.questions.find((q) => q.candidate_answer === null);
          setActiveQuestionNumber(
            firstUnanswered
              ? firstUnanswered.question_number
              : data.questions[data.questions.length - 1].question_number
          );
        } else {
          setActiveQuestionNumber(1);
        }
      } catch (err) {
        if (!active || isRequestAborted(err)) return;
        setLoadError(formatApiError(err, 'Failed to load interview session.'));
        setInitialLoading(false);
      }
    }

    void fetchInitial();

    return () => {
      active = false;
      controller.abort();
    };
  }, [sessionId, reloadTick, navigate]);

  function handleRetryLoad() {
    setInitialLoading(true);
    setLoadError('');
    setReloadTick((t) => t + 1);
  }

  function selectQuestion(qNum: number) {
    setActiveQuestionNumber(qNum);
    setValidationError('');
    setSubmitError('');
    setGenerateError('');
  }

  async function handleGenerateNextQuestion() {
    if (!sessionId || !session || isGeneratingRef.current) return;

    actionAbortRef.current?.abort();
    const controller = new AbortController();
    actionAbortRef.current = controller;

    isGeneratingRef.current = true;
    setIsGeneratingQuestion(true);
    setGenerateError('');

    try {
      const generated = await getNextQuestion(sessionId, { signal: controller.signal });
      const synced = await getSession(sessionId, { signal: controller.signal });

      if (!mountedRef.current || controller.signal.aborted) return;
      setSession(synced);
      setActiveQuestionNumber(generated.question_number);
    } catch (err) {
      if (!mountedRef.current || isRequestAborted(err)) return;
      setGenerateError(formatApiError(err, 'Failed to generate the next question. Please retry.'));
    } finally {
      if (mountedRef.current) {
        isGeneratingRef.current = false;
        setIsGeneratingQuestion(false);
      }
    }
  }

  async function handleSubmitAnswer(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!sessionId || !session || isSubmittingRef.current) return;

    const currentQ = session.questions.find((q) => q.question_number === activeQuestionNumber);
    if (!currentQ) return;

    const currentDraft = (draftAnswers[activeQuestionNumber] ?? '').trim();
    setValidationError('');
    setSubmitError('');

    if (!currentDraft) {
      setValidationError('Please enter your answer before submitting.');
      return;
    }
    if (currentDraft.length < 2) {
      setValidationError('Answer must be at least 2 characters.');
      return;
    }

    actionAbortRef.current?.abort();
    const controller = new AbortController();
    actionAbortRef.current = controller;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const res = await submitAnswer(
        sessionId,
        {
          candidate_answer: currentDraft,
          question_number: currentQ.question_number,
        },
        { signal: controller.signal }
      );

      const synced = await getSession(sessionId, { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;

      setSession(synced);

      if (res.status === 'completed') {
        try {
          const summary = await completeSession(sessionId, { signal: controller.signal });
          if (mountedRef.current && !controller.signal.aborted) {
            navigate(`/results/${sessionId}`, { state: { summary } });
          }
        } catch {
          if (mountedRef.current && !controller.signal.aborted) {
            navigate(`/results/${sessionId}`);
          }
        }
      }
    } catch (err) {
      if (!mountedRef.current || isRequestAborted(err)) return;
      setSubmitError(formatApiError(err, 'Failed to evaluate your answer. Your draft is preserved.'));
    } finally {
      if (mountedRef.current) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  }

  async function handleFinishInterview() {
    if (!sessionId || isCompletingRef.current) return;

    actionAbortRef.current?.abort();
    const controller = new AbortController();
    actionAbortRef.current = controller;

    isCompletingRef.current = true;
    setIsCompleting(true);
    setCompleteError('');

    try {
      const summary = await completeSession(sessionId, { signal: controller.signal });
      if (mountedRef.current && !controller.signal.aborted) {
        navigate(`/results/${sessionId}`, { state: { summary } });
      }
    } catch (err) {
      if (!mountedRef.current || isRequestAborted(err)) return;
      setCompleteError(formatApiError(err, 'Failed to finalize interview session. Please retry.'));
      isCompletingRef.current = false;
      setIsCompleting(false);
    }
  }

  function handleNextAction() {
    if (!session) return;
    const nextInList = session.questions.find(
      (q) => q.question_number > activeQuestionNumber
    );
    if (nextInList) {
      selectQuestion(nextInList.question_number);
      return;
    }
    if (session.questions.length < session.total_questions) {
      void handleGenerateNextQuestion();
    }
  }

  function handleCopySample(text: string, qNum: number) {
    navigator.clipboard.writeText(text);
    setCopiedQuestionNum(qNum);
    setTimeout(() => setCopiedQuestionNum(null), 2000);
  }

  if (initialLoading) {
    return (
      <div className="page-container-narrow">
        <div className="surface-card practice-loading-box">
          <LoadingSpinner message="Loading interview session…" size="lg" />
        </div>
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="page-container-narrow">
        <ErrorDisplay
          title="Could not open interview session"
          message={loadError || 'Interview session not found.'}
          onRetry={handleRetryLoad}
        />
      </div>
    );
  }

  const currentQuestion: SessionQuestionItem | undefined = session.questions.find(
    (q) => q.question_number === activeQuestionNumber
  );

  const currentDraft = draftAnswers[activeQuestionNumber] ?? '';
  const progressPct =
    session.total_questions > 0
      ? Math.round((session.completed_questions / session.total_questions) * 100)
      : 0;

  const hasPrevious = session.questions.some((q) => q.question_number < activeQuestionNumber);
  const hasNextAvailable =
    session.questions.some((q) => q.question_number > activeQuestionNumber) ||
    session.questions.length < session.total_questions;
  const allAnswered = session.completed_questions >= session.total_questions;

  return (
    <div className="page-container-narrow animate-fade-in" id="practice-page">
      {/* Top Session Bar */}
      <header className="surface-card practice-session-bar" id="session-info-bar">
        <div className="session-bar-top">
          <div className="session-bar-title-group">
            <div className="session-title-row">
              <h2 className="session-bar-title">{session.topic || session.role}</h2>
              <span className={`badge ${session.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                {session.status === 'completed' ? 'Completed' : 'In Progress'}
              </span>
            </div>
            <p className="session-bar-meta">
              {session.role} · {session.difficulty} · {session.experience_level} · {session.question_type}
            </p>
          </div>

          <div className="session-bar-actions">
            {session.completed_questions > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleFinishInterview()}
                disabled={isCompleting || isSubmitting}
                id="finish-interview-btn"
              >
                {isCompleting ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>Finishing…</span>
                  </>
                ) : (
                  <span>{allAnswered ? 'View Final Summary' : 'Finish Interview'}</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar + Question Stepper */}
        <div className="session-progress-row">
          <div className="progress-track-wrap">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="progress-label" id="progress-text">
              {session.completed_questions} of {session.total_questions} answered
            </span>
          </div>

          {session.questions.length > 0 && (
            <div className="question-stepper" role="navigation" aria-label="Questions">
              {session.questions.map((q) => {
                const isActive = q.question_number === activeQuestionNumber;
                const isAnswered = q.candidate_answer !== null;
                return (
                  <button
                    key={q.question_number}
                    type="button"
                    className={`stepper-pill ${isActive ? 'is-active' : ''} ${
                      isAnswered ? 'is-answered' : ''
                    }`}
                    onClick={() => selectQuestion(q.question_number)}
                    disabled={isSubmitting || isGeneratingQuestion}
                    title={`Question ${q.question_number}${isAnswered ? ' (Answered)' : ''}`}
                    id={`stepper-q-${q.question_number}`}
                  >
                    Q{q.question_number}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {completeError && (
        <div className="alert-banner alert-banner-error" role="alert">
          <AlertCircleIcon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div className="alert-banner-body">
            <div className="alert-banner-title">Unable to finish interview</div>
            <div>{completeError}</div>
          </div>
        </div>
      )}

      {/* No questions generated yet */}
      {session.questions.length === 0 ? (
        <div className="surface-card practice-empty-card" id="session-ready-prompt">
          {isGeneratingQuestion ? (
            <LoadingSpinner
              message="Generating first interview question…"
              subtext="Tailoring question via local Ollama model."
              size="md"
            />
          ) : (
            <>
              <div className="practice-ready-copy">
                <h3>Ready to start your interview</h3>
                <p>
                  Generate question 1 of {session.total_questions} for {session.role} ({session.topic}).
                </p>
              </div>
              {generateError && (
                <div className="alert-banner alert-banner-error" role="alert" style={{ width: '100%', textAlign: 'left' }}>
                  <AlertCircleIcon size={16} style={{ flexShrink: 0 }} />
                  <span>{generateError}</span>
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => void handleGenerateNextQuestion()}
                id="generate-first-question-btn"
              >
                <SparklesIcon size={16} />
                <span>Generate Question 1</span>
              </button>
            </>
          )}
        </div>
      ) : isGeneratingQuestion ? (
        <div className="surface-card practice-loading-box" id="generating-question-spinner">
          <LoadingSpinner
            message="Generating next interview question…"
            subtext={`Preparing question ${session.questions.length + 1} of ${session.total_questions}.`}
            size="md"
          />
        </div>
      ) : currentQuestion ? (
        <div className="practice-workspace">
          {/* Question Card — Always visible without layout shift */}
          <section className="surface-card question-display-card" id="current-question-card">
            <div className="question-card-top">
              <div className="question-card-badges">
                <span className="question-index-label" id="question-number-tag">
                  Question {currentQuestion.question_number} of {session.total_questions}
                </span>
                <span className={`badge ${getDifficultyBadgeClass(currentQuestion.difficulty)}`}>
                  {currentQuestion.difficulty}
                </span>
                {currentQuestion.topic && (
                  <span className="badge badge-neutral">{currentQuestion.topic}</span>
                )}
              </div>

              {currentQuestion.evaluation && (
                <span className="badge badge-success">
                  <CheckCircleIcon size={12} />
                  <span>Evaluated</span>
                </span>
              )}
            </div>

            <h3 className="question-prompt-text" id="practice-question-text">
              {currentQuestion.question}
            </h3>

            {currentQuestion.follow_up_question && (
              <div className="question-followup-panel" id="practice-followup-box">
                <span className="followup-panel-label">Follow-up Probe</span>
                <p className="followup-panel-text">{currentQuestion.follow_up_question}</p>
              </div>
            )}
          </section>

          {/* Answer or Evaluation Area */}
          {currentQuestion.candidate_answer !== null && currentQuestion.evaluation ? (
            <section className="evaluation-stack animate-fade-in" id="evaluation-results-section">
              {/* Submitted Answer */}
              <div className="surface-card submitted-answer-panel" id="submitted-answer-display">
                <div className="panel-header-row">
                  <span className="panel-section-label">Your Answer</span>
                  <span className="panel-meta-mono">
                    {currentQuestion.candidate_answer.length} chars
                  </span>
                </div>
                <p className="submitted-answer-body">{currentQuestion.candidate_answer}</p>
              </div>

              {/* AI Score & Rating */}
              <div className="surface-card eval-score-panel" id="evaluation-score-card">
                <div
                  className="eval-score-badge"
                  style={{ borderColor: getRatingColor(currentQuestion.evaluation.rating) }}
                  id="score-ring"
                >
                  <span className="eval-score-number" id="overall-score-value">
                    {currentQuestion.evaluation.overall_score}
                  </span>
                  <span className="eval-score-max">/100</span>
                </div>

                <div className="eval-score-summary">
                  <div className="eval-rating-row">
                    <span className="panel-section-label">AI Evaluation</span>
                    <span
                      className={`badge ${getRatingBadgeClass(currentQuestion.evaluation.rating)}`}
                      id="evaluation-rating-pill"
                    >
                      {currentQuestion.evaluation.rating}
                    </span>
                  </div>
                  <p className="eval-score-note">
                    Evaluated against expected technical points for this question.
                  </p>
                </div>
              </div>

              {/* Structured Feedback Cards */}
              <div className="eval-feedback-grid">
                {currentQuestion.evaluation.correct_points?.length > 0 && (
                  <div className="surface-card feedback-card" id="correct-points-card">
                    <h4 className="feedback-card-title text-success">Correct Points Covered</h4>
                    <ul className="feedback-list">
                      {currentQuestion.evaluation.correct_points.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentQuestion.evaluation.missing_points?.length > 0 && (
                  <div className="surface-card feedback-card" id="missing-points-card">
                    <h4 className="feedback-card-title text-error">Missing Concepts</h4>
                    <ul className="feedback-list">
                      {currentQuestion.evaluation.missing_points.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentQuestion.evaluation.strengths?.length > 0 && (
                  <div className="surface-card feedback-card" id="strengths-card">
                    <h4 className="feedback-card-title text-info">Strengths</h4>
                    <ul className="feedback-list">
                      {currentQuestion.evaluation.strengths.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentQuestion.evaluation.improvements?.length > 0 && (
                  <div className="surface-card feedback-card" id="improvements-card">
                    <h4 className="feedback-card-title text-warning">Suggested Improvements</h4>
                    <ul className="feedback-list">
                      {currentQuestion.evaluation.improvements.map((pt, idx) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Sample Answer */}
              {currentQuestion.evaluation.sample_answer && (
                <div className="surface-card sample-answer-panel" id="sample-answer-card">
                  <div className="panel-header-row">
                    <span className="panel-section-label">Model Benchmark Answer</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        handleCopySample(
                          currentQuestion.evaluation!.sample_answer,
                          currentQuestion.question_number
                        )
                      }
                      id="copy-sample-btn"
                    >
                      {copiedQuestionNum === currentQuestion.question_number ? (
                        <>
                          <CheckIcon size={13} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <CopyIcon size={13} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="sample-answer-body" id="sample-answer-text">
                    {currentQuestion.evaluation.sample_answer}
                  </p>
                </div>
              )}
            </section>
          ) : (
            <form
              className="surface-card answer-input-card"
              onSubmit={handleSubmitAnswer}
              id="answer-form"
              noValidate
            >
              <div className="panel-header-row">
                <label htmlFor="candidate-answer" className="form-label">
                  Your Response
                </label>
                <span className="panel-meta-mono">{currentDraft.length} / 10,000</span>
              </div>

              <textarea
                id="candidate-answer"
                className={`form-textarea answer-textarea ${validationError ? 'input-error' : ''}`}
                placeholder="Write a structured, detailed technical answer. Explain your approach, trade-offs, and edge cases…"
                value={currentDraft}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftAnswers((prev) => ({
                    ...prev,
                    [activeQuestionNumber]: val,
                  }));
                  if (validationError) setValidationError('');
                  if (submitError) setSubmitError('');
                }}
                maxLength={10000}
                disabled={isSubmitting}
                rows={8}
              />

              {validationError && (
                <div className="field-error-text" role="alert" id="answer-validation-error">
                  <AlertCircleIcon size={14} />
                  <span>{validationError}</span>
                </div>
              )}

              {submitError && (
                <div className="alert-banner alert-banner-error" role="alert" id="answer-api-error">
                  <AlertCircleIcon size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div className="alert-banner-body">
                    <div className="alert-banner-title">Evaluation failed</div>
                    <div>{submitError}</div>
                    <div className="alert-banner-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleSubmitAnswer()}
                        id="retry-answer-btn"
                      >
                        <RefreshIcon size={13} />
                        <span>Retry Submit</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isSubmitting && (
                <div className="evaluating-inline-banner" id="evaluating-spinner" role="status">
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>Evaluating your answer against technical criteria…</span>
                </div>
              )}

              <div className="answer-footer-bar">
                <span className="form-hint">
                  Drafts are preserved when switching between questions.
                </span>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || currentDraft.trim().length === 0}
                  id="submit-answer-btn"
                >
                  {isSubmitting ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      <span>Evaluating…</span>
                    </>
                  ) : (
                    <span>Submit Answer</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {generateError && (
            <div className="alert-banner alert-banner-error" role="alert">
              <AlertCircleIcon size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div className="alert-banner-body">
                <div className="alert-banner-title">Could not load next question</div>
                <div>{generateError}</div>
              </div>
            </div>
          )}

          {/* Bottom Navigation Bar */}
          <div className="practice-nav-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!hasPrevious || isSubmitting || isGeneratingQuestion}
              onClick={() => {
                const prevQ = [...session.questions]
                  .reverse()
                  .find((q) => q.question_number < activeQuestionNumber);
                if (prevQ) selectQuestion(prevQ.question_number);
              }}
              id="prev-question-btn"
            >
              <ChevronLeftIcon size={15} />
              <span>Previous</span>
            </button>

            <div className="practice-nav-right">
              {hasNextAvailable && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNextAction}
                  disabled={isSubmitting || isGeneratingQuestion}
                  id="next-question-btn"
                >
                  <span>Next Question</span>
                  <ArrowRightIcon size={15} />
                </button>
              )}

              {allAnswered && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleFinishInterview()}
                  disabled={isCompleting || isSubmitting}
                  id="complete-session-btn"
                >
                  <span>Complete & View Results</span>
                  <ArrowRightIcon size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
