import { useState, type FormEvent } from 'react';
import type { RepoQuestionRequest, GitHubDifficultyLevel } from '../../types';
import { SparklesIcon, XIcon } from '../ui/Icons';
import './RepoQuestionForm.css';

interface RepoQuestionFormProps {
  repo: string;
  defaultBranch?: string;
  focusFilePath?: string;
  onFocusFileChange?: (path: string) => void;
  onSubmit: (payload: RepoQuestionRequest) => void;
  loading: boolean;
}

const COMMON_ROLES = [
  'Software Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
  'DevOps / SRE',
  'System Architect',
];

const COMMON_TOPICS = [
  'System Architecture & Code Quality',
  'API Design & Data Flow',
  'Concurrency & Performance',
  'Error Handling & Resilience',
  'Testing & CI/CD',
  'Security & Auth',
];

export default function RepoQuestionForm({
  repo,
  defaultBranch = 'main',
  focusFilePath = '',
  onFocusFileChange,
  onSubmit,
  loading,
}: RepoQuestionFormProps) {
  const [role, setRole] = useState('Software Engineer');
  const [topic, setTopic] = useState('System Architecture & Code Quality');
  const [difficulty, setDifficulty] = useState<GitHubDifficultyLevel>('Medium');
  const [localFile, setLocalFile] = useState(focusFilePath);

  const activeFile = onFocusFileChange ? focusFilePath : localFile;

  function handleFileChange(val: string) {
    if (onFocusFileChange) {
      onFocusFileChange(val);
    } else {
      setLocalFile(val);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    onSubmit({
      repo_url_or_name: repo,
      role: role.trim() || 'Software Engineer',
      topic: topic.trim() || 'System Architecture & Code Quality',
      difficulty,
      focus_file_path: activeFile.trim() ? activeFile.trim() : null,
      ref: defaultBranch || null,
    });
  }

  return (
    <div className="surface-card repo-q-form-card animate-fade-in" id="repo-question-form">
      <div className="repo-q-form-header">
        <h3 className="repo-q-form-title">Generate Repository-Grounded Question</h3>
        <p className="repo-q-form-subtitle">
          Synthesize a technical interview question directly from repository source files or README.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="repo-q-form-body">
        <div className="repo-q-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="repo-role-input">
              Target Role
            </label>
            <input
              type="text"
              id="repo-role-input"
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              disabled={loading}
              required
            />
            <div className="repo-pills-row">
              {COMMON_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`repo-pill-chip ${role === r ? 'is-active' : ''}`}
                  onClick={() => setRole(r)}
                  disabled={loading}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="repo-topic-select">
              Technical Focus
            </label>
            <select
              id="repo-topic-select"
              className="form-select"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
            >
              {COMMON_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <div className="repo-pills-row">
              {COMMON_TOPICS.slice(0, 3).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`repo-pill-chip ${topic === t ? 'is-active' : ''}`}
                  onClick={() => setTopic(t)}
                  disabled={loading}
                >
                  {t.split('&')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <span className="form-label">Difficulty</span>
            <div className="repo-diff-segmented" role="radiogroup" aria-label="Target Difficulty">
              {(['Easy', 'Medium', 'Hard'] as GitHubDifficultyLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === level}
                  className={`repo-diff-btn ${difficulty === level ? 'is-active' : ''}`}
                  onClick={() => setDifficulty(level)}
                  disabled={loading}
                  id={`diff-btn-${level.toLowerCase()}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="repo-focus-file-input">
              Focus File Path <span className="optional-label">(Optional)</span>
            </label>
            <div className="focus-file-input-wrap">
              <input
                type="text"
                id="repo-focus-file-input"
                className="form-input focus-file-input"
                value={activeFile}
                onChange={(e) => handleFileChange(e.target.value)}
                placeholder="e.g. app/main.py or src/router.ts"
                disabled={loading}
                spellCheck={false}
              />
              {activeFile && !loading && (
                <button
                  type="button"
                  className="focus-file-clear"
                  onClick={() => handleFileChange('')}
                  aria-label="Clear focus file"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            <span className="form-hint">
              Leave blank for README / repository-wide context, or pick a file in Source Files.
            </span>
          </div>
        </div>

        <div className="repo-q-form-footer">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            id="generate-repo-question-btn"
          >
            {loading ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                <span>Generating Question…</span>
              </>
            ) : (
              <>
                <SparklesIcon size={15} />
                <span>Generate Grounded Question</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
