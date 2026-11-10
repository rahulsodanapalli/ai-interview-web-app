import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendHealth, getOllamaHealth, getDatabaseHealth } from '../../api/healthService';
import { listSessions } from '../../api/sessionService';
import { formatApiError, isRequestAborted } from '../../utils/error';
import { formatRelativeDate, getRatingFromScore } from '../../utils/format';
import type { SessionDetailResponse } from '../../types';
import { SkeletonListRows, SkeletonStatsRow } from '../../components/ui/Skeleton';
import ErrorDisplay from '../../components/ui/ErrorDisplay';
import EmptyState from '../../components/ui/EmptyState';
import {
  SparklesIcon,
  FileTextIcon,
  GitBranchIcon,
  ArrowRightIcon,
  RefreshIcon,
  ServerIcon,
  CpuIcon,
  DatabaseIcon,
  HistoryIcon,
} from '../../components/ui/Icons';
import './Dashboard.css';

interface ServiceStatus {
  key: 'api' | 'ollama' | 'db';
  name: string;
  status: 'ok' | 'warning' | 'error' | 'loading';
  detail: string;
}

const INITIAL_SERVICES: ServiceStatus[] = [
  { key: 'api', name: 'Backend API', status: 'loading', detail: 'Checking…' },
  { key: 'ollama', name: 'Ollama LLM', status: 'loading', detail: 'Checking…' },
  { key: 'db', name: 'PostgreSQL', status: 'loading', detail: 'Checking…' },
];

export default function Dashboard() {
  const navigate = useNavigate();

  const [services, setServices] = useState<ServiceStatus[]>(INITIAL_SERVICES);
  const [sessions, setSessions] = useState<SessionDetailResponse[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');

  const [healthTick, setHealthTick] = useState(0);
  const [sessionsTick, setSessionsTick] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function fetchHealth() {
      const [apiRes, ollamaRes, dbRes] = await Promise.allSettled([
        getBackendHealth({ signal: controller.signal }),
        getOllamaHealth({ signal: controller.signal }),
        getDatabaseHealth({ signal: controller.signal }),
      ]);

      if (!active || controller.signal.aborted) return;

      setServices([
        apiRes.status === 'fulfilled'
          ? {
              key: 'api',
              name: 'Backend API',
              status: 'ok',
              detail: `${apiRes.value.app_name} (${apiRes.value.environment})`,
            }
          : {
              key: 'api',
              name: 'Backend API',
              status: 'error',
              detail: 'Unreachable',
            },
        ollamaRes.status === 'fulfilled'
          ? {
              key: 'ollama',
              name: 'Ollama LLM',
              status: ollamaRes.value.model_available ? 'ok' : 'warning',
              detail: ollamaRes.value.model_available
                ? `${ollamaRes.value.configured_model} ready`
                : `${ollamaRes.value.configured_model} not installed`,
            }
          : {
              key: 'ollama',
              name: 'Ollama LLM',
              status: 'error',
              detail: 'Unavailable',
            },
        dbRes.status === 'fulfilled'
          ? {
              key: 'db',
              name: 'PostgreSQL',
              status: dbRes.value.database_connected ? 'ok' : 'warning',
              detail: dbRes.value.database_connected
                ? `${dbRes.value.database} connected`
                : 'Disconnected',
            }
          : {
              key: 'db',
              name: 'PostgreSQL',
              status: 'error',
              detail: 'Unavailable',
            },
      ]);
    }

    void fetchHealth();

    return () => {
      active = false;
      controller.abort();
    };
  }, [healthTick]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function fetchSessions() {
      try {
        const data = await listSessions(50, 0, { signal: controller.signal });
        if (active && !controller.signal.aborted) {
          setSessions(data);
          setSessionsError('');
          setSessionsLoading(false);
        }
      } catch (err) {
        if (active && !controller.signal.aborted && !isRequestAborted(err)) {
          setSessionsError(formatApiError(err, 'Failed to load interview sessions.'));
          setSessionsLoading(false);
        }
      }
    }

    void fetchSessions();

    return () => {
      active = false;
      controller.abort();
    };
  }, [sessionsTick]);

  function handleRefreshHealth() {
    setServices(INITIAL_SERVICES);
    setHealthTick((t) => t + 1);
  }

  function handleRetrySessions() {
    setSessionsLoading(true);
    setSessionsError('');
    setSessionsTick((t) => t + 1);
  }

  // Compute statistics strictly from actual backend sessions
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const inProgressSessions = sessions.filter((s) => s.status === 'in_progress');
  const totalQuestionsPracticed = sessions.reduce((acc, s) => acc + s.completed_questions, 0);

  let evaluatedCount = 0;
  let scoreSum = 0;
  for (const s of sessions) {
    for (const q of s.questions) {
      if (q.evaluation) {
        evaluatedCount++;
        scoreSum += q.evaluation.overall_score;
      }
    }
  }
  const averageScore = evaluatedCount > 0 ? Math.round(scoreSum / evaluatedCount) : null;

  const recentSessions = sessions.slice(0, 5);

  return (
    <div className="page-container animate-fade-in" id="dashboard-page">
      {/* Welcome & Primary Workflows */}
      <section className="surface-card dashboard-welcome">
        <div className="welcome-copy">
          <span className="welcome-eyebrow">Technical Interview Workspace</span>
          <h2 className="welcome-title">
            Prepare for technical interviews with your own code and documents
          </h2>
          <p className="welcome-subtitle">
            Generate grounded interview questions from PDF resumes or GitHub repositories via RAG,
            practice role-specific interviews, and review rubric-based AI evaluations.
          </p>
        </div>

        <div className="welcome-cta-grid">
          <button
            type="button"
            className="cta-action-card is-primary"
            onClick={() => navigate('/rag')}
            id="hero-rag-btn"
          >
            <div className="cta-card-top">
              <span className="cta-icon-box">
                <FileTextIcon size={18} />
              </span>
              <ArrowRightIcon size={16} className="cta-arrow" />
            </div>
            <div className="cta-card-body">
              <span className="cta-card-title">Prepare with Documents</span>
              <span className="cta-card-desc">
                Upload a PDF or enter a GitHub repo / URL for grounded questions
              </span>
            </div>
          </button>

          <button
            type="button"
            className="cta-action-card"
            onClick={() => navigate('/start')}
            id="hero-start-btn"
          >
            <div className="cta-card-top">
              <span className="cta-icon-box">
                <SparklesIcon size={18} />
              </span>
              <ArrowRightIcon size={16} className="cta-arrow" />
            </div>
            <div className="cta-card-body">
              <span className="cta-card-title">Start New Interview</span>
              <span className="cta-card-desc">
                Configure role, topic, experience level, and question style
              </span>
            </div>
          </button>

          <button
            type="button"
            className="cta-action-card"
            onClick={() => navigate('/github')}
            id="hero-github-btn"
          >
            <div className="cta-card-top">
              <span className="cta-icon-box">
                <GitBranchIcon size={18} />
              </span>
              <ArrowRightIcon size={16} className="cta-arrow" />
            </div>
            <div className="cta-card-body">
              <span className="cta-card-title">GitHub Repository Analysis</span>
              <span className="cta-card-desc">
                Explore repository files, README, and code-grounded questions
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Real Data Statistics — Shown only when real session data exists */}
      {sessionsLoading ? (
        <section aria-label="Loading interview statistics">
          <SkeletonStatsRow count={4} />
        </section>
      ) : (
        sessions.length > 0 && (
          <section className="dashboard-stats-grid" id="dashboard-stats" aria-label="Interview statistics">
            <div className="surface-card stat-tile">
              <span className="stat-tile-label">Total Sessions</span>
              <span className="stat-tile-value">{sessions.length}</span>
              <span className="stat-tile-meta">{inProgressSessions.length} in progress</span>
            </div>

            <div className="surface-card stat-tile">
              <span className="stat-tile-label">Completed</span>
              <span className="stat-tile-value">{completedSessions.length}</span>
              <span className="stat-tile-meta">
                {Math.round((completedSessions.length / sessions.length) * 100)}% completion rate
              </span>
            </div>

            <div className="surface-card stat-tile">
              <span className="stat-tile-label">Questions Answered</span>
              <span className="stat-tile-value">{totalQuestionsPracticed}</span>
              <span className="stat-tile-meta">{evaluatedCount} evaluated by AI</span>
            </div>

            <div className="surface-card stat-tile">
              <span className="stat-tile-label">Average Score</span>
              <span className="stat-tile-value">
                {averageScore !== null ? `${averageScore}/100` : '—'}
              </span>
              <span className="stat-tile-meta">
                {averageScore !== null ? getRatingFromScore(averageScore) : 'No evaluations yet'}
              </span>
            </div>
          </section>
        )
      )}

      {/* Recent Interview Sessions */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <div>
            <h3 className="section-heading">Recent Interview Sessions</h3>
            <p className="section-subheading">Resume an active practice or inspect past evaluations.</p>
          </div>
          {sessions.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/history')}
              id="view-all-sessions-btn"
            >
              <span>View all</span>
              <ArrowRightIcon size={14} />
            </button>
          )}
        </div>

        {sessionsLoading ? (
          <SkeletonListRows count={3} />
        ) : sessionsError ? (
          <ErrorDisplay
            title="Could not load interview sessions"
            message={sessionsError}
            onRetry={handleRetrySessions}
          />
        ) : recentSessions.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon size={20} />}
            title="No interview sessions yet"
            description="Start a role-based AI interview or upload a PDF or GitHub repository to generate grounded questions."
            action={{
              label: 'Prepare with Documents',
              onClick: () => navigate('/rag'),
            }}
            secondaryAction={{
              label: 'Start New Interview',
              onClick: () => navigate('/start'),
            }}
          />
        ) : (
          <div className="recent-sessions-list" id="recent-sessions-list">
            {recentSessions.map((session) => {
              const progressPct =
                session.total_questions > 0
                  ? Math.round((session.completed_questions / session.total_questions) * 100)
                  : 0;

              return (
                <div
                  key={session.session_id}
                  className="surface-card surface-card-interactive session-item-row"
                  onClick={() =>
                    navigate(
                      session.status === 'completed'
                        ? `/results/${session.session_id}`
                        : `/practice/${session.session_id}`
                    )
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(
                        session.status === 'completed'
                          ? `/results/${session.session_id}`
                          : `/practice/${session.session_id}`
                      );
                    }
                  }}
                >
                  <div className="session-item-main">
                    <div className="session-item-title-row">
                      <span className="session-item-role">{session.role}</span>
                      <span
                        className={`badge ${
                          session.status === 'completed' ? 'badge-success' : 'badge-warning'
                        }`}
                      >
                        {session.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                    <span className="session-item-meta">
                      {session.topic} · {session.difficulty} · {formatRelativeDate(session.created_at)}
                    </span>
                  </div>

                  <div className="session-item-right">
                    <div className="session-progress-block">
                      <div className="session-progress-track">
                        <div className="session-progress-fill" style={{ width: `${progressPct}%` }} />
                      </div>
                      <span className="session-progress-count">
                        {session.completed_questions}/{session.total_questions}
                      </span>
                    </div>

                    <ArrowRightIcon size={15} className="session-row-chevron" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* System Health Strip */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <div>
            <h3 className="section-heading">System Health</h3>
            <p className="section-subheading">Live status of backend, local LLM, and database services.</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleRefreshHealth}
            id="refresh-health-btn"
          >
            <RefreshIcon size={13} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="health-strip-grid" id="health-status-grid">
          {services.map((svc) => (
            <div key={svc.key} className="surface-card health-tile">
              <div className="health-tile-left">
                <div className="health-tile-icon" aria-hidden="true">
                  {svc.key === 'api' ? (
                    <ServerIcon size={16} />
                  ) : svc.key === 'ollama' ? (
                    <CpuIcon size={16} />
                  ) : (
                    <DatabaseIcon size={16} />
                  )}
                </div>
                <div className="health-tile-text">
                  <span className="health-tile-name">{svc.name}</span>
                  <span className="health-tile-detail">{svc.detail}</span>
                </div>
              </div>

              <span
                className={`badge ${
                  svc.status === 'ok'
                    ? 'badge-success'
                    : svc.status === 'warning'
                    ? 'badge-warning'
                    : svc.status === 'error'
                    ? 'badge-error'
                    : 'badge-neutral'
                }`}
              >
                {svc.status === 'loading'
                  ? 'Checking'
                  : svc.status === 'ok'
                  ? 'Healthy'
                  : svc.status === 'warning'
                  ? 'Degraded'
                  : 'Offline'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
