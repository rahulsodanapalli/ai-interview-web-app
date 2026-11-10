import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { listSessions, getSession, completeSession } from '../../api/sessionService';
import { formatApiError, isRequestAborted } from '../../utils/error';
import {
  formatDateTime,
  getDifficultyBadgeClass,
  getRatingBadgeClass,
  getRatingColor,
  getRatingFromScore,
} from '../../utils/format';
import type {
  SessionDetailResponse,
  InterviewSessionSummaryResponse,
} from '../../types';
import { SkeletonListRows } from '../../components/ui/Skeleton';
import ErrorDisplay from '../../components/ui/ErrorDisplay';
import EmptyState from '../../components/ui/EmptyState';
import {
  AwardIcon,
  ArrowRightIcon,
  DashboardIcon,
  HistoryIcon,
  SparklesIcon,
} from '../../components/ui/Icons';
import './EvaluationResults.css';

interface LocationState {
  summary?: InterviewSessionSummaryResponse;
}

export default function EvaluationResults() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as LocationState | null) ?? null;

  // Overview state (/results)
  const [sessions, setSessions] = useState<SessionDetailResponse[]>([]);

  // Single-session result state (/results/:sessionId)
  const [detailSession, setDetailSession] = useState<SessionDetailResponse | null>(null);
  const [summary, setSummary] = useState<InterviewSessionSummaryResponse | null>(
    routeState?.summary ?? null
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        if (sessionId) {
          const sessionData = await getSession(sessionId, { signal: controller.signal });
          if (!active) return;
          setDetailSession(sessionData);

          if (!routeState?.summary || routeState.summary.session_id !== sessionId) {
            try {
              const summaryData = await completeSession(sessionId, { signal: controller.signal });
              if (active) setSummary(summaryData);
            } catch {
              // If completeSession fails or session is still in progress, fall back gracefully to sessionData
            }
          }
          if (active) {
            setError('');
            setLoading(false);
          }
        } else {
          const data = await listSessions(50, 0, { signal: controller.signal });
          if (!active) return;
          setSessions(data.filter((s) => s.questions.some((q) => q.evaluation !== null)));
          setError('');
          setLoading(false);
        }
      } catch (err) {
        if (!active || isRequestAborted(err)) return;
        setError(formatApiError(err, 'Failed to load evaluation results.'));
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [sessionId, reloadTick, routeState?.summary]);

  function handleRetry() {
    setLoading(true);
    setError('');
    setReloadTick((t) => t + 1);
  }

  if (loading) {
    return (
      <div className="page-container-narrow">
        <SkeletonListRows count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container-narrow">
        <ErrorDisplay
          title="Could not load interview results"
          message={error}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  // ── Single Session Final Summary View (/results/:sessionId) ──
  if (sessionId && detailSession) {
    const evaluatedQuestions = detailSession.questions.filter((q) => q.evaluation !== null);

    const computedAvg =
      evaluatedQuestions.length > 0
        ? Math.round(
            evaluatedQuestions.reduce((sum, q) => sum + (q.evaluation?.overall_score ?? 0), 0) /
              evaluatedQuestions.length
          )
        : null;

    const overallScore =
      summary && typeof summary.average_score === 'number'
        ? Math.round(summary.average_score)
        : computedAvg;

    const overallRating =
      summary?.overall_rating ??
      (overallScore !== null ? getRatingFromScore(overallScore) : null);

    const questionsCompleted = summary?.questions_answered ?? detailSession.completed_questions;
    const totalQuestions = summary?.total_questions ?? detailSession.total_questions;

    const strengths =
      summary?.aggregated_strengths && summary.aggregated_strengths.length > 0
        ? summary.aggregated_strengths
        : Array.from(
            new Set(
              evaluatedQuestions.flatMap((q) => q.evaluation?.strengths ?? [])
            )
          );

    const improvements =
      summary?.aggregated_improvement_areas && summary.aggregated_improvement_areas.length > 0
        ? summary.aggregated_improvement_areas
        : Array.from(
            new Set(
              evaluatedQuestions.flatMap((q) => q.evaluation?.improvements ?? [])
            )
          );

    return (
      <div className="page-container-narrow animate-fade-in" id="session-summary-section">
        <div className="page-header">
          <div className="page-header-text">
            <h2 className="page-title">Interview Summary</h2>
            <p className="page-subtitle">
              {detailSession.topic || detailSession.role} · {detailSession.role} ·{' '}
              {formatDateTime(detailSession.updated_at || detailSession.created_at)}
            </p>
          </div>
          <span
            className={`badge ${
              detailSession.status === 'completed' ? 'badge-success' : 'badge-warning'
            }`}
          >
            {detailSession.status === 'completed' ? 'Completed' : 'In Progress'}
          </span>
        </div>

        {/* Hero Summary Card */}
        <section className="surface-card result-summary-hero">
          <div className="summary-score-col">
            <div
              className="summary-score-ring"
              style={{
                borderColor: overallRating ? getRatingColor(overallRating) : 'var(--border-default)',
              }}
              id="summary-score-ring"
            >
              <span className="summary-score-val">
                {overallScore !== null ? overallScore : '—'}
              </span>
              <span className="summary-score-sub">
                {overallScore !== null ? '/ 100' : 'N/A'}
              </span>
            </div>
          </div>

          <div className="summary-overview-col">
            <div className="summary-rating-header">
              <h3 className="summary-overview-title">Performance Summary</h3>
              {overallRating && (
                <span
                  className={`badge ${getRatingBadgeClass(overallRating)}`}
                  id="summary-rating-text"
                >
                  {overallRating}
                </span>
              )}
            </div>

            <p className="summary-overview-desc">
              Completed <strong>{questionsCompleted}</strong> of{' '}
              <strong>{totalQuestions}</strong> interview questions.
              {evaluatedQuestions.length > 0
                ? ` Evaluated across ${evaluatedQuestions.length} submitted response${
                    evaluatedQuestions.length === 1 ? '' : 's'
                  }.`
                : ' No evaluated answers were recorded in this session.'}
            </p>

            <div className="summary-metrics-inline">
              <div className="inline-metric">
                <span className="inline-metric-label">Completed</span>
                <span className="inline-metric-value">
                  {questionsCompleted}/{totalQuestions}
                </span>
              </div>
              <div className="inline-metric">
                <span className="inline-metric-label">Difficulty</span>
                <span className="inline-metric-value">{detailSession.difficulty}</span>
              </div>
              <div className="inline-metric">
                <span className="inline-metric-label">Type</span>
                <span className="inline-metric-value">{detailSession.question_type}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Aggregated Strengths & Improvements */}
        {(strengths.length > 0 || improvements.length > 0) && (
          <section className="summary-insights-grid">
            {strengths.length > 0 && (
              <div className="surface-card summary-insight-card">
                <h4 className="insight-heading text-success">Strengths</h4>
                <ul className="insight-list">
                  {strengths.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {improvements.length > 0 && (
              <div className="surface-card summary-insight-card">
                <h4 className="insight-heading text-warning">Areas for Improvement</h4>
                <ul className="insight-list">
                  {improvements.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Per-Question Breakdown */}
        <section className="summary-questions-section">
          <h3 className="section-heading">Question-by-Question Feedback</h3>

          {detailSession.questions.length === 0 ? (
            <EmptyState
              icon={<AwardIcon size={20} />}
              title="No questions in this session"
              description="This session has no generated questions yet."
            />
          ) : (
            <div className="summary-question-cards">
              {detailSession.questions.map((q) => (
                <article key={q.question_number} className="surface-card summary-q-card">
                  <div className="summary-q-header">
                    <div className="summary-q-badges">
                      <span className="badge badge-neutral">Q{q.question_number}</span>
                      <span className={`badge ${getDifficultyBadgeClass(q.difficulty)}`}>
                        {q.difficulty}
                      </span>
                      {q.topic && <span className="badge badge-primary">{q.topic}</span>}
                    </div>

                    {q.evaluation ? (
                      <span className={`badge ${getRatingBadgeClass(q.evaluation.rating)}`}>
                        {q.evaluation.overall_score}/100 · {q.evaluation.rating}
                      </span>
                    ) : (
                      <span className="badge badge-neutral">Not answered</span>
                    )}
                  </div>

                  <h4 className="summary-q-prompt">{q.question}</h4>

                  {q.candidate_answer && (
                    <div className="summary-q-answer">
                      <span className="q-sub-label">Your Answer</span>
                      <p>{q.candidate_answer}</p>
                    </div>
                  )}

                  {q.evaluation && (
                    <div className="summary-q-eval">
                      {q.evaluation.improvements?.length > 0 && (
                        <div className="q-eval-block">
                          <span className="q-sub-label">Recommended Improvements</span>
                          <ul>
                            {q.evaluation.improvements.map((imp, i) => (
                              <li key={i}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {q.evaluation.sample_answer && (
                        <div className="q-eval-block">
                          <span className="q-sub-label">Model Benchmark Answer</span>
                          <p className="q-sample-answer">{q.evaluation.sample_answer}</p>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Result Page Actions */}
        <div className="summary-actions-bar">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/history/${detailSession.session_id}`)}
            id="view-interview-details-btn"
          >
            <HistoryIcon size={15} />
            <span>View Interview Details</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            id="return-dashboard-btn"
          >
            <DashboardIcon size={15} />
            <span>Return to Dashboard</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/rag')}
            id="new-session-btn"
          >
            <SparklesIcon size={15} />
            <span>Start Another Interview</span>
          </button>
        </div>
      </div>
    );
  }

  // ── All Results Overview (/results) ──
  if (sessions.length === 0) {
    return (
      <div className="page-container-narrow">
        <EmptyState
          icon={<AwardIcon size={20} />}
          title="No evaluation results yet"
          description="Complete at least one interview question to see AI scores and rubric feedback."
          action={{ label: 'Start Document RAG Interview', onClick: () => navigate('/rag') }}
          secondaryAction={{ label: 'Configure AI Interview', onClick: () => navigate('/start') }}
        />
      </div>
    );
  }

  return (
    <div className="page-container-narrow animate-fade-in" id="results-page">
      <div className="page-header">
        <div className="page-header-text">
          <h2 className="page-title">Evaluation Results</h2>
          <p className="page-subtitle">
            Review scores, strengths, and question-level AI feedback across your evaluated sessions.
          </p>
        </div>
      </div>

      <div className="results-overview-list" id="results-list">
        {sessions.map((session) => {
          const evaluatedQuestions = session.questions.filter((q) => q.evaluation !== null);
          const avgScore =
            evaluatedQuestions.length > 0
              ? Math.round(
                  evaluatedQuestions.reduce(
                    (sum, q) => sum + (q.evaluation?.overall_score ?? 0),
                    0
                  ) / evaluatedQuestions.length
                )
              : 0;
          const rating = getRatingFromScore(avgScore);

          return (
            <div
              key={session.session_id}
              className="surface-card surface-card-interactive result-overview-card"
              onClick={() => navigate(`/results/${session.session_id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/results/${session.session_id}`);
                }
              }}
            >
              <div className="result-overview-top">
                <div className="result-overview-info">
                  <span className="result-overview-title">{session.topic || session.role}</span>
                  <span className="result-overview-meta">
                    {session.role} · {session.difficulty} · {evaluatedQuestions.length}/
                    {session.total_questions} evaluated
                  </span>
                </div>

                <div className="result-overview-score-group">
                  <span className={`badge ${getRatingBadgeClass(rating)}`}>
                    {avgScore}/100 · {rating}
                  </span>
                  <ArrowRightIcon size={15} className="result-chevron" />
                </div>
              </div>

              <div className="result-bars-list">
                {evaluatedQuestions.map((q) => (
                  <div className="result-bar-row" key={q.question_number}>
                    <span className="result-bar-num">Q{q.question_number}</span>
                    <div className="result-bar-track">
                      <div
                        className="result-bar-fill"
                        style={{
                          width: `${q.evaluation?.overall_score ?? 0}%`,
                          background: getRatingColor(q.evaluation?.rating ?? ''),
                        }}
                      />
                    </div>
                    <span className="result-bar-val">{q.evaluation?.overall_score}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
