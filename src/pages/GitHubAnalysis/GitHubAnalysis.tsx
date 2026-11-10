import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RepoSearchForm from '../../components/github/RepoSearchForm';
import RepoMetadataCard, { type GitHubViewTab } from '../../components/github/RepoMetadataCard';
import RepoReadmeViewer from '../../components/github/RepoReadmeViewer';
import RepoFileExplorer from '../../components/github/RepoFileExplorer';
import RepoQuestionForm from '../../components/github/RepoQuestionForm';
import RepoQuestionResult from '../../components/github/RepoQuestionResult';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  validateRepository,
  generateRepoQuestion,
  formatGitHubApiError,
} from '../../api/githubService';
import { isRequestAborted } from '../../utils/error';
import { AlertCircleIcon, ArrowRightIcon, RefreshIcon, SparklesIcon } from '../../components/ui/Icons';
import type {
  RepoMetadataResponse,
  RepoQuestionRequest,
  RepoQuestionResponse,
} from '../../types';
import './GitHubAnalysis.css';

export default function GitHubAnalysis() {
  const navigate = useNavigate();

  const [repoIdentifier, setRepoIdentifier] = useState('');
  const [metadata, setMetadata] = useState<RepoMetadataResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<GitHubViewTab>('question');
  const [focusFilePath, setFocusFilePath] = useState('');

  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [questionResult, setQuestionResult] = useState<RepoQuestionResponse | null>(null);
  const [lastPayload, setLastPayload] = useState<RepoQuestionRequest | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  async function handleValidate(identifier: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setValidating(true);
    setValidationError(null);
    setGenerationError(null);
    setQuestionResult(null);

    try {
      const data = await validateRepository(identifier, { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;
      setMetadata(data);
      setRepoIdentifier(data.full_name);
      setActiveTab('question');
    } catch (err: unknown) {
      if (!mountedRef.current || isRequestAborted(err)) return;
      setValidationError(
        formatGitHubApiError(
          err,
          'Failed to validate GitHub repository. Verify the URL or owner/repo format.'
        )
      );
      setMetadata(null);
    } finally {
      if (mountedRef.current) {
        setValidating(false);
      }
    }
  }

  function handleChangeRepo() {
    abortRef.current?.abort();
    setMetadata(null);
    setQuestionResult(null);
    setValidationError(null);
    setGenerationError(null);
    setFocusFilePath('');
    setValidating(false);
    setGenerating(false);
  }

  async function handleGenerateQuestion(payload: RepoQuestionRequest) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGenerating(true);
    setGenerationError(null);
    setLastPayload(payload);

    try {
      const response = await generateRepoQuestion(payload, { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;
      setQuestionResult(response);
    } catch (err: unknown) {
      if (!mountedRef.current || isRequestAborted(err)) return;
      setGenerationError(
        formatGitHubApiError(
          err,
          'Failed to generate repository question. Verify backend status and local Ollama model.'
        )
      );
    } finally {
      if (mountedRef.current) {
        setGenerating(false);
      }
    }
  }

  function handleSelectFocusFile(filePath: string) {
    setFocusFilePath(filePath);
    setActiveTab('question');
    setQuestionResult(null);
  }

  return (
    <div className="page-container animate-fade-in" id="github-analysis-page">
      <div className="page-header">
        <div className="page-header-text">
          <h2 className="page-title">GitHub Repository Analysis</h2>
          <p className="page-subtitle">
            Inspect any public or authorized repository, review its README and source code,
            and generate interview questions grounded in actual implementation files.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/rag')}
        >
          <SparklesIcon size={14} />
          <span>Full GitHub RAG Session</span>
          <ArrowRightIcon size={13} />
        </button>
      </div>

      {!metadata ? (
        <div className="github-search-section">
          <RepoSearchForm
            onValidate={handleValidate}
            loading={validating}
            initialValue={repoIdentifier}
          />

          {validationError && (
            <div className="alert-banner alert-banner-error animate-fade-in" role="alert" id="github-validate-error">
              <AlertCircleIcon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div className="alert-banner-body">
                <div className="alert-banner-title">Repository validation failed</div>
                <div>{validationError}</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="github-workspace animate-fade-in">
          <RepoMetadataCard
            metadata={metadata}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onChangeRepo={handleChangeRepo}
          />

          {activeTab === 'question' && (
            <div className="github-tab-panel animate-fade-in">
              {questionResult ? (
                <RepoQuestionResult
                  result={questionResult}
                  onReset={() => {
                    setQuestionResult(null);
                    setGenerationError(null);
                  }}
                  onGenerateAnother={() => lastPayload && void handleGenerateQuestion(lastPayload)}
                  onViewReadme={() => setActiveTab('readme')}
                />
              ) : (
                <>
                  <RepoQuestionForm
                    repo={metadata.full_name}
                    defaultBranch={metadata.default_branch}
                    focusFilePath={focusFilePath}
                    onFocusFileChange={setFocusFilePath}
                    onSubmit={(payload) => void handleGenerateQuestion(payload)}
                    loading={generating}
                  />

                  {generating && (
                    <div className="surface-card github-generating-card animate-fade-in" id="github-generating-card">
                      <LoadingSpinner
                        message="Inspecting repository context and generating question…"
                        subtext="Analyzing README / source files and synthesizing rubric criteria via Ollama."
                        size="md"
                      />
                    </div>
                  )}

                  {generationError && !generating && (
                    <div className="alert-banner alert-banner-error animate-fade-in" role="alert" id="github-question-error">
                      <AlertCircleIcon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div className="alert-banner-body">
                        <div className="alert-banner-title">Question generation failed</div>
                        <div>{generationError}</div>
                        {lastPayload && (
                          <div className="alert-banner-actions">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => void handleGenerateQuestion(lastPayload)}
                            >
                              <RefreshIcon size={13} />
                              <span>Retry</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'readme' && (
            <div className="github-tab-panel animate-fade-in">
              <RepoReadmeViewer
                key={metadata.full_name}
                repo={metadata.full_name}
                hasReadmeFlag={metadata.has_readme}
              />
            </div>
          )}

          {activeTab === 'files' && (
            <div className="github-tab-panel animate-fade-in">
              <RepoFileExplorer
                key={metadata.full_name}
                repo={metadata.full_name}
                onSelectFocusFile={handleSelectFocusFile}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
