import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PDFUpload from '../../components/rag/PDFUpload';
import URLInput from '../../components/rag/URLInput';
import RagProgressTracker, { type RagStageItem, type RagStageStatus } from '../../components/rag/RagProgressTracker';
import { uploadDocument } from '../../api/documentService';
import {
  getSourceStatus,
  ingestUrl,
  generateSourceQuestions,
  createSourceSession,
  sanitizeSourceId,
  formatSourceApiError,
} from '../../api/sourceService';
import {
  validateGitHubUrl,
  validatePublicUrl,
  normalizeRepoUrl,
  normalizePublicUrl,
} from '../../utils/url';
import { isRequestAborted, getErrorStatus } from '../../utils/error';
import {
  FileTextIcon,
  GitBranchIcon,
  GlobeIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  RefreshIcon,
  SparklesIcon,
} from '../../components/ui/Icons';
import type {
  SourceType,
  SourceProcessingStatus,
} from '../../types';
import './DocumentRAG.css';

const SESSION_STORAGE_SOURCE_KEY = 'source_interview_active_source';
const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;
type QuestionCount = (typeof QUESTION_COUNT_OPTIONS)[number];
type SourceTab = 'document' | 'github' | 'url';

export interface ActiveSourceInfo {
  source_id: string;
  source_type: SourceType;
  title: string;
  status: SourceProcessingStatus;
  url?: string | null;
  filename?: string | null;
  character_count?: number;
  chunk_count?: number;
  vector_count?: number;
  page_count?: number;
  preview?: string;
  message?: string;
}

function loadStoredSource(): ActiveSourceInfo | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_SOURCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveSourceInfo;
      if (parsed && parsed.source_id) return parsed;
    }
  } catch {
    // Ignore invalid sessionStorage entry
  }
  return null;
}

function saveStoredSource(source: ActiveSourceInfo | null) {
  try {
    if (source) {
      sessionStorage.setItem(SESSION_STORAGE_SOURCE_KEY, JSON.stringify(source));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_SOURCE_KEY);
    }
  } catch {
    // Ignore sessionStorage write errors
  }
}

function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function buildInitialStages(
  tab: SourceTab,
  hasCompletedSource: boolean,
  count: QuestionCount
): RagStageItem[] {
  const ingestLabel =
    tab === 'github'
      ? 'Analyzing repository & indexing in Pinecone'
      : tab === 'url'
      ? 'Fetching webpage & indexing in Pinecone'
      : 'Uploading PDF, extracting content & indexing in Pinecone';

  const ingestDetail = hasCompletedSource
    ? 'Source already indexed and ready'
    : tab === 'github'
    ? 'Retrieving repository context, chunking, and generating embeddings…'
    : tab === 'url'
    ? 'Extracting public page content, chunking, and generating embeddings…'
    : 'Extracting document text, creating chunks, and indexing vectors…';

  return [
    {
      id: 'ingest',
      label: ingestLabel,
      detail: ingestDetail,
      status: hasCompletedSource ? 'completed' : 'active',
    },
    {
      id: 'generate',
      label: 'Generating interview questions',
      detail: `Waiting to synthesize ${count} grounded questions…`,
      status: hasCompletedSource ? 'active' : 'pending',
    },
    {
      id: 'session',
      label: 'Preparing your interview',
      detail: 'Creating interview session and opening practice room…',
      status: 'pending',
    },
  ];
}

export default function DocumentRAG() {
  const navigate = useNavigate();

  const [activeSource, setActiveSource] = useState<ActiveSourceInfo | null>(() => loadStoredSource());
  const [sourceTab, setSourceTab] = useState<SourceTab>(() => {
    const stored = loadStoredSource();
    return stored?.source_type ?? 'document';
  });

  // Staged user inputs prior to ingestion
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [urlValue, setUrlValue] = useState<string>('');
  const [sourceValidationError, setSourceValidationError] = useState<string | null>(null);

  // Step 2: Single configuration field — question count
  const [questionCount, setQuestionCount] = useState<QuestionCount>(5);

  // Submission & honest stage progress state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stages, setStages] = useState<RagStageItem[] | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const isSubmittingRef = useRef(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveStoredSource(activeSource);
  }, [activeSource]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const updateStage = useCallback(
    (id: string, status: RagStageStatus, detail?: string, extraStageAfter?: { afterId: string; stage: RagStageItem }) => {
      if (!mountedRef.current) return;
      setStages((prev) => {
        if (!prev) return prev;
        let next = prev.map((s) =>
          s.id === id ? { ...s, status, detail: detail ?? s.detail } : s
        );
        if (extraStageAfter && !next.some((s) => s.id === extraStageAfter.stage.id)) {
          const idx = next.findIndex((s) => s.id === extraStageAfter.afterId);
          if (idx !== -1) {
            next = [
              ...next.slice(0, idx + 1),
              extraStageAfter.stage,
              ...next.slice(idx + 1),
            ];
          }
        }
        return next;
      });
    },
    []
  );

  const pollSourceUntilReady = useCallback(
    async (sourceId: string, signal: AbortSignal): Promise<ActiveSourceInfo> => {
      const maxAttempts = 40; // ~60s max
      let transientErrors = 0;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        try {
          const statusData = await getSourceStatus(sourceId, { signal });
          transientErrors = 0;

          if (statusData.status === 'completed') {
            return {
              source_id: sanitizeSourceId(statusData.source_id),
              source_type: statusData.source_type,
              title: statusData.title,
              status: 'completed',
              url: statusData.url,
              filename: statusData.filename,
              character_count: statusData.character_count,
              chunk_count: statusData.chunk_count,
              vector_count: statusData.vector_count,
              message: `Indexed ${statusData.chunk_count || 0} chunks into Pinecone.`,
            };
          }

          if (statusData.status === 'failed') {
            throw new Error(
              statusData.error_message || 'Source processing failed on the backend.'
            );
          }
        } catch (err) {
          if (isRequestAborted(err)) throw err;

          const httpStatus = getErrorStatus(err);
          // Immediately fail on non-transient errors (4xx or explicit backend failure message)
          if (
            (httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500) ||
            (err instanceof Error && !httpStatus && !err.message.includes('Network Error') && !err.message.includes('timeout'))
          ) {
            throw err;
          }

          transientErrors++;
          if (transientErrors >= 3 || attempt >= maxAttempts) {
            throw err;
          }
        }

        await sleepWithAbort(1500, signal);
      }

      throw new Error('Indexing timed out waiting for Pinecone completion. Please retry.');
    },
    []
  );

  function handleTabChange(nextTab: SourceTab) {
    if (isSubmitting) return;
    setSourceTab(nextTab);
    setSourceValidationError(null);
    setSubmissionError(null);
    setStages(null);
  }

  function handleCancelSubmission() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    setStages(null);
  }

  function handleClearSource() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    setActiveSource(null);
    saveStoredSource(null);
    setSelectedPdfFile(null);
    setUrlValue('');
    setSourceValidationError(null);
    setSubmissionError(null);
    setStages(null);
  }

  function validateSelectedSource(): { valid: boolean; normalizedUrl?: string } {
    if (activeSource) {
      return { valid: true };
    }

    if (sourceTab === 'document') {
      if (!selectedPdfFile) {
        setSourceValidationError('Please select a PDF document to upload.');
        return { valid: false };
      }
      return { valid: true };
    }

    if (sourceTab === 'github') {
      const err = validateGitHubUrl(urlValue);
      if (err) {
        setSourceValidationError(err);
        return { valid: false };
      }
      return { valid: true, normalizedUrl: normalizeRepoUrl(urlValue) };
    }

    const err = validatePublicUrl(urlValue);
    if (err) {
      setSourceValidationError(err);
      return { valid: false };
    }
    return { valid: true, normalizedUrl: normalizePublicUrl(urlValue) };
  }

  async function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    setSourceValidationError(null);
    setSubmissionError(null);

    if (!QUESTION_COUNT_OPTIONS.includes(questionCount)) {
      setSubmissionError('Please select a valid number of questions (5, 10, 15, or 20).');
      return;
    }

    const validation = validateSelectedSource();
    if (!validation.valid) return;

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;
    const { signal } = controller;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const hasCompletedSource = activeSource?.status === 'completed';
    const effectiveTab: SourceTab = activeSource ? activeSource.source_type : sourceTab;
    setStages(buildInitialStages(effectiveTab, hasCompletedSource, questionCount));

    let currentSource = activeSource;
    let activeStageId: 'ingest' | 'index' | 'generate' | 'session' = hasCompletedSource
      ? 'generate'
      : 'ingest';

    try {
      // Stage 1: Ingest source if not yet uploaded/ingested
      if (!currentSource) {
        if (sourceTab === 'document' && selectedPdfFile) {
          const uploadRes = await uploadDocument(selectedPdfFile, { signal });
          const cleanId = sanitizeSourceId(uploadRes.source_id || uploadRes.document_id);
          if (!cleanId) {
            throw new Error('Backend did not return a valid document ID.');
          }

          const resolvedStatus: SourceProcessingStatus =
            uploadRes.status === 'processing'
              ? 'processing'
              : uploadRes.status === 'failed'
              ? 'failed'
              : 'completed';

          if (resolvedStatus === 'failed') {
            throw new Error(uploadRes.message || 'Document processing failed.');
          }

          currentSource = {
            source_id: cleanId,
            source_type: 'document',
            title: uploadRes.filename,
            status: resolvedStatus,
            filename: uploadRes.filename,
            character_count: uploadRes.character_count,
            chunk_count: uploadRes.chunk_count ?? 0,
            vector_count: uploadRes.vector_count ?? 0,
            page_count: uploadRes.page_count,
            preview: uploadRes.preview,
            message: uploadRes.message,
          };

          if (mountedRef.current) {
            setActiveSource(currentSource);
            setSelectedPdfFile(null);
          }

          if (resolvedStatus === 'processing') {
            updateStage('ingest', 'completed', 'PDF uploaded and text extracted', {
              afterId: 'ingest',
              stage: {
                id: 'index',
                label: 'Indexing content in Pinecone',
                detail: 'Waiting for vector indexing confirmation…',
                status: 'active',
              },
            });
          } else {
            updateStage(
              'ingest',
              'completed',
              `Extracted ${uploadRes.page_count} page(s) · ${uploadRes.vector_count ?? uploadRes.chunk_count ?? 0} vectors indexed`
            );
          }
        } else if (validation.normalizedUrl) {
          const ingestRes = await ingestUrl(validation.normalizedUrl, { signal });
          const cleanId = sanitizeSourceId(ingestRes.source_id);
          if (!cleanId) {
            throw new Error('Backend did not return a valid source ID.');
          }

          if (ingestRes.status === 'failed') {
            throw new Error(ingestRes.message || 'Source ingestion failed.');
          }

          currentSource = {
            source_id: cleanId,
            source_type: ingestRes.source_type || (sourceTab === 'github' ? 'github' : 'url'),
            title: ingestRes.title || validation.normalizedUrl,
            status: ingestRes.status || 'completed',
            url: ingestRes.url || validation.normalizedUrl,
            character_count: ingestRes.character_count,
            chunk_count: ingestRes.chunk_count,
            vector_count: ingestRes.vector_count,
            preview: ingestRes.preview,
            message: ingestRes.message,
          };

          if (mountedRef.current) {
            setActiveSource(currentSource);
          }

          if (currentSource.status === 'processing') {
            updateStage('ingest', 'completed', 'Source fetched successfully', {
              afterId: 'ingest',
              stage: {
                id: 'index',
                label: 'Indexing content in Pinecone',
                detail: 'Waiting for embeddings and Pinecone upsert…',
                status: 'active',
              },
            });
          } else {
            updateStage(
              'ingest',
              'completed',
              `Indexed ${ingestRes.chunk_count || 0} chunks (${ingestRes.vector_count || 0} vectors)`
            );
          }
        }
      }

      if (!currentSource) {
        throw new Error('Unable to resolve an active source. Please select a source and try again.');
      }

      // Stage 1b: Poll if backend returned processing status
      if (currentSource.status === 'processing') {
        activeStageId = 'index';
        currentSource = await pollSourceUntilReady(currentSource.source_id, signal);
        if (mountedRef.current) {
          setActiveSource(currentSource);
        }
        updateStage(
          'index',
          'completed',
          `Confirmed ${currentSource.vector_count ?? currentSource.chunk_count ?? 0} vectors in Pinecone`
        );
      }

      const cleanSourceId = sanitizeSourceId(currentSource.source_id);

      // Stage 2: Generate interview questions
      activeStageId = 'generate';
      updateStage(
        'generate',
        'active',
        `Synthesizing ${questionCount} grounded questions via Ollama…`
      );

      const questionsResponse = await generateSourceQuestions(
        cleanSourceId,
        {
          source_id: cleanSourceId,
          count: questionCount,
          role: 'General Technical Interview',
          experience_level: 'Intermediate',
          difficulty: 'Medium',
          question_type: 'Technical',
          topic: currentSource.title,
          force_regenerate: true,
        },
        { signal }
      );

      if (!questionsResponse.questions || questionsResponse.questions.length === 0) {
        throw new Error('No interview questions were returned by the AI model. Please retry.');
      }

      updateStage(
        'generate',
        'completed',
        `Generated ${questionsResponse.questions.length} grounded questions`
      );

      // Stage 3: Create interview session & navigate
      activeStageId = 'session';
      updateStage('session', 'active', 'Creating session and linking source…');

      const session = await createSourceSession(
        {
          role: 'General Technical Interview',
          experience_level: 'Intermediate',
          difficulty: 'Medium',
          topic: currentSource.title,
          question_type: 'Technical',
          total_questions: questionsResponse.questions.length,
          source_id: cleanSourceId,
          questions: questionsResponse.questions.map((q) => ({
            id: q.id,
            question: q.question,
            expected_answer_points: q.expected_answer_points,
            follow_up_question: q.follow_up_question,
            difficulty: q.difficulty,
            topic: q.topic,
          })),
        },
        { signal }
      );

      updateStage('session', 'completed', 'Session ready');

      if (mountedRef.current && !signal.aborted) {
        navigate(`/practice/${session.session_id}`);
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      if (isRequestAborted(err)) {
        return;
      }

      const msg = formatSourceApiError(
        err,
        'Failed to process source and generate questions. Verify backend, Pinecone, and Ollama are running.'
      );
      updateStage(activeStageId, 'error', msg);
      setSubmissionError(msg);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const isSourceReady =
    Boolean(activeSource) ||
    (sourceTab === 'document' && Boolean(selectedPdfFile)) ||
    ((sourceTab === 'github' || sourceTab === 'url') && urlValue.trim().length > 0);

  function getSourceTypeLabel(type: SourceType): string {
    if (type === 'github') return 'GitHub Repository';
    if (type === 'url') return 'Webpage URL';
    return 'PDF Document';
  }

  return (
    <div className="page-container-narrow animate-fade-in" id="source-interview-page">
      <div className="page-header">
        <div className="page-header-text">
          <h2 className="page-title">Document & GitHub RAG Interview</h2>
          <p className="page-subtitle">
            Provide a PDF resume, GitHub repository, or documentation URL. We will index the content,
            generate grounded interview questions, and launch your practice session automatically.
          </p>
        </div>
      </div>

      <form className="rag-workflow-form" onSubmit={handleSubmit} noValidate>
        {/* Step 1: Select Source */}
        <section className="surface-card rag-step-card" id="rag-source-selection-section">
          <div className="rag-step-header">
            <span className="rag-step-badge">1</span>
            <div className="rag-step-title-group">
              <h3 className="rag-step-title">
                {activeSource ? 'Selected Source' : 'Select Source'}
              </h3>
              <p className="rag-step-desc">
                {activeSource
                  ? 'This source is indexed and ready for question generation.'
                  : 'Choose a PDF document, GitHub repository URL, or supported public webpage.'}
              </p>
            </div>
          </div>

          {activeSource ? (
            <div className="active-source-panel" id="active-source-card">
              <div className="active-source-left">
                <div className="active-source-icon" aria-hidden="true">
                  {activeSource.source_type === 'github' ? (
                    <GitBranchIcon size={18} />
                  ) : activeSource.source_type === 'url' ? (
                    <GlobeIcon size={18} />
                  ) : (
                    <FileTextIcon size={18} />
                  )}
                </div>
                <div className="active-source-info">
                  <div className="active-source-title-row">
                    <span className="active-source-title" title={activeSource.title}>
                      {activeSource.title}
                    </span>
                    <span className="badge badge-success">
                      <CheckCircleIcon size={12} />
                      <span>Ready</span>
                    </span>
                  </div>
                  <div className="active-source-meta">
                    <span>{getSourceTypeLabel(activeSource.source_type)}</span>
                    {typeof activeSource.chunk_count === 'number' && activeSource.chunk_count > 0 && (
                      <span>· {activeSource.chunk_count} chunks</span>
                    )}
                    {typeof activeSource.page_count === 'number' && activeSource.page_count > 0 && (
                      <span>· {activeSource.page_count} pages</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearSource}
                disabled={isSubmitting}
                id="clear-source-btn"
              >
                <RefreshIcon size={13} />
                <span>Change Source</span>
              </button>
            </div>
          ) : (
            <div className="source-selector-body">
              <div className="source-type-tabs" role="tablist" aria-label="Source type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceTab === 'document'}
                  className={`source-tab-btn ${sourceTab === 'document' ? 'is-active' : ''}`}
                  onClick={() => handleTabChange('document')}
                  disabled={isSubmitting}
                  id="tab-source-pdf"
                >
                  <FileTextIcon size={15} />
                  <span>PDF Document</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceTab === 'github'}
                  className={`source-tab-btn ${sourceTab === 'github' ? 'is-active' : ''}`}
                  onClick={() => handleTabChange('github')}
                  disabled={isSubmitting}
                  id="tab-source-github"
                >
                  <GitBranchIcon size={15} />
                  <span>GitHub Repository</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceTab === 'url'}
                  className={`source-tab-btn ${sourceTab === 'url' ? 'is-active' : ''}`}
                  onClick={() => handleTabChange('url')}
                  disabled={isSubmitting}
                  id="tab-source-url"
                >
                  <GlobeIcon size={15} />
                  <span>Public URL</span>
                </button>
              </div>

              {sourceTab === 'document' ? (
                <PDFUpload
                  selectedFile={selectedPdfFile}
                  onFileSelected={(file) => {
                    setSelectedPdfFile(file);
                    setSourceValidationError(null);
                    setSubmissionError(null);
                  }}
                  disabled={isSubmitting}
                  externalError={sourceValidationError}
                />
              ) : (
                <URLInput
                  mode={sourceTab}
                  value={urlValue}
                  onChange={(val) => {
                    setUrlValue(val);
                    if (sourceValidationError) setSourceValidationError(null);
                    if (submissionError) setSubmissionError(null);
                  }}
                  disabled={isSubmitting}
                  validationError={sourceValidationError}
                />
              )}
            </div>
          )}
        </section>

        {/* Step 2: Single Configuration Field — Question Count */}
        <section className="surface-card rag-step-card" id="rag-config-section">
          <div className="rag-step-header">
            <span className="rag-step-badge">2</span>
            <div className="rag-step-title-group">
              <h3 className="rag-step-title">How many interview questions do you want?</h3>
              <p className="rag-step-desc">
                Select the number of grounded questions to generate from your source.
              </p>
            </div>
          </div>

          <div
            className="rag-count-grid"
            role="radiogroup"
            aria-label="How many interview questions do you want?"
          >
            {QUESTION_COUNT_OPTIONS.map((count) => {
              const selected = questionCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`rag-count-option ${selected ? 'is-selected' : ''}`}
                  onClick={() => setQuestionCount(count)}
                  disabled={isSubmitting}
                  id={`count-option-${count}`}
                >
                  <span className="rag-count-num">{count}</span>
                  <span className="rag-count-label">Questions</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 4: Honest Progress Tracker */}
        {stages && (
          <RagProgressTracker
            stages={stages}
            isSubmitting={isSubmitting}
            onCancel={handleCancelSubmission}
          />
        )}

        {/* Error & Retry Banner */}
        {submissionError && !isSubmitting && (
          <div className="alert-banner alert-banner-error animate-fade-in" role="alert" id="auto-questions-error">
            <AlertCircleIcon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div className="alert-banner-body">
              <div className="alert-banner-title">Unable to generate interview</div>
              <div>{submissionError}</div>
              <div className="alert-banner-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSubmit()}
                  id="retry-auto-generation-btn"
                >
                  <RefreshIcon size={13} />
                  <span>Retry</span>
                </button>
                {activeSource && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearSource}
                    id="replace-source-on-error-btn"
                  >
                    Change Source
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Single Primary Submit CTA */}
        <div className="rag-submit-row">
          <button
            type="submit"
            className="btn btn-primary btn-lg rag-submit-btn"
            disabled={isSubmitting || !isSourceReady}
            id="rag-submit-btn"
          >
            {isSubmitting ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                <span>Generating Interview Questions…</span>
              </>
            ) : (
              <>
                <SparklesIcon size={16} />
                <span>Generate Interview Questions</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
