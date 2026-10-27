import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listSessions, getSession } from '../../api/sessionService';
import type { SessionDetailResponse, SessionQuestionItem } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorDisplay from '../../components/ui/ErrorDisplay';
import EmptyState from '../../components/ui/EmptyState';
import './InterviewHistory.css';

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

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function InterviewHistory() {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams<{ sessionId?: string }>();

  // List view state
  const [sessions, setSessions] = useState<SessionDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  // Selected session for detailed breakdown view
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(routeSessionId || null);
  const [detailSession, setDetailSession] = useState<SessionDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [copiedAnswerIdx, setCopiedAnswerIdx] = useState<number | null>(null);

  // Sync route param with selected session
  useEffect(() => {
    if (routeSessionId) {
      setSelectedSessionId(routeSessionId);
    }
  }, [routeSessionId]);

  // Load all sessions
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await listSessions(15, 0);
      setSessions(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve interview session history.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Load detailed session data when a session is selected
  const loadSessionDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError('');

    try {
      const data = await getSession(id);
      setDetailSession(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load session details.';
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionDetail(selectedSessionId);
    } else {
      setDetailSession(null);
    }
  }, [selectedSessionId, loadSessionDetail]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.topic.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sessions, searchTerm, statusFilter]);

  // Global metrics summary
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

    const averageScore = evaluatedCount > 0 ? Math.round(scoreSum / evaluatedCount) : 0;

    return { total, completed, inProgress, evaluatedCount, averageScore };
  }, [sessions]);

  // Calculate average score for a single session
  function getSessionAverageScore(sessionItem: SessionDetailResponse): number | null {
    const evaluated = sessionItem.questions.filter((q) => q.evaluation !== null);
    if (evaluated.length === 0) return null;
    const sum = evaluated.reduce((acc, q) => acc + (q.evaluation?.overall_score ?? 0), 0);
    return Math.round(sum / evaluated.length);
  }

  function handleOpenDetail(id: string) {
    setSelectedSessionId(id);
  }

  function handleCloseDetail() {
    setSelectedSessionId(null);
    setDetailSession(null);
    if (routeSessionId) {
      navigate('/history');
    }
  }

  function handleCopySample(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedAnswerIdx(idx);
    setTimeout(() => setCopiedAnswerIdx(null), 2000);
  }

  if (loading) {
    return <LoadingSpinner message="Loading interview session history…" />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadHistory} />;
  }

  return (
    <div className="history-page animate-fade-in" id="history-page">
      {/* Page Header */}
      <div className="history-header">
        <h2 className="history-title">
          Interview <span className="gradient-text">History & Archives</span>
        </h2>
        <p className="history-subtitle">
          Track all your interview sessions, inspect AI evaluation scores, review answers, and resume in-progress interviews.
        </p>
      </div>

      {/* Metrics Banner */}
      <div className="history-metrics-grid">
        <div className="metric-card glass-card">
          <span className="metric-icon">📋</span>
          <div className="metric-content">
            <span className="metric-value" id="metric-total-sessions">{metrics.total}</span>
            <span className="metric-label">Total Sessions</span>
          </div>
        </div>

        <div className="metric-card glass-card">
          <span className="metric-icon">✅</span>
          <div className="metric-content">
            <span className="metric-value" id="metric-completed-sessions">{metrics.completed}</span>
            <span className="metric-label">Completed Sessions</span>
          </div>
        </div>

        <div className="metric-card glass-card">
          <span className="metric-icon">⏳</span>
          <div className="metric-content">
            <span className="metric-value" id="metric-inprogress-sessions">{metrics.inProgress}</span>
            <span className="metric-label">In Progress</span>
          </div>
        </div>

        <div className="metric-card glass-card">
          <span className="metric-icon">⭐</span>
          <div className="metric-content">
            <span className="metric-value" id="metric-average-score">
              {metrics.averageScore > 0 ? `${metrics.averageScore}` : '—'}
            </span>
            <span className="metric-label">Avg. Evaluated Score</span>
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="history-controls-bar glass-card">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by role or topic…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            id="history-search-input"
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-tabs">
          <button
            type="button"
            className={`filter-tab ${statusFilter === 'all' ? 'filter-tab-active' : ''}`}
            onClick={() => setStatusFilter('all')}
            id="filter-all-btn"
          >
            All ({metrics.total})
          </button>
          <button
            type="button"
            className={`filter-tab ${statusFilter === 'completed' ? 'filter-tab-active' : ''}`}
            onClick={() => setStatusFilter('completed')}
            id="filter-completed-btn"
          >
            Completed ({metrics.completed})
          </button>
          <button
            type="button"
            className={`filter-tab ${statusFilter === 'in_progress' ? 'filter-tab-active' : ''}`}
            onClick={() => setStatusFilter('in_progress')}
            id="filter-inprogress-btn"
          >
            In Progress ({metrics.inProgress})
          </button>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm refresh-btn"
          onClick={loadHistory}
          id="refresh-history-btn"
          title="Refresh Sessions"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Sessions Content */}
      {filteredSessions.length === 0 ? (
        <EmptyState
          icon={searchTerm ? '🔍' : '📋'}
          title={searchTerm ? 'No matching sessions found' : 'No Interview History Yet'}
          description={
            searchTerm
              ? `No sessions matched "${searchTerm}". Try adjusting your search query.`
              : 'Your past interview practice sessions and questions will appear here.'
          }
          action={{
            label: 'Start New Interview',
            onClick: () => navigate('/start'),
          }}
        />
      ) : (
        <div className="history-table-wrapper glass-card">
          <table className="history-table" id="history-table">
            <thead>
              <tr>
                <th>Job Role</th>
                <th>Topic & Domain</th>
                <th>Difficulty</th>
                <th>Experience</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Avg. Score</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((sessionItem) => {
                const avgScore = getSessionAverageScore(sessionItem);
                const isSelected = selectedSessionId === sessionItem.session_id;

                return (
                  <tr
                    key={sessionItem.session_id}
                    className={`history-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => handleOpenDetail(sessionItem.session_id)}
                    id={`session-row-${sessionItem.session_id}`}
                  >
                    <td className="cell-role">
                      <strong>{sessionItem.role}</strong>
                    </td>
                    <td>
                      <span className="topic-text">📌 {sessionItem.topic}</span>
                    </td>
                    <td>
                      <span className={`badge badge-diff badge-diff-${sessionItem.difficulty.toLowerCase()}`}>
                        {sessionItem.difficulty}
                      </span>
                    </td>
                    <td>
                      <span className="level-text">{sessionItem.experience_level}</span>
                    </td>
                    <td>
                      <div className="cell-progress">
                        <div className="mini-bar">
                          <div
                            className="mini-fill"
                            style={{
                              width: `${sessionItem.total_questions > 0 ? (sessionItem.completed_questions / sessionItem.total_questions) * 100 : 0}%`,
                            }}
                          ></div>
                        </div>
                        <span className="progress-count">
                          {sessionItem.completed_questions}/{sessionItem.total_questions}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${sessionItem.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {sessionItem.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td>
                      {avgScore !== null ? (
                        <span
                          className="score-pill"
                          style={{
                            borderColor: ratingColor(
                              avgScore >= 80 ? 'Excellent' : avgScore >= 60 ? 'Good' : avgScore >= 40 ? 'Fair' : 'Needs Improvement'
                            ),
                            color: ratingColor(
                              avgScore >= 80 ? 'Excellent' : avgScore >= 60 ? 'Good' : avgScore >= 40 ? 'Fair' : 'Needs Improvement'
                            ),
                          }}
                        >
                          {avgScore}
                        </span>
                      ) : (
                        <span className="score-pending">—</span>
                      )}
                    </td>
                    <td className="cell-date">{formatDate(sessionItem.created_at)}</td>
                    <td className="cell-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenDetail(sessionItem.session_id)}
                        id={`inspect-session-${sessionItem.session_id}`}
                      >
                        Inspect Details
                      </button>

                      {sessionItem.status === 'in_progress' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/practice/${sessionItem.session_id}`)}
                          id={`resume-session-${sessionItem.session_id}`}
                        >
                          Continue →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Session Details Modal / Slide-Over */}
      {selectedSessionId && (
        <div className="detail-modal-backdrop animate-fade-in" onClick={handleCloseDetail} id="session-detail-modal">
          <div className="detail-modal-card glass-card" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="detail-loading-box">
                <LoadingSpinner message="Loading full session details, answers, and evaluations…" size="lg" />
              </div>
            ) : detailError ? (
              <div className="detail-error-box">
                <ErrorDisplay message={detailError} onRetry={() => loadSessionDetail(selectedSessionId)} />
                <button type="button" className="btn btn-secondary" onClick={handleCloseDetail}>
                  Close
                </button>
              </div>
            ) : detailSession ? (
              <div className="detail-content animate-fade-in">
                {/* Modal Header */}
                <div className="detail-header">
                  <div className="detail-title-col">
                    <div className="detail-meta-top">
                      <span className="session-id-pill" title="Session UUID">
                        ID: {detailSession.session_id.slice(0, 8)}…
                      </span>
                      <span className={`badge ${detailSession.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {detailSession.status === 'completed' ? 'Completed Session' : 'In Progress'}
                      </span>
                      <span className="detail-timestamp">
                        Created {formatDate(detailSession.created_at)}
                      </span>
                    </div>
                    <h3 className="detail-role-title">
                      {detailSession.role} <span className="detail-topic-highlight">({detailSession.topic})</span>
                    </h3>
                    <div className="detail-badges-row">
                      <span className={`badge badge-diff badge-diff-${detailSession.difficulty.toLowerCase()}`}>
                        {detailSession.difficulty}
                      </span>
                      <span className="badge badge-info">{detailSession.question_type}</span>
                      <span className="badge badge-neutral">{detailSession.experience_level}</span>
                      <span className="badge badge-primary">
                        {detailSession.completed_questions} of {detailSession.total_questions} Questions Answered
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={handleCloseDetail}
                    aria-label="Close session details"
                    id="close-detail-modal-btn"
                  >
                    ✕
                  </button>
                </div>

                {/* Performance Summary Banner */}
                {detailSession.questions.some((q) => q.evaluation !== null) && (
                  <div className="detail-performance-card glass-card">
                    {(() => {
                      const avg = getSessionAverageScore(detailSession) ?? 0;
                      const rating = avg >= 80 ? 'Excellent' : avg >= 60 ? 'Good' : avg >= 40 ? 'Fair' : 'Needs Improvement';
                      return (
                        <>
                          <div className="perf-score-ring" style={{ borderColor: ratingColor(rating) }}>
                            <span className="perf-score-val">{avg}</span>
                            <span className="perf-score-sub">Avg</span>
                          </div>
                          <div className="perf-text-col">
                            <div className="perf-rating-row">
                              <span className="perf-label">Session Performance:</span>
                              <span
                                className="perf-rating-pill"
                                style={{ color: ratingColor(rating), borderColor: ratingColor(rating) }}
                              >
                                {rating}
                              </span>
                            </div>
                            <p className="perf-desc">
                              Cumulative score across all evaluated technical responses in this practice session.
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Questions Breakdown List */}
                <div className="detail-questions-section">
                  <h4 className="detail-section-heading">
                    <span>Questions, Responses & AI Rubric Evaluations</span>
                    <span className="questions-count-tag">
                      {detailSession.questions.length} Question{detailSession.questions.length === 1 ? '' : 's'} Generated
                    </span>
                  </h4>

                  {detailSession.questions.length === 0 ? (
                    <div className="detail-empty-questions glass-card">
                      <p>No questions have been generated in this session yet.</p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/practice/${detailSession.session_id}`)}
                      >
                        Generate First Question
                      </button>
                    </div>
                  ) : (
                    <div className="detail-questions-list">
                      {detailSession.questions.map((q: SessionQuestionItem, idx: number) => {
                        return (
                          <div key={q.question_number} className="detail-q-card glass-card" id={`detail-q-${q.question_number}`}>
                            {/* Question Header */}
                            <div className="detail-q-header">
                              <div className="detail-q-number-box">
                                <span className="detail-q-num">Q{q.question_number}</span>
                              </div>
                              <div className="detail-q-header-content">
                                <div className="detail-q-badges">
                                  <span className={`badge badge-diff badge-diff-${q.difficulty.toLowerCase()}`}>
                                    {q.difficulty}
                                  </span>
                                  <span className="badge badge-neutral">📌 {q.topic}</span>
                                  {q.evaluation ? (
                                    <span
                                      className="score-badge-inline"
                                      style={{
                                        borderColor: ratingColor(q.evaluation.rating),
                                        color: ratingColor(q.evaluation.rating),
                                      }}
                                    >
                                      Score: {q.evaluation.overall_score}/100 ({q.evaluation.rating})
                                    </span>
                                  ) : q.candidate_answer ? (
                                    <span className="badge badge-warning">Answered · Pending Evaluation</span>
                                  ) : (
                                    <span className="badge badge-neutral">Awaiting Candidate Response</span>
                                  )}
                                </div>
                                <h5 className="detail-q-title">{q.question}</h5>
                              </div>
                            </div>

                            {/* Follow up probe */}
                            {q.follow_up_question && (
                              <div className="detail-q-followup">
                                <span className="followup-tag">💡 Follow-up Probe:</span>
                                <span className="followup-content">{q.follow_up_question}</span>
                              </div>
                            )}

                            {/* Candidate Submitted Answer */}
                            <div className="detail-answer-box">
                              <span className="detail-sub-label">📝 Candidate Response:</span>
                              {q.candidate_answer ? (
                                <p className="detail-answer-text">{q.candidate_answer}</p>
                              ) : (
                                <p className="detail-unanswered-text">
                                  <em>No answer submitted yet for this question.</em>
                                </p>
                              )}
                            </div>

                            {/* Evaluation Breakdown if present */}
                            {q.evaluation && (
                              <div className="detail-eval-breakdown">
                                <div className="eval-breakdown-grid">
                                  {/* Correct Points */}
                                  {q.evaluation.correct_points && q.evaluation.correct_points.length > 0 && (
                                    <div className="eval-breakdown-card eval-correct-box">
                                      <h6>✅ Correct Technical Points</h6>
                                      <ul>
                                        {q.evaluation.correct_points.map((pt, pIdx) => (
                                          <li key={pIdx}>{pt}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Missing Points */}
                                  {q.evaluation.missing_points && q.evaluation.missing_points.length > 0 && (
                                    <div className="eval-breakdown-card eval-missing-box">
                                      <h6>⚠️ Missing Criteria</h6>
                                      <ul>
                                        {q.evaluation.missing_points.map((pt, pIdx) => (
                                          <li key={pIdx}>{pt}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Strengths */}
                                  {q.evaluation.strengths && q.evaluation.strengths.length > 0 && (
                                    <div className="eval-breakdown-card eval-strengths-box">
                                      <h6>💪 Notable Strengths</h6>
                                      <ul>
                                        {q.evaluation.strengths.map((pt, pIdx) => (
                                          <li key={pIdx}>{pt}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Improvements */}
                                  {q.evaluation.improvements && q.evaluation.improvements.length > 0 && (
                                    <div className="eval-breakdown-card eval-improvements-box">
                                      <h6>📈 Recommended Improvements</h6>
                                      <ul>
                                        {q.evaluation.improvements.map((pt, pIdx) => (
                                          <li key={pIdx}>{pt}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {/* Sample / Model Answer */}
                                {q.evaluation.sample_answer && (
                                  <div className="detail-sample-answer-card">
                                    <div className="sample-header">
                                      <span className="sample-label">💡 Model / Benchmark Answer</span>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm copy-btn"
                                        onClick={() => handleCopySample(q.evaluation!.sample_answer, idx)}
                                      >
                                        {copiedAnswerIdx === idx ? '✓ Copied!' : '📋 Copy'}
                                      </button>
                                    </div>
                                    <p className="sample-text">{q.evaluation.sample_answer}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="detail-modal-footer">
                  {detailSession.status === 'in_progress' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      onClick={() => navigate(`/practice/${detailSession.session_id}`)}
                      id="modal-continue-practice-btn"
                    >
                      🚀 Open Interactive Practice Room →
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseDetail}
                    id="modal-close-footer-btn"
                  >
                    Close Inspection
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
