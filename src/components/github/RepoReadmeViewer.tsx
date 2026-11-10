import { useEffect, useState } from 'react';
import { getRepositoryReadme, formatGitHubApiError } from '../../api/githubService';
import { isRequestAborted } from '../../utils/error';
import type { RepoReadmeResponse } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import ErrorDisplay from '../ui/ErrorDisplay';
import MarkdownContent from '../ui/MarkdownContent';
import { BookOpenIcon, CheckIcon, CopyIcon, ExternalLinkIcon } from '../ui/Icons';
import './RepoReadmeViewer.css';

interface RepoReadmeViewerProps {
  repo: string;
  hasReadmeFlag: boolean;
}

export default function RepoReadmeViewer({ repo, hasReadmeFlag }: RepoReadmeViewerProps) {
  const [readmeData, setReadmeData] = useState<RepoReadmeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function fetchReadme() {
      try {
        const data = await getRepositoryReadme(repo, undefined, { signal: controller.signal });
        if (active) {
          setReadmeData(data);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (active && !isRequestAborted(err)) {
          setError(formatGitHubApiError(err, 'Failed to retrieve repository README file.'));
          setReadmeData(null);
          setLoading(false);
        }
      }
    }

    void fetchReadme();

    return () => {
      active = false;
      controller.abort();
    };
  }, [repo, reloadTick]);

  function handleRetry() {
    setLoading(true);
    setError(null);
    setReloadTick((t) => t + 1);
  }

  function handleCopyReadme() {
    if (!readmeData?.content) return;
    navigator.clipboard.writeText(readmeData.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="surface-card readme-card">
        <LoadingSpinner message="Fetching repository README…" size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        title={hasReadmeFlag ? 'Unable to load README' : 'No README available'}
        message={error}
        onRetry={handleRetry}
      />
    );
  }

  if (!readmeData) {
    return (
      <EmptyState
        icon={<BookOpenIcon size={20} />}
        title="No README detected"
        description="This repository does not contain a root README file."
      />
    );
  }

  const approxWordCount = readmeData.content.trim().split(/\s+/).length;
  const sizeKb = (readmeData.size_bytes / 1024).toFixed(1);

  return (
    <div className="surface-card readme-card animate-fade-in" id="repo-readme-viewer">
      <div className="readme-top-bar">
        <div className="readme-file-meta">
          <BookOpenIcon size={16} />
          <span className="readme-filename">{readmeData.filename}</span>
          <span className="badge badge-neutral">{sizeKb} KB</span>
          <span className="badge badge-neutral">~{approxWordCount.toLocaleString()} words</span>
        </div>

        <div className="readme-actions">
          {readmeData.html_url && (
            <a
              href={readmeData.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <span>GitHub</span>
              <ExternalLinkIcon size={12} />
            </a>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyReadme}
            id="copy-readme-btn"
          >
            {copied ? (
              <>
                <CheckIcon size={13} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <CopyIcon size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="readme-body-scroll" id="readme-rendered-content">
        <MarkdownContent content={readmeData.content} />
      </div>
    </div>
  );
}
