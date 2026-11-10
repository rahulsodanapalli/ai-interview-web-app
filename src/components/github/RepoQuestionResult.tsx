import { useState } from 'react';
import type { RepoQuestionResponse } from '../../types';
import { getDifficultyBadgeClass } from '../../utils/format';
import {
  CheckCircleIcon,
  AlertCircleIcon,
  CopyIcon,
  CheckIcon,
  ChevronDownIcon,
  RefreshIcon,
  BookOpenIcon,
} from '../ui/Icons';
import './RepoQuestionResult.css';

interface RepoQuestionResultProps {
  result: RepoQuestionResponse;
  onReset: () => void;
  onGenerateAnother: () => void;
  onViewReadme?: () => void;
}

export default function RepoQuestionResult({
  result,
  onReset,
  onGenerateAnother,
  onViewReadme,
}: RepoQuestionResultProps) {
  const [showRubric, setShowRubric] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    question,
    expected_answer_points,
    follow_up_question,
    difficulty,
    topic,
    repository,
    context_grounded,
    evidence,
    grounding_note,
  } = result;

  function handleCopyQuestion() {
    navigator.clipboard.writeText(question);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function renderSourceTypeLabel(sourceType: string): string {
    switch (sourceType) {
      case 'readme':
        return 'README';
      case 'source_file':
        return 'Source File';
      case 'repo_metadata':
        return 'Repository Metadata';
      default:
        return 'General Role';
    }
  }

  return (
    <div className="repo-q-result-stack animate-fade-in" id="repo-question-result">
      {/* Grounding Status Banner */}
      <div
        className={`alert-banner ${context_grounded ? 'alert-banner-success' : 'alert-banner-warning'}`}
        id="repo-grounding-banner"
      >
        {context_grounded ? (
          <CheckCircleIcon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        ) : (
          <AlertCircleIcon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        )}
        <div className="alert-banner-body">
          <div className="alert-banner-title" id="grounding-status-tag">
            {context_grounded
              ? 'Grounded in Repository Context'
              : 'General Knowledge Fallback'}
          </div>
          <div>
            {context_grounded
              ? `Synthesized directly from verified code or documentation in ${repository}.`
              : 'Repository files or README did not provide sufficient context for this topic; generated using general role criteria.'}
          </div>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="surface-card repo-q-result-card">
        <div className="repo-q-result-top">
          <div className="repo-q-result-badges">
            <span className={`badge ${getDifficultyBadgeClass(difficulty)}`} id="result-diff-badge">
              {difficulty}
            </span>
            <span className="badge badge-primary">{topic}</span>
            <span className="badge badge-neutral">{repository}</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyQuestion}
            id="copy-repo-question-btn"
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="repo-q-headline-wrap">
          <span className="repo-q-eyebrow">Technical Interview Question</span>
          <h3 className="repo-q-headline" id="repo-question-text">
            {question}
          </h3>
        </div>

        {follow_up_question && (
          <div className="repo-q-followup" id="repo-followup-box">
            <span className="repo-q-sub-label">Follow-up Probe</span>
            <p id="repo-followup-text">{follow_up_question}</p>
          </div>
        )}

        {expected_answer_points && expected_answer_points.length > 0 && (
          <div className="repo-q-rubric" id="repo-rubric-section">
            <button
              type="button"
              className="repo-q-rubric-toggle"
              onClick={() => setShowRubric((prev) => !prev)}
              aria-expanded={showRubric}
              id="toggle-repo-rubric-btn"
            >
              <span>
                {showRubric ? 'Hide' : 'View'} Expected Answer Criteria ({expected_answer_points.length})
              </span>
              <ChevronDownIcon
                size={15}
                style={{
                  transform: showRubric ? 'rotate(180deg)' : 'none',
                  transition: 'transform 150ms ease',
                }}
              />
            </button>

            {showRubric && (
              <ul className="repo-q-rubric-list animate-fade-in" id="repo-rubric-list">
                {expected_answer_points.map((pt, idx) => (
                  <li key={idx}>
                    <CheckIcon size={14} />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Evidence Section */}
        <div className="repo-q-evidence" id="repo-evidence-section">
          <div className="repo-q-evidence-header">
            <span className="repo-q-sub-label">Grounding Evidence</span>
            {evidence?.source_type && (
              <span className="badge badge-neutral">
                {renderSourceTypeLabel(evidence.source_type)}
              </span>
            )}
          </div>

          {evidence && evidence.source_type !== 'none' && evidence.excerpt ? (
            <div className="repo-q-evidence-box">
              <div className="evidence-path-row">
                <span>Source:</span>
                <code>{evidence.source_path || 'Repository root'}</code>
              </div>
              <pre className="evidence-excerpt-pre">
                <code>{evidence.excerpt}</code>
              </pre>
              {grounding_note && <p className="evidence-note">{grounding_note}</p>}
            </div>
          ) : (
            <div className="repo-q-evidence-box">
              <p className="evidence-note">
                No specific code or README excerpts were cited for this question.
                {grounding_note ? ` ${grounding_note}` : ''}
              </p>
            </div>
          )}
        </div>

        <div className="repo-q-result-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onGenerateAnother}
            id="generate-another-github-btn"
          >
            <RefreshIcon size={14} />
            <span>Generate Another</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onReset}
            id="reconfigure-github-btn"
          >
            Reconfigure
          </button>

          {onViewReadme && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onViewReadme}
              id="view-repo-readme-btn"
            >
              <BookOpenIcon size={14} />
              <span>View README</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
