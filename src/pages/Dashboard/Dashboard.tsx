import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendHealth, getOllamaHealth, getDatabaseHealth } from '../../api/healthService';
import { listSessions } from '../../api/sessionService';
import type { HealthCheckResponse, OllamaHealthResponse, DatabaseHealthResponse, SessionDetailResponse } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorDisplay from '../../components/ui/ErrorDisplay';
import './Dashboard.css';

interface ServiceStatus {
  name: string;
  icon: string;
  status: 'ok' | 'warning' | 'error' | 'loading';
  detail: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Backend API', icon: '🖥️', status: 'loading', detail: 'Checking…' },
    { name: 'Ollama LLM', icon: '🤖', status: 'loading', detail: 'Checking…' },
    { name: 'Database', icon: '🗄️', status: 'loading', detail: 'Checking…' },
  ]);
  const [sessions, setSessions] = useState<SessionDetailResponse[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');

  // Load health statuses
  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      // Backend health
      try {
        const data: HealthCheckResponse = await getBackendHealth();
        if (mounted) {
          setServices((prev) =>
            prev.map((s) =>
              s.name === 'Backend API'
                ? { ...s, status: 'ok', detail: `${data.app_name} (${data.environment})` }
                : s
            )
          );
        }
      } catch {
        if (mounted) {
          setServices((prev) =>
            prev.map((s) =>
              s.name === 'Backend API'
                ? { ...s, status: 'error', detail: 'Unreachable' }
                : s
            )
          );
        }
      }

      // Ollama health
      try {
        const data: OllamaHealthResponse = await getOllamaHealth();
        if (mounted) {
          setServices((prev) =>
            prev.map((s) =>
              s.name === 'Ollama LLM'
                ? {
                    ...s,
                    status: data.model_available ? 'ok' : 'warning',
                    detail: data.model_available
                      ? `${data.configured_model} ready`
                      : `Model ${data.configured_model} not installed`,
                  }
                : s
            )
          );
        }
      } catch {
        if (mounted) {
          setServices((prev) =>
            prev.map((s) =>
              s.name === 'Ollama LLM'
                ? { ...s, status: 'error', detail: 'Service unavailable' }
                : s
            )
          );
        }
      }

      // Database health
      try {
        const data: DatabaseHealthResponse = await getDatabaseHealth();
        if (mounted) {
          setServices((prev) =>
            prev.map((s) =>
              s.name === 'Database'
                ? {
                    ...s,
                    status: data.database_connected ? 'ok' : 'warning',
                    detail: data.database_connected
                      ? `${data.database} connected`
                      : 'Not connected',
                  }
                : s
            )
          );
        }
      } catch {
        if (mounted) {
          setServices((prev) =>
            prev.map((s) =>
              s.name === 'Database'
                ? { ...s, status: 'error', detail: 'Unavailable' }
                : s
            )
          );
        }
      }
    }

    loadHealth();
    return () => { mounted = false; };
  }, []);

  // Load recent sessions
  useEffect(() => {
    let mounted = true;

    async function loadSessions() {
      try {
        const data = await listSessions(5, 0);
        if (mounted) {
          setSessions(data);
          setSessionsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setSessionsError(
            err instanceof Error ? err.message : 'Failed to load sessions'
          );
          setSessionsLoading(false);
        }
      }
    }

    loadSessions();
    return () => { mounted = false; };
  }, []);

  // Computed stats
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const inProgressSessions = sessions.filter((s) => s.status === 'in_progress');
  const totalQuestionsPracticed = sessions.reduce((acc, s) => acc + s.completed_questions, 0);

  const statCards = [
    { label: 'Total Sessions', value: sessions.length, icon: '📋', color: 'var(--color-primary-500)' },
    { label: 'Completed', value: completedSessions.length, icon: '✅', color: 'var(--color-success)' },
    { label: 'In Progress', value: inProgressSessions.length, icon: '⏳', color: 'var(--color-warning)' },
    { label: 'Questions Practiced', value: totalQuestionsPracticed, icon: '💡', color: 'var(--color-info)' },
  ];

  return (
    <div className="dashboard animate-fade-in" id="dashboard-page">
      {/* Welcome hero */}
      <section className="dashboard-hero glass-card">
        <div className="hero-content">
          <h2 className="hero-title">
            Welcome to <span className="gradient-text">AI Interview Prep</span>
          </h2>
          <p className="hero-subtitle">
            Practice with AI-generated interview questions, get instant evaluation,
            and track your improvement over time.
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/start')}
            id="hero-start-btn"
          >
            🚀 Start New Interview
          </button>
        </div>
        <div className="hero-visual">
          <div className="hero-glow"></div>
        </div>
      </section>

      {/* Stats row */}
      <section className="stats-grid" id="dashboard-stats">
        {statCards.map((card) => (
          <div className="stat-card glass-card" key={card.label}>
            <div className="stat-icon" style={{ background: `${card.color}20` }}>
              <span>{card.icon}</span>
            </div>
            <div className="stat-info">
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Service Health Status */}
      <section className="dashboard-section">
        <h3 className="section-title">System Health</h3>
        <div className="health-grid" id="health-status-grid">
          {services.map((svc) => (
            <div className={`health-card glass-card ${svc.status}`} key={svc.name}>
              <div className="health-icon">{svc.icon}</div>
              <div className="health-info">
                <span className="health-name">{svc.name}</span>
                <span className="health-detail">{svc.detail}</span>
              </div>
              <div className={`health-badge badge badge-${svc.status === 'ok' ? 'success' : svc.status === 'warning' ? 'warning' : svc.status === 'error' ? 'error' : 'neutral'}`}>
                {svc.status === 'loading' ? '…' : svc.status.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Sessions */}
      <section className="dashboard-section">
        <div className="section-header">
          <h3 className="section-title">Recent Sessions</h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/history')}
            id="view-all-sessions-btn"
          >
            View All →
          </button>
        </div>

        {sessionsLoading ? (
          <LoadingSpinner message="Loading sessions…" size="sm" />
        ) : sessionsError ? (
          <ErrorDisplay message={sessionsError} />
        ) : sessions.length === 0 ? (
          <div className="no-sessions glass-card">
            <p>No interview sessions yet. Start your first practice!</p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/start')}
              id="no-sessions-start-btn"
            >
              Start Interview
            </button>
          </div>
        ) : (
          <div className="sessions-list" id="recent-sessions-list">
            {sessions.map((session) => (
              <div
                className="session-row glass-card"
                key={session.session_id}
                onClick={() => navigate(`/practice/${session.session_id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/practice/${session.session_id}`);
                }}
              >
                <div className="session-info">
                  <span className="session-role">{session.role}</span>
                  <span className="session-meta">
                    {session.topic} · {session.difficulty} · {session.experience_level}
                  </span>
                </div>
                <div className="session-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${session.total_questions > 0 ? (session.completed_questions / session.total_questions) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                  <span className="progress-text">
                    {session.completed_questions}/{session.total_questions}
                  </span>
                </div>
                <span className={`badge ${session.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                  {session.status === 'completed' ? 'Completed' : 'In Progress'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
