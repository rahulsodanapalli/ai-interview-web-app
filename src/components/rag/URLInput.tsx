import type { ChangeEvent } from 'react';
import { GitBranchIcon, GlobeIcon, XIcon, AlertCircleIcon, CheckCircleIcon } from '../ui/Icons';
import { isGitHubRepoInput } from '../../utils/url';
import './URLInput.css';

export type UrlSourceMode = 'github' | 'url';

interface URLInputProps {
  mode: UrlSourceMode;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  validationError?: string | null;
}

const GITHUB_EXAMPLES = [
  { label: 'fastapi/fastapi', url: 'https://github.com/fastapi/fastapi' },
  { label: 'facebook/react', url: 'https://github.com/facebook/react' },
  { label: 'pallets/flask', url: 'https://github.com/pallets/flask' },
];

const PUBLIC_URL_EXAMPLES = [
  { label: 'FastAPI Docs', url: 'https://fastapi.tiangolo.com/tutorial/' },
  { label: 'React Reference', url: 'https://react.dev/reference/react' },
];

export default function URLInput({
  mode,
  value,
  onChange,
  disabled = false,
  validationError,
}: URLInputProps) {
  const isGitHub = mode === 'github';
  const examples = isGitHub ? GITHUB_EXAMPLES : PUBLIC_URL_EXAMPLES;
  const trimmed = value.trim();
  const isDetectedGitHub = isGitHub && isGitHubRepoInput(trimmed);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div className="url-source-root" id="url-input-section">
      <div className="form-group">
        <label htmlFor="source-url-input" className="form-label">
          {isGitHub ? 'GitHub Repository URL' : 'Public Webpage URL'}
        </label>

        <div className="url-input-control">
          <span className="url-leading-icon" aria-hidden="true">
            {isGitHub ? <GitBranchIcon size={16} /> : <GlobeIcon size={16} />}
          </span>

          <input
            type="text"
            id="source-url-input"
            className={`form-input url-field-input ${validationError ? 'input-error' : ''}`}
            placeholder={
              isGitHub
                ? 'https://github.com/owner/repo or owner/repo'
                : 'https://docs.example.com/architecture'
            }
            value={value}
            onChange={handleChange}
            disabled={disabled}
            autoComplete="url"
            spellCheck={false}
          />

          {value && !disabled && (
            <button
              type="button"
              className="url-clear-btn"
              onClick={() => onChange('')}
              aria-label="Clear URL"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>

        <p className="form-hint">
          {isGitHub
            ? 'Repository metadata, README, and key code files will be indexed for grounded interview questions.'
            : 'Public webpage text will be extracted, chunked, and indexed into Pinecone.'}
        </p>

        {isDetectedGitHub && !validationError && (
          <div className="url-valid-hint animate-fade-in" id="github-detected-pill">
            <CheckCircleIcon size={14} />
            <span>Valid GitHub repository format detected</span>
          </div>
        )}

        {validationError && (
          <div className="field-error-text animate-fade-in" id="url-validation-error" role="alert">
            <AlertCircleIcon size={14} />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      <div className="url-examples-row">
        <span className="url-examples-label">Examples:</span>
        <div className="url-examples-list">
          {examples.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className={`url-example-chip ${value.trim() === ex.url ? 'is-active' : ''}`}
              onClick={() => onChange(ex.url)}
              disabled={disabled}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
