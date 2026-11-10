import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listSessions, getSession } from '../../api/sessionService';
import { formatApiError, isRequestAborted } from '../../utils/error';
import {
  formatDateTime,
  formatRelativeDate,
  getDifficultyBadgeClass,
  getRatingBadgeClass,
  getRatingFromScore,
} from '../../utils/format';
import type { SessionDetailResponse, SessionQuestionItem } from '../../types';
import { SkeletonListRows, SkeletonStatsRow } from '../../components/ui/Skeleton';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorDisplay from '../../components/ui/ErrorDisplay';
import EmptyState from '../../components/ui/EmptyState';
import {
  SearchIcon,
  XIcon,
  RefreshIcon,
  HistoryIcon,
  CopyIcon,
  CheckIcon,
  ArrowRightIcon,
  AwardIcon,
} from '../../components/ui/Icons';
import './InterviewHistory.css';

function getSessionAverageScore(sessionItem: SessionDetailResponse): number | null {
  const evaluated = sessionItem.questions.filter((q) => q.evaluation !== null);
  if (evaluated.length === 0) return null;
  const sum = evaluated.reduce((acc, q) => acc + (q.evaluation?.overall_score ?? 0), 0);
  return Math.round(sum / evaluated.length);
}

export default function InterviewHistory() {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams<{ sessionId?: string }>();

  const [sessions, setSessions] = useState<SessionDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const selectedSessionId = routeSessionId ?? localSelectedId;

  const [detailSession, setDetailSession] = useState<SessionDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailReloadTick, setDetailReloadTick] = useState(0);
  const [copiedAnswerIdx, setCopiedAnswerIdx] = useState<number | null>(null);

  // Load session list
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function fetchHistory() {
      try {
        const data = await listSessions(50, 0, { signal: controller.signal });
        if (!active) return;
        setSessions(data);
        setError('');
        setLoading(false);
      } catch (err) {
        if (!active || isRequestAborted(err)) return;
        setError(formatApiError(err, 'Failed to load interview history.'));
        setLoading(false);
      }
    }

    void fetchHistory();

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadTick]);

  // Load selected session detail
  useEffect(() => {
    if (!selectedSessionId) return;

    let active = true;
    const controller = new AbortController();

    async function fetchDetail() {
      try {
        const data = await getSession(selectedSessionId!, { signal: controller.signal });
        if (!active) return;
        setDetailSession(data);
        setDetailError('');
        setDetailLoading(false);
      } catch (err) {
        if (!active || isRequestAborted(err)) return;
        setDetailError(formatApiError(err, 'Failed to load session details.'));
        setDetailLoading(false);
      }
    }

    void fetchDetail();

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedSessionId, detailReloadTick]);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedSessionId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setLocalSelectedId(null);
        setDetailSession(null);
        if (routeSessionId) {
          navigate('/history');
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedSessionId, routeSessionId, navigate]);

  const filteredSessions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return sessions.filter((s) => {
      const matchesSearch =
        !query ||
        s.role.toLowerCase().includes(query) ||
        s.topic.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sessions, searchTerm, statusFilter]);

  const metrics = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter((s) => s.status === 'completed').length;
    const inProgress = sessions.filter((s) => s.status === 'in_progress').length;

    let evaluatedCount = 0;
    let scoreSum = 0;
    sessions.forEach((s) => {
      s.questions.forEach((q) => {
        if (q.evaluation) {
          evaluatedCount++;
          scoreSum += q.evaluation.overall_score;
        }
      });
    });

    const averageScore = evaluatedCount > 0 ? Math.round(scoreSum / evaluatedCount) : null;
    return { total, completed, inProgress, averageScore };
  }, [sessions]);

  function handleRefresh() {
    setLoading(true);
    setError('');
    setReloadTick((t) => t + 1);
  }

  function handleOpenDetail(id: string) {
    setDetailLoading(true);
    setDetailError('');
    setDetailSession(null);
    setLocalSelectedId(id);
  }

  function handleCloseDetail() {
    setLocalSelectedId(null);
    setDetailSession(null);
    setDetailError('');
    if (routeSessionId) {
      navigate('/history');
    }
  }

  function handleRetryDetail() {
    setDetailLoading(true);
    setDetailError('');
    setDetailReloadTick((t) => t + 1);
  }

  function handleCopySample(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedAnswerIdx(idx);
    setTimeout(() => setCopiedAnswerIdx(null), 2000);
  }

  if (loading) {
    return (
      <div className="page-container">
        <SkeletonStatsRow count={4} />
        <SkeletonListRows count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <ErrorDisplay
          title="Could not load interview history"
          message={error}
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" id="history-page">
      <div className="page-header">
        <div className="page-header-text">
          <h2 className="page-title">Interview History</h2>
          <p className="page-subtitle">
            Review completed interviews, inspect question-level feedback, and resume sessions in progress.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleRefresh}
          id="refresh-history-btn"
        >
          <RefreshIcon size={13} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Row (only shown when real sessions exist) */}
      {sessions.length > 0 && (
        <div className="history-stats-grid">
          <div className="surface-card history-stat-card">
            <span className="history-stat-label">Total Sessions</span>
            <span className="history-stat-val" id="metric-total-sessions">
              {metrics.total}
            </span>
          </div>
          <div className="surface-card history-stat-card">
            <span className="history-stat-label">Completed</span>
            <span className="history-stat-val" id="metric-completed-sessions">
              {metrics.completed}
            </span>
          </div>
          <div className="surface-card history-stat-card">
            <span className="history-stat-label">In Progress</span>
            <span className="history-stat-val" id="metric-inprogress-sessions">
              {metrics.inProgress}
            </span>
          </div>
          <div className="surface-card history-stat-card">
            <span className="history-stat-label">Average Score</span>
            <span className="history-stat-val" id="metric-average-score">
              {metrics.averageScore !== null ? `${metrics.averageScore}/100` : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      {sessions.length > 0 && (
        <div className="surface-card history-controls">
          <div className="history-search-wrap">
            <SearchIcon size={15} className="history-search-icon" />
            <input
              type="text"
              className="form-input history-search-input"
              placeholder="Search by role or topic…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              id="history-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="history-clear-search"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          <div className="history-filter-tabs" role="tablist" aria-label="Filter sessions">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'all'}
              className={`history-filter-btn ${statusFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setStatusFilter('all')}
              id="filter-all-btn"
            >
              All ({metrics.total})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'completed'}
              className={`history-filter-btn ${statusFilter === 'completed' ? 'is-active' : ''}`}
              onClick={() => setStatusFilter('completed')}
              id="filter-completed-btn"
            >
              Completed ({metrics.completed})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'in_progress'}
              className={`history-filter-btn ${statusFilter === 'in_progress' ? 'is-active' : ''}`}
              onClick={() => setStatusFilter('in_progress')}
              id="filter-inprogress-btn"
            >
              In Progress ({metrics.inProgress})
            </button>
          </div>
        </div>
      )}

      {/* Sessions List / Empty State */}
      {filteredSessions.length === 0 ? (
        <EmptyState
          icon={searchTerm ? <SearchIcon size={20} /> : <HistoryIcon size={20} />}
          title={searchTerm ? 'No matching sessions' : 'No interview history yet'}
          description={
            searchTerm
              ? `No sessions matched "${searchTerm}". Try clearing the search filter.`
              : 'Your completed and in-progress interview sessions will appear here.'
          }
          action={
            searchTerm
              ? { label: 'Clear Search', onClick: () => setSearchTerm('') }
              : { label: 'Start RAG Interview', onClick: () => navigate('/rag') }
          }
          secondaryAction={
            !searchTerm
              ? { label: 'Configure AI Interview', onClick: () => navigate('/start') }
              : undefined
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="surface-card history-table-container">
            <table className="history-table" id="history-table">
              <thead>
                <tr>
                  <th>Role & Topic</th>
                  <th>Difficulty</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Avg. Score</th>
                  <th>Date</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((item) => {
                  const avg = getSessionAverageScore(item);
                  const pct =
                    item.total_questions > 0
                      ? Math.round((item.completed_questions / item.total_questions) * 100)
                      : 0;

                  return (
                    <tr
                      key={item.session_id}
                      className={`history-tr ${
                        selectedSessionId === item.session_id ? 'is-selected' : ''
                      }`}
                      onClick={() => handleOpenDetail(item.session_id)}
                      id={`session-row-${item.session_id}`}
                    >
                      <td>
                        <div className="td-title-stack">
                          <span className="td-role">{item.role}</span>
                          <span className="td-topic">{item.topic}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getDifficultyBadgeClass(item.difficulty)}`}>
                          {item.difficulty}
                        </span>
                      </td>
                      <td>
                        <div className="td-progress">
                          <div className="td-progress-track">
                            <div className="td-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="td-progress-text">
                            {item.completed_questions}/{item.total_questions}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.status === 'completed' ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {item.status === 'completed' ? 'Completed' : 'In Progress'}
                        </span>
                      </td>
                      <td>
                        {avg !== null ? (
                          <span className={`badge ${getRatingBadgeClass(getRatingFromScore(avg))}`}>
                            {avg}/100
                          </span>
                        ) : (
                          <span className="td-muted">—</span>
                        )}
                      </td>
                      <td className="td-date">{formatRelativeDate(item.created_at)}</td>
                      <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenDetail(item.session_id)}
                          id={`inspect-session-${item.session_id}`}
                        >
                          Details
                        </button>
                        {item.status === 'in_progress' ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate(`/practice/${item.session_id}`)}
                            id={`resume-session-${item.session_id}`}
                          >
                            Continue
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => navigate(`/results/${item.session_id}`)}
                          >
                            Summary
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (<= 860px) */}
          <div className="history-mobile-list">
            {filteredSessions.map((item) => {
              const avg = getSessionAverageScore(item);
              return (
                <div key={item.session_id} className="surface-card history-mobile-card">
                  <div className="mobile-card-top">
                    <div className="mobile-card-title-group">
                      <span className="td-role">{item.role}</span>
                      <span className="td-topic">{item.topic}</span>
                    </div>
                    <span
                      className={`badge ${
                        item.status === 'completed' ? 'badge-success' : 'badge-warning'
                      }`}
                    >
                      {item.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </div>

                  <div className="mobile-card-meta">
                    <span className={`badge ${getDifficultyBadgeClass(item.difficulty)}`}>
                      {item.difficulty}
                    </span>
                    <span className="badge badge-neutral">
                      {item.completed_questions}/{item.total_questions} answered
                    </span>
                    {avg !== null && (
                      <span className={`badge ${getRatingBadgeClass(getRatingFromScore(avg))}`}>
                        {avg}/100
                      </span>
                    )}
                    <span className="td-date">{formatRelativeDate(item.created_at)}</span>
                  </div>

                  <div className="mobile-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenDetail(item.session_id)}
                    >
                      Details
                    </button>
                    {item.status === 'in_progress' ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/practice/${item.session_id}`)}
                      >
                        <span>Continue</span>
                        <ArrowRightIcon size={13} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/results/${item.session_id}`)}
                      >
                        <AwardIcon size={13} />
                        <span>Summary</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Session Details Modal */}
      {selectedSessionId && (
        <div
          className="history-modal-backdrop animate-fade-in"
          onClick={handleCloseDetail}
          id="session-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Interview session details"
        >
          <div className="surface-card history-modal-card" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="modal-loading-box">
                <LoadingSpinner message="Loading session details…" size="md" />
              </div>
            ) : detailError ? (
              <div className="modal-error-box">
                <ErrorDisplay message={detailError} onRetry={handleRetryDetail} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCloseDetail}>
                  Close
                </button>
              </div>
            ) : detailSession ? (
              <>
                <div className="modal-header-bar">
                  <div className="modal-header-info">
                    <div className="modal-badges-top">
                      <span className="modal-id-pill">
                        ID: {detailSession.session_id.slice(0, 8)}
                      </span>
                      <span
                        className={`badge ${
                          detailSession.status === 'completed' ? 'badge-success' : 'badge-warning'
                        }`}
                      >
                        {detailSession.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                      <span className="modal-date-text">
                        {formatDateTime(detailSession.created_at)}
                      </span>
                    </div>
                    <h3 className="modal-title">
                      {detailSession.role} — {detailSession.topic}
                    </h3>
                    <div className="modal-sub-badges">
                      <span className={`badge ${getDifficultyBadgeClass(detailSession.difficulty)}`}>
                        {detailSession.difficulty}
                      </span>
                      <span className="badge badge-info">{detailSession.question_type}</span>
                      <span className="badge badge-neutral">{detailSession.experience_level}</span>
                      <span className="badge badge-neutral">
                        {detailSession.completed_questions}/{detailSession.total_questions} answered
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={handleCloseDetail}
                    aria-label="Close session details"
                    id="close-detail-modal-btn"
                  >
                    <XIcon size={17} />
                  </button>
                </div>

                <div className="modal-scroll-body">
                  {detailSession.questions.length === 0 ? (
                    <EmptyState
                      icon={<HistoryIcon size={18} />}
                      title="No questions generated yet"
                      description="Open this session in the practice room to generate the first question."
                    />
                  ) : (
                    <div className="modal-questions-list">
                      {detailSession.questions.map((q: SessionQuestionItem, idx: number) => (
                        <div
                          key={q.question_number}
                          className="modal-q-item"
                          id={`detail-q-${q.question_number}`}
                        >
                          <div className="modal-q-top">
                            <div className="modal-q-badges">
                              <span className="badge badge-neutral">Q{q.question_number}</span>
                              <span className={`badge ${getDifficultyBadgeClass(q.difficulty)}`}>
                                {q.difficulty}
                              </span>
                            </div>
                            {q.evaluation ? (
                              <span className={`badge ${getRatingBadgeClass(q.evaluation.rating)}`}>
                                {q.evaluation.overall_score}/100 · {q.evaluation.rating}
                              </span>
                            ) : (
                              <span className="badge badge-neutral">Pending</span>
                            )}
                          </div>

                          <p className="modal-q-prompt">{q.question}</p>

                          <div className="modal-q-answer">
                            <span className="modal-sub-label">Candidate Answer</span>
                            <p>
                              {q.candidate_answer || <em>No answer submitted yet.</em>}
                            </p>
                          </div>

                          {q.evaluation && (
                            <div className="modal-q-eval">
                              {q.evaluation.strengths?.length > 0 && (
                                <div className="modal-eval-col">
                                  <span className="modal-sub-label text-success">Strengths</span>
                                  <ul>
                                    {q.evaluation.strengths.map((s, sIdx) => (
                                      <li key={sIdx}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {q.evaluation.improvements?.length > 0 && (
                                <div className="modal-eval-col">
                                  <span className="modal-sub-label text-warning">Improvements</span>
                                  <ul>
                                    {q.evaluation.improvements.map((im, iIdx) => (
                                      <li key={iIdx}>{im}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {q.evaluation.sample_answer && (
                                <div className="modal-sample-box">
                                  <div className="modal-sample-header">
                                    <span className="modal-sub-label">Model Answer</span>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() =>
                                        handleCopySample(q.evaluation!.sample_answer, idx)
                                      }
                                    >
                                      {copiedAnswerIdx === idx ? (
                                        <CheckIcon size={12} />
                                      ) : (
                                        <CopyIcon size={12} />
                                      )}
                                      <span>{copiedAnswerIdx === idx ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  </div>
                                  <p>{q.evaluation.sample_answer}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-footer-bar">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseDetail}
                    id="modal-close-footer-btn"
                  >
                    Close
                  </button>

                  {detailSession.status === 'in_progress' ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate(`/practice/${detailSession.session_id}`)}
                      id="modal-continue-practice-btn"
                    >
                      <span>Resume Practice</span>
                      <ArrowRightIcon size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate(`/results/${detailSession.session_id}`)}
                    >
                      <AwardIcon size={14} />
                      <span>View Full Results</span>
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
