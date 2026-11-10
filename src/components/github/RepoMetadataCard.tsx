import type { RepoMetadataResponse } from '../../types';
import {
  GitBranchIcon,
  StarIcon,
  GitForkIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
  RefreshIcon,
  SparklesIcon,
  BookOpenIcon,
  FolderIcon,
} from '../ui/Icons';
import './RepoMetadataCard.css';

export type GitHubViewTab = 'question' | 'readme' | 'files';

interface RepoMetadataCardProps {
  metadata: RepoMetadataResponse;
  activeTab: GitHubViewTab;
  onTabChange: (tab: GitHubViewTab) => void;
  onChangeRepo: () => void;
}

function getLanguageColor(lang: string | null): string {
  switch (lang?.toLowerCase()) {
    case 'python':
      return '#3572A5';
    case 'typescript':
      return '#3178c6';
    case 'javascript':
      return '#e6c637';
    case 'go':
      return '#00ADD8';
    case 'rust':
      return '#dea584';
    case 'java':
      return '#b07219';
    case 'c++':
    case 'cpp':
      return '#f34b7d';
    default:
      return 'var(--color-primary-500)';
  }
}

export default function RepoMetadataCard({
  metadata,
  activeTab,
  onTabChange,
  onChangeRepo,
}: RepoMetadataCardProps) {
  const {
    full_name,
    description,
    stars_count,
    forks_count,
    open_issues_count,
    language,
    topics,
    default_branch,
    is_private,
    html_url,
    has_readme,
  } = metadata;

  return (
    <div className="surface-card repo-meta-card animate-fade-in" id="repo-metadata-card">
      <div className="repo-meta-header">
        <div className="repo-meta-identity">
          <div className="repo-meta-title-row">
            <a
              href={html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="repo-full-name"
              title="Open repository on GitHub"
              id="repo-github-link"
            >
              <span>{full_name}</span>
              <ExternalLinkIcon size={14} />
            </a>
            <span className={`badge ${is_private ? 'badge-warning' : 'badge-neutral'}`}>
              {is_private ? 'Private' : 'Public'}
            </span>
            <span className="badge badge-neutral">
              <GitBranchIcon size={11} />
              <span>{default_branch}</span>
            </span>
            {has_readme && <span className="badge badge-success">README</span>}
          </div>

          {description && <p className="repo-description">{description}</p>}

          <div className="repo-stats-row">
            {language && (
              <span className="repo-stat-pill">
                <span
                  className="repo-lang-dot"
                  style={{ backgroundColor: getLanguageColor(language) }}
                />
                <span>{language}</span>
              </span>
            )}
            <span className="repo-stat-pill">
              <StarIcon size={13} />
              <span>{stars_count.toLocaleString()} stars</span>
            </span>
            <span className="repo-stat-pill">
              <GitForkIcon size={13} />
              <span>{forks_count.toLocaleString()} forks</span>
            </span>
            <span className="repo-stat-pill">
              <AlertCircleIcon size={13} />
              <span>{open_issues_count.toLocaleString()} issues</span>
            </span>
          </div>

          {topics && topics.length > 0 && (
            <div className="repo-topics-row">
              {topics.slice(0, 8).map((topic) => (
                <span key={topic} className="repo-topic-pill">
                  {topic}
                </span>
              ))}
              {topics.length > 8 && (
                <span className="repo-topic-pill">+{topics.length - 8}</span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onChangeRepo}
          id="change-repo-btn"
        >
          <RefreshIcon size={13} />
          <span>Change Repo</span>
        </button>
      </div>

      <div className="repo-tabs-bar" role="tablist" aria-label="Repository tools">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'question'}
          className={`repo-tab ${activeTab === 'question' ? 'is-active' : ''}`}
          onClick={() => onTabChange('question')}
          id="tab-btn-question"
        >
          <SparklesIcon size={14} />
          <span>Interview Question</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'readme'}
          className={`repo-tab ${activeTab === 'readme' ? 'is-active' : ''}`}
          onClick={() => onTabChange('readme')}
          id="tab-btn-readme"
        >
          <BookOpenIcon size={14} />
          <span>README</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'files'}
          className={`repo-tab ${activeTab === 'files' ? 'is-active' : ''}`}
          onClick={() => onTabChange('files')}
          id="tab-btn-files"
        >
          <FolderIcon size={14} />
          <span>Source Files</span>
        </button>
      </div>
    </div>
  );
}
