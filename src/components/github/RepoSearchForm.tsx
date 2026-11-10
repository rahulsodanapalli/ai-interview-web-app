import { useState, type FormEvent } from 'react';
import { GitBranchIcon, XIcon, AlertCircleIcon } from '../ui/Icons';
import './RepoSearchForm.css';

interface RepoSearchFormProps {
  onValidate: (repoIdentifier: string) => void;
  loading: boolean;
  initialValue?: string;
}

const POPULAR_EXAMPLES = [
  'fastapi/fastapi',
  'pallets/flask',
  'expressjs/express',
  'psf/requests',
];

export default function RepoSearchForm({
  onValidate,
  loading,
  initialValue = '',
}: RepoSearchFormProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    const trimmed = inputValue.trim();
    if (!trimmed) {
      setValidationError('Please enter a GitHub repository URL or owner/repo.');
      return;
    }

    setValidationError(null);
    onValidate(trimmed);
  }

  function handleSelectExample(example: string) {
    if (loading) return;
    setInputValue(example);
    setValidationError(null);
    onValidate(example);
  }

  return (
    <div className="surface-card repo-search-card" id="repo-search-card">
      <div className="repo-search-header">
        <h3 className="repo-search-title">Inspect a GitHub Repository</h3>
        <p className="repo-search-subtitle">
          Enter <code className="inline-code-pill">owner/repo</code> or a full URL like{' '}
          <code className="inline-code-pill">https://github.com/owner/repo</code> to browse source files,
          read documentation, and generate code-grounded questions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="repo-search-form" noValidate>
        <div className="repo-search-row">
          <div className="repo-input-wrap">
            <span className="repo-input-icon" aria-hidden="true">
              <GitBranchIcon size={16} />
            </span>
            <input
              type="text"
              id="github-repo-input"
              className={`form-input repo-text-input ${validationError ? 'input-error' : ''}`}
              placeholder="fastapi/fastapi or https://github.com/fastapi/fastapi"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
            />
            {inputValue && !loading && (
              <button
                type="button"
                className="repo-clear-btn"
                onClick={() => {
                  setInputValue('');
                  setValidationError(null);
                }}
                aria-label="Clear repository input"
                id="clear-repo-input-btn"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary repo-validate-btn"
            disabled={loading || !inputValue.trim()}
            id="validate-repo-btn"
          >
            {loading ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                <span>Validating…</span>
              </>
            ) : (
              <span>Inspect Repository</span>
            )}
          </button>
        </div>

        {validationError && (
          <div className="field-error-text animate-fade-in" role="alert">
            <AlertCircleIcon size={14} />
            <span>{validationError}</span>
          </div>
        )}

        <div className="repo-examples-row">
          <span className="repo-examples-label">Examples:</span>
          <div className="repo-examples-list">
            {POPULAR_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="repo-example-chip"
                onClick={() => handleSelectExample(example)}
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
