import { useState, useRef, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, getNextQuestion } from '../../api/sessionService';
import { generateQuestion } from '../../api/interviewService';
import { formatApiError, isRequestAborted } from '../../utils/error';
import { getDifficultyBadgeClass } from '../../utils/format';
import {
  SparklesIcon,
  FileTextIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  RefreshIcon,
  ChevronDownIcon,
  CheckIcon,
  PlayIcon,
} from '../../components/ui/Icons';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import type {
  CreateSessionRequest,
  ExperienceLevel,
  DifficultyLevel,
  QuestionType,
  SessionNextQuestionResponse,
  InterviewQuestionResponse,
  SessionDetailResponse,
} from '../../types';
import './StartInterview.css';

const POPULAR_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Engineer',
  'DevOps Engineer',
  'Data Engineer',
];

const POPULAR_TOPICS: Record<string, string[]> = {
  'Frontend Developer': ['React Hooks', 'CSS Grid & Flexbox', 'Browser Performance', 'TypeScript Generics'],
  'Backend Developer': ['REST API Design', 'Database Indexing', 'Concurrency & Threads', 'Microservices Architecture'],
  'Full Stack Engineer': ['System Design', 'Authentication & JWT', 'State Management', 'SQL vs NoSQL'],
  'DevOps Engineer': ['CI/CD Pipelines', 'Docker & Containerization', 'Kubernetes Orchestration', 'Infrastructure as Code'],
  'Data Engineer': ['ETL Pipeline Design', 'Apache Spark', 'Data Warehousing', 'SQL Query Optimization'],
};

const DEFAULT_TOPICS = [
  'System Design',
  'Data Structures & Algorithms',
  'React Hooks',
  'Database Indexing',
];

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;

interface GeneratedResult {
  question: string;
  topic: string;
  difficulty: DifficultyLevel;
  questionType: QuestionType;
  experienceLevel: ExperienceLevel;
  followUpQuestion?: string | null;
  expectedAnswerPoints?: string[];
  sessionId?: string;
  questionNumber?: number;
  totalQuestions?: number;
}

export default function StartInterview() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<CreateSessionRequest>({
    role: '',
    experience_level: 'Junior',
    difficulty: 'Medium',
    topic: '',
    question_type: 'Technical',
    total_questions: 5,
  });

  const [persistSession, setPersistSession] = useState(true);
  const [errors, setErrors] = useState<{ role?: string; topic?: string }>({});

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [apiError, setApiError] = useState('');
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [showRubric, setShowRubric] = useState(false);

  const isSubmittingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const suggestedTopics = POPULAR_TOPICS[formData.role] || DEFAULT_TOPICS;
  const experienceLevels: ExperienceLevel[] = ['Fresher', 'Junior', 'Mid-Level', 'Senior'];
  const difficultyLevels: DifficultyLevel[] = ['Easy', 'Medium', 'Hard'];
  const questionTypes: QuestionType[] = ['Technical', 'Scenario-Based', 'Behavioral'];

  function validate(): boolean {
    const newErrors: { role?: string; topic?: string } = {};

    if (!formData.role.trim()) {
      newErrors.role = 'Job role is required.';
    } else if (formData.role.trim().length < 2) {
      newErrors.role = 'Job role must be at least 2 characters.';
    }

    if (!formData.topic.trim()) {
      newErrors.topic = 'Interview topic is required.';
    } else if (formData.topic.trim().length < 2) {
      newErrors.topic = 'Interview topic must be at least 2 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'total_questions' ? Number(value) : value,
    }));

    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    setApiError('');
  }

  function handleSelectRole(role: string) {
    setFormData((prev) => ({ ...prev, role }));
    if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
    setApiError('');
  }

  function handleSelectTopic(topic: string) {
    setFormData((prev) => ({ ...prev, topic }));
    if (errors.topic) setErrors((prev) => ({ ...prev, topic: undefined }));
    setApiError('');
  }

  async function runGeneration(forceSession: boolean) {
    if (isSubmittingRef.current || loading) return;
    if (!validate()) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    isSubmittingRef.current = true;
    setLoading(true);
    setApiError('');

    try {
      if (forceSession) {
        setLoadingStep('Creating interview session…');
        const session: SessionDetailResponse = await createSession(
          {
            role: formData.role.trim(),
            experience_level: formData.experience_level,
            difficulty: formData.difficulty,
            topic: formData.topic.trim(),
            question_type: formData.question_type,
            total_questions: formData.total_questions,
          },
          { signal }
        );

        if (!mountedRef.current || signal.aborted) return;

        setLoadingStep('Generating first interview question via Ollama…');
        const qData: SessionNextQuestionResponse = await getNextQuestion(session.session_id, { signal });

        if (!mountedRef.current || signal.aborted) return;

        setResult({
          question: qData.question,
          topic: qData.topic,
          difficulty: qData.difficulty,
          questionType: formData.question_type,
          experienceLevel: formData.experience_level,
          followUpQuestion: qData.follow_up_question,
          expectedAnswerPoints: qData.expected_answer_points,
          sessionId: session.session_id,
          questionNumber: qData.question_number,
          totalQuestions: qData.total_questions,
        });
      } else {
        setLoadingStep('Generating interview question via Ollama…');
        const qData: InterviewQuestionResponse = await generateQuestion(
          {
            role: formData.role.trim(),
            experience_level: formData.experience_level,
            difficulty: formData.difficulty,
            topic: formData.topic.trim(),
            question_type: formData.question_type,
          },
          { signal }
        );

        if (!mountedRef.current || signal.aborted) return;

        setResult({
          question: qData.question,
          topic: qData.topic,
          difficulty: qData.difficulty,
          questionType: formData.question_type,
          experienceLevel: formData.experience_level,
          followUpQuestion: qData.follow_up_question,
          expectedAnswerPoints: qData.expected_answer_points,
        });
      }
    } catch (err: unknown) {
      if (!mountedRef.current || isRequestAborted(err)) return;
      setApiError(
        formatApiError(err, 'Failed to generate question. Check that FastAPI and Ollama are running.')
      );
    } finally {
      if (mountedRef.current) {
        isSubmittingRef.current = false;
        setLoading(false);
        setLoadingStep('');
      }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runGeneration(persistSession);
  }

  function handleReset() {
    setResult(null);
    setApiError('');
    setShowRubric(false);
  }

  return (
    <div className="page-container-narrow animate-fade-in" id="start-interview-page">
      <div className="page-header">
        <div className="page-header-text">
          <h2 className="page-title">Configure AI Interview</h2>
          <p className="page-subtitle">
            Set your target role, technical focus, and difficulty to start an interactive interview session.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/rag')}
          id="hero-switch-rag-btn"
        >
          <FileTextIcon size={14} />
          <span>Use Document or GitHub RAG</span>
          <ArrowRightIcon size={13} />
        </button>
      </div>

      {result ? (
        <div className="surface-card start-result-card animate-fade-in" id="question-result-card">
          <div className="start-result-header">
            <div className="start-result-badges">
              <span className={`badge ${getDifficultyBadgeClass(result.difficulty)}`}>
                {result.difficulty}
              </span>
              <span className="badge badge-info">{result.questionType}</span>
              <span className="badge badge-neutral">{result.experienceLevel}</span>
              <span className="badge badge-primary">{result.topic}</span>
            </div>

            {result.sessionId && (
              <span className="badge badge-neutral">
                Question {result.questionNumber} of {result.totalQuestions}
              </span>
            )}
          </div>

          <div className="start-result-question">
            <span className="result-eyebrow">Generated Interview Question</span>
            <h3 className="result-question-headline" id="generated-question-text">
              {result.question}
            </h3>
          </div>

          {result.followUpQuestion && (
            <div className="start-followup-box" id="follow-up-card">
              <span className="followup-label">Follow-up Probe</span>
              <p className="followup-body">{result.followUpQuestion}</p>
            </div>
          )}

          {result.expectedAnswerPoints && result.expectedAnswerPoints.length > 0 && (
            <div className="start-rubric-box">
              <button
                type="button"
                className="rubric-disclosure-btn"
                onClick={() => setShowRubric((prev) => !prev)}
                aria-expanded={showRubric}
              >
                <span>
                  {showRubric ? 'Hide' : 'View'} Evaluation Criteria ({result.expectedAnswerPoints.length})
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
                <ul className="rubric-criteria-list animate-fade-in">
                  {result.expectedAnswerPoints.map((point, idx) => (
                    <li key={idx}>
                      <CheckIcon size={14} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="start-result-actions">
            {result.sessionId ? (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => navigate(`/practice/${result.sessionId}`)}
                id="go-to-practice-btn"
              >
                <PlayIcon size={15} />
                <span>Enter Practice Room</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  setPersistSession(true);
                  void runGeneration(true);
                }}
                id="convert-to-session-btn"
              >
                <PlayIcon size={15} />
                <span>Create Session & Practice</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              id="generate-another-btn"
            >
              Configure Another
            </button>
          </div>
        </div>
      ) : (
        <form className="start-config-form" onSubmit={handleSubmit} id="session-form" noValidate>
          <div className="surface-card config-panel">
            {/* Role */}
            <div className="form-group">
              <div className="label-row">
                <label htmlFor="role" className="form-label">
                  Target Job Role <span className="required-mark">*</span>
                </label>
                <span className="form-hint">e.g. Backend Developer, Full Stack Engineer</span>
              </div>
              <input
                type="text"
                id="role"
                name="role"
                className={`form-input ${errors.role ? 'input-error' : ''}`}
                placeholder="Enter target job role…"
                value={formData.role}
                onChange={handleChange}
                maxLength={100}
                disabled={loading}
                required
              />
              {errors.role && (
                <span className="field-error-text" role="alert">
                  <AlertCircleIcon size={13} />
                  <span>{errors.role}</span>
                </span>
              )}

              <div className="chip-row">
                <span className="chip-row-label">Popular:</span>
                {POPULAR_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`select-chip ${formData.role === r ? 'is-active' : ''}`}
                    onClick={() => handleSelectRole(r)}
                    disabled={loading}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-divider" />

            {/* Topic */}
            <div className="form-group">
              <div className="label-row">
                <label htmlFor="topic" className="form-label">
                  Interview Topic <span className="required-mark">*</span>
                </label>
                <span className="form-hint">Core skill, technology, or architecture area</span>
              </div>
              <input
                type="text"
                id="topic"
                name="topic"
                className={`form-input ${errors.topic ? 'input-error' : ''}`}
                placeholder="e.g. System Design, React Hooks, Database Indexing…"
                value={formData.topic}
                onChange={handleChange}
                maxLength={100}
                disabled={loading}
                required
              />
              {errors.topic && (
                <span className="field-error-text" role="alert">
                  <AlertCircleIcon size={13} />
                  <span>{errors.topic}</span>
                </span>
              )}

              <div className="chip-row">
                <span className="chip-row-label">Suggested:</span>
                {suggestedTopics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`select-chip ${formData.topic === t ? 'is-active' : ''}`}
                    onClick={() => handleSelectTopic(t)}
                    disabled={loading}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-divider" />

            {/* Experience & Difficulty */}
            <div className="two-col-grid">
              <div className="form-group">
                <label htmlFor="experience_level" className="form-label">
                  Experience Level
                </label>
                <select
                  id="experience_level"
                  name="experience_level"
                  className="form-select"
                  value={formData.experience_level}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {experienceLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}{' '}
                      {level === 'Fresher'
                        ? '(0–1 yrs)'
                        : level === 'Junior'
                        ? '(1–2 yrs)'
                        : level === 'Mid-Level'
                        ? '(3–5 yrs)'
                        : '(5+ yrs)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="difficulty" className="form-label">
                  Difficulty Level
                </label>
                <select
                  id="difficulty"
                  name="difficulty"
                  className="form-select"
                  value={formData.difficulty}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {difficultyLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="panel-divider" />

            {/* Question Category & Question Count */}
            <div className="two-col-grid">
              <div className="form-group">
                <span className="form-label">Question Category</span>
                <div className="segmented-control" role="radiogroup" aria-label="Question Category">
                  {questionTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={formData.question_type === type}
                      className={`segment-btn ${formData.question_type === type ? 'is-active' : ''}`}
                      onClick={() => setFormData((prev) => ({ ...prev, question_type: type }))}
                      disabled={loading}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <span className="form-label">Number of Questions</span>
                <div className="segmented-control" role="radiogroup" aria-label="Number of Questions">
                  {QUESTION_COUNT_OPTIONS.map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      role="radio"
                      aria-checked={formData.total_questions === cnt}
                      className={`segment-btn ${formData.total_questions === cnt ? 'is-active' : ''}`}
                      onClick={() => setFormData((prev) => ({ ...prev, total_questions: cnt }))}
                      disabled={loading}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="surface-card start-loading-card animate-fade-in" id="generation-spinner">
              <LoadingSpinner
                message={loadingStep || 'Generating interview question…'}
                subtext="Local AI inference with Ollama typically takes a few seconds."
                size="md"
              />
            </div>
          )}

          {apiError && !loading && (
            <div className="alert-banner alert-banner-error animate-fade-in" role="alert" id="form-error">
              <AlertCircleIcon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div className="alert-banner-body">
                <div className="alert-banner-title">Question generation failed</div>
                <div>{apiError}</div>
                <div className="alert-banner-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void runGeneration(persistSession)}
                    id="retry-generation-btn"
                  >
                    <RefreshIcon size={13} />
                    <span>Retry</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="start-submit-row">
            <button
              type="submit"
              className="btn btn-primary btn-lg start-submit-btn"
              disabled={loading}
              id="create-session-btn"
            >
              {loading ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>Preparing Interview…</span>
                </>
              ) : (
                <>
                  <SparklesIcon size={16} />
                  <span>Start Interview</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
