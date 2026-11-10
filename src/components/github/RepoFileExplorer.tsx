import { useEffect, useState, useRef } from 'react';
import { listRepositoryFiles, getFileContent, formatGitHubApiError } from '../../api/githubService';
import { isRequestAborted } from '../../utils/error';
import { formatFileSize } from '../../utils/format';
import type { RepoFileItem, RepoFileContentResponse } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import {
  FolderIcon,
  FileCodeIcon,
  ChevronLeftIcon,
  RefreshIcon,
  SparklesIcon,
  XIcon,
  AlertCircleIcon,
  CopyIcon,
  CheckIcon,
} from '../ui/Icons';
import './RepoFileExplorer.css';

interface RepoFileExplorerProps {
  repo: string;
  onSelectFocusFile?: (filePath: string) => void;
}

export default function RepoFileExplorer({ repo, onSelectFocusFile }: RepoFileExplorerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<RepoFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [previewFile, setPreviewFile] = useState<RepoFileContentResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const fileAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fileAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function fetchFiles() {
      try {
        const response = await listRepositoryFiles(repo, currentPath, undefined, {
          signal: controller.signal,
        });
        if (!active) return;

        const sorted = [...response.items].sort((a, b) => {
          if (a.type === 'dir' && b.type !== 'dir') return -1;
          if (a.type !== 'dir' && b.type === 'dir') return 1;
          return a.name.localeCompare(b.name);
        });
        setItems(sorted);
        setError(null);
        setLoading(false);
      } catch (err: unknown) {
        if (active && !isRequestAborted(err)) {
          setError(formatGitHubApiError(err, 'Failed to list repository files.'));
          setItems([]);
          setLoading(false);
        }
      }
    }

    void fetchFiles();

    return () => {
      active = false;
      controller.abort();
    };
  }, [repo, currentPath, reloadTick]);

  function navigateToPath(nextPath: string) {
    fileAbortRef.current?.abort();
    setCurrentPath(nextPath);
    setLoading(true);
    setError(null);
    setPreviewFile(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }

  async function handleOpenFile(item: RepoFileItem) {
    if (item.type === 'dir') {
      navigateToPath(item.path);
      return;
    }

    if (previewFile?.file_path === item.path && !previewLoading) {
      return;
    }

    fileAbortRef.current?.abort();
    const controller = new AbortController();
    fileAbortRef.current = controller;

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const data = await getFileContent(repo, item.path, undefined, {
        signal: controller.signal,
      });
      if (mountedRef.current && !controller.signal.aborted) {
        setPreviewFile(data);
        setPreviewLoading(false);
      }
    } catch (err: unknown) {
      if (mountedRef.current && !isRequestAborted(err)) {
        setPreviewError(formatGitHubApiError(err, `Failed to fetch content for ${item.path}.`));
        setPreviewFile(null);
        setPreviewLoading(false);
      }
    }
  }

  function handleRetryDir() {
    setLoading(true);
    setError(null);
    setReloadTick((t) => t + 1);
  }

  function handleCopyCode() {
    if (!previewFile?.content) return;
    navigator.clipboard.writeText(previewFile.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  const pathParts = currentPath ? currentPath.split('/') : [];

  return (
    <div className="surface-card repo-explorer-card animate-fade-in" id="repo-file-explorer">
      <div className="explorer-top-bar">
        <div className="explorer-breadcrumbs">
          <FolderIcon size={15} />
          <button
            type="button"
            className="breadcrumb-btn"
            onClick={() => navigateToPath('')}
          >
            root
          </button>
          {pathParts.map((part, idx) => {
            const subPath = pathParts.slice(0, idx + 1).join('/');
            return (
              <span key={subPath} className="breadcrumb-part">
                <span className="breadcrumb-slash">/</span>
                <button
                  type="button"
                  className="breadcrumb-btn"
                  onClick={() => navigateToPath(subPath)}
                >
                  {part}
                </button>
              </span>
            );
          })}
        </div>

        {currentPath && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigateToPath(pathParts.slice(0, -1).join('/'))}
          >
            <ChevronLeftIcon size={14} />
            <span>Up</span>
          </button>
        )}
      </div>

      <div className={`explorer-split ${previewFile || previewLoading || previewError ? 'has-preview' : ''}`}>
        <div className="explorer-tree-pane">
          {loading ? (
            <LoadingSpinner message="Listing repository files…" size="sm" />
          ) : error ? (
            <div className="explorer-error-box" role="alert">
              <AlertCircleIcon size={18} />
              <p>{error}</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleRetryDir}>
                <RefreshIcon size={13} />
                <span>Retry</span>
              </button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<FolderIcon size={18} />}
              title="Empty directory"
              description="No files or subdirectories found in this path."
            />
          ) : (
            <ul className="explorer-file-list">
              {items.map((item) => {
                const isSelected = previewFile?.file_path === item.path;
                return (
                  <li key={item.path} className={`explorer-file-item ${isSelected ? 'is-selected' : ''}`}>
                    <button
                      type="button"
                      className="explorer-file-trigger"
                      onClick={() => void handleOpenFile(item)}
                    >
                      <span className="explorer-file-icon" aria-hidden="true">
                        {item.type === 'dir' ? <FolderIcon size={15} /> : <FileCodeIcon size={15} />}
                      </span>
                      <span className="explorer-file-name" title={item.name}>
                        {item.name}
                      </span>
                      {item.type === 'file' && typeof item.size === 'number' && (
                        <span className="explorer-file-size">{formatFileSize(item.size)}</span>
                      )}
                    </button>

                    {item.type === 'file' && onSelectFocusFile && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm explorer-focus-btn"
                        onClick={() => onSelectFocusFile(item.path)}
                        title="Use this file to generate interview question"
                      >
                        <SparklesIcon size={13} />
                        <span>Focus</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {(previewLoading || previewError || previewFile) && (
          <div className="explorer-preview-pane">
            {previewLoading ? (
              <div className="preview-loading-wrap">
                <LoadingSpinner message="Loading source file…" size="sm" />
              </div>
            ) : previewError ? (
              <div className="explorer-error-box" role="alert">
                <AlertCircleIcon size={18} />
                <p>{previewError}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPreviewError(null)}
                >
                  Dismiss
                </button>
              </div>
            ) : previewFile ? (
              <div className="preview-content-box animate-fade-in">
                <div className="preview-header-bar">
                  <div className="preview-file-title">
                    <FileCodeIcon size={15} />
                    <span className="preview-path" title={previewFile.file_path}>
                      {previewFile.file_path}
                    </span>
                    <span className="badge badge-neutral">
                      {formatFileSize(previewFile.size_bytes)}
                    </span>
                    {previewFile.is_truncated && (
                      <span className="badge badge-warning">Truncated</span>
                    )}
                  </div>

                  <div className="preview-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleCopyCode}
                    >
                      {copiedCode ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                    {onSelectFocusFile && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onSelectFocusFile(previewFile.file_path)}
                      >
                        <SparklesIcon size={13} />
                        <span>Ask Question</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => setPreviewFile(null)}
                      aria-label="Close file preview"
                    >
                      <XIcon size={15} />
                    </button>
                  </div>
                </div>

                <pre className="preview-code-scroll">
                  <code>{previewFile.content}</code>
                </pre>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
