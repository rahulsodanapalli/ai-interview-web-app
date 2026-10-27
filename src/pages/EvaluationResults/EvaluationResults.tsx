import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSessions } from '../../api/sessionService';
import type { SessionDetailResponse } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorDisplay from '../../components/ui/ErrorDisplay';
import EmptyState from '../../components/ui/EmptyState';
import './EvaluationResults.css';

export default function EvaluationResults() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionDetailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await listSessions(50, 0);
        if (mounted) {
          // Only show sessions that have at least one evaluated question
          setSessions(data.filter((s) => s.questions.some((q) => q.evaluation !== null)));
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load results');
          setLoading(false);
        }
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <LoadingSpinner message="Loading evaluation results…" />;
  if (error) return <ErrorDisplay message={error} />;
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="📈"
        title="No Evaluation Results Yet"
        description="Complete interview questions to see your evaluation scores and feedback."
        action={{ label: 'Start Interview', onClick: () => navigate('/start') }}
      />
    );
  }

  function ratingColor(rating: string): string {
    switch (rating) {
      case 'Excellent': return 'var(--color-success)';
      case 'Good': return 'var(--color-info)';
      case 'Fair': return 'var(--color-warning)';
      default: return 'var(--color-error)';
    }
  }

  return (
    <div className="results-page animate-fade-in" id="results-page">
      <div className="results-header">
        <h2 className="results-title">
          <span className="gradient-text">Evaluation Results</span>
        </h2>
        <p className="results-subtitle">
          Review your scores and AI feedback across all practice sessions.
        </p>
      </div>

      <div className="results-list" id="results-list">
        {sessions.map((session) => {
          const evaluatedQuestions = session.questions.filter((q) => q.evaluation);
          const avgScore =
            evaluatedQuestions.length > 0
              ? Math.round(
                  evaluatedQuestions.reduce(
                    (sum, q) => sum + (q.evaluation?.overall_score ?? 0),
                    0
                  ) / evaluatedQuestions.length
                )
              : 0;

          return (
            <div
              className="result-card glass-card"
              key={session.session_id}
              onClick={() => navigate(`/practice/${session.session_id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/practice/${session.session_id}`);
              }}
            >
              <div className="result-header">
                <div className="result-info">
                  <span className="result-role">{session.role}</span>
                  <span className="result-meta">
                    {session.topic} · {session.difficulty}
                  </span>
                </div>
                <div className="result-score" style={{ borderColor: ratingColor(avgScore >= 80 ? 'Excellent' : avgScore >= 60 ? 'Good' : avgScore >= 40 ? 'Fair' : 'Needs Improvement') }}>
                  <span className="result-score-value">{avgScore}</span>
                </div>
              </div>

              <div className="result-questions">
                {evaluatedQuestions.map((q) => (
                  <div className="result-q" key={q.question_number}>
                    <span className="result-q-num">Q{q.question_number}</span>
                    <div className="result-q-bar">
                      <div
                        className="result-q-fill"
                        style={{
                          width: `${q.evaluation?.overall_score ?? 0}%`,
                          background: ratingColor(q.evaluation?.rating ?? ''),
                        }}
                      ></div>
                    </div>
                    <span className="result-q-score">{q.evaluation?.overall_score}</span>
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
