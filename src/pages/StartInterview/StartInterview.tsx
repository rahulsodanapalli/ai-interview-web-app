import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, getNextQuestion } from '../../api/sessionService';
import { generateQuestion } from '../../api/interviewService';
import type {
  CreateSessionRequest,
  ExperienceLevel,
  DifficultyLevel,
  QuestionType,
  SessionNextQuestionResponse,
  InterviewQuestionResponse,
  SessionDetailResponse,
} from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import './StartInterview.css';

// Popular quick-select presets for instant interview setup
const POPULAR_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Engineer',
  'DevOps Engineer',
  'Data Engineer',
];

const POPULAR_TOPICS: Record<string, string[]> = {
  'Frontend Developer': ['React Hooks & State', 'CSS Grid & Flexbox', 'Browser Performance', 'TypeScript Generics'],
  'Backend Developer': ['REST API Design', 'Database Indexing', 'Concurrency & Threads', 'Microservices Architecture'],
  'Full Stack Engineer': ['System Design', 'Authentication & JWT', 'State Management', 'SQL vs NoSQL'],
  'DevOps Engineer': ['CI/CD Pipelines', 'Docker & Containerization', 'Kubernetes Orchestration', 'Infrastructure as Code'],
  'Data Engineer': ['ETL Pipeline Design', 'Apache Spark', 'Data Warehousing & Star Schema', 'SQL Query Optimization'],
};

const DEFAULT_TOPICS = [
  'System Design',
  'Data Structures & Algorithms',
  'React Hooks',
  'Database Indexing',
  'REST & GraphQL APIs',
];

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

  // Form state
  const [formData, setFormData] = useState<CreateSessionRequest>({
    role: '',
    experience_level: 'Junior',
    difficulty: 'Medium',
    topic: '',
    question_type: 'Technical',
    total_questions: 5,
  });

  // Track whether to persist as a full session
  const [persistSession, setPersistSession] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState<{ role?: string; topic?: string }>({});

  // Submission & API state
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [apiError, setApiError] = useState<string>('');
  const [canRetry, setCanRetry] = useState(false);

  // Result state
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [showRubric, setShowRubric] = useState(false);

  // Quick chip topics based on selected role
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
      newErrors.topic = 'Topic is required.';
    } else if (formData.topic.trim().length < 2) {
      newErrors.topic = 'Topic must be at least 2 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'total_questions' ? Number(value) : value,
    }));

    // Clear inline error on change
    if (errors[name as 'role' | 'topic']) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function handleSelectRole(role: string) {
    setFormData((prev) => ({ ...prev, role }));
    if (errors.role) {
      setErrors((prev) => ({ ...prev, role: undefined }));
    }
  }

  function handleSelectTopic(topic: string) {
    setFormData((prev) => ({ ...prev, topic }));
    if (errors.topic) {
      setErrors((prev) => ({ ...prev, topic: undefined }));
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setApiError('');
    setCanRetry(false);

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      if (persistSession) {
        // Step 1: Initialize database session
        setLoadingStep('Initializing interview session in database…');
        const session: SessionDetailResponse = await createSession({
          role: formData.role.trim(),
          experience_level: formData.experience_level,
          difficulty: formData.difficulty,
          topic: formData.topic.trim(),
          question_type: formData.question_type,
          total_questions: formData.total_questions,
        });

        // Step 2: Generate first question using Qwen 2.5 via Ollama
        setLoadingStep('Generating tailored question with local AI (Qwen 2.5)…');
        const qData: SessionNextQuestionResponse = await getNextQuestion(session.session_id);

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
        // Standalone question generation
        setLoadingStep('Generating question with local AI (Qwen 2.5)…');
        const qData: InterviewQuestionResponse = await generateQuestion({
          role: formData.role.trim(),
          experience_level: formData.experience_level,
          difficulty: formData.difficulty,
          topic: formData.topic.trim(),
          question_type: formData.question_type,
        });

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
      setCanRetry(true);
      let errorMsg = 'Failed to generate question. Check if the backend and Ollama are running.';
      if (err && typeof err === 'object') {
        if ('response' in err) {
          const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
          const status = axiosErr.response?.status;
          const detail = axiosErr.response?.data?.detail;

          if (status === 503) {
            errorMsg = detail || 'AI service unavailable: Please verify Ollama is running with qwen2.5:1.5b.';
          } else if (status === 502) {
            errorMsg = detail || 'AI model error: Failed to generate a valid question response.';
          } else if (detail) {
            errorMsg = detail;
          }
        } else if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
          const msg = (err as { message: string }).message;
          if (msg.includes('timeout') || msg.includes('timed out')) {
            errorMsg = 'Request timed out waiting for the local AI model. Ollama may be loading the model or busy.';
          } else if (msg.includes('Network Error')) {
            errorMsg = 'Network error: Cannot reach the backend API. Please verify the FastAPI server is running on port 8000.';
          } else {
            errorMsg = msg;
          }
        }
      }
      setApiError(errorMsg);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  function handleReset() {
    setResult(null);
    setApiError('');
    setShowRubric(false);
  }

  return (
    <div className="start-interview animate-fade-in" id="start-interview-page">
      <div className="start-header">
        <h2 className="start-title">
          Configure Your <span className="gradient-text">Interview Session</span>
        </h2>
        <p className="start-subtitle">
          Select your target role, experience, and domain. Our local AI will craft an authentic,
          tailored interview question designed to test real-world depth.
        </p>
      </div>

      {/* If a question was successfully generated, display it */}
      {result ? (
        <div className="question-result-container animate-fade-in" id="question-result-card">
          <div className="result-card glass-card">
            {/* Header / Badges */}
            <div className="result-header">
              <div className="result-meta-badges">
                <span className={`badge badge-diff badge-diff-${result.difficulty.toLowerCase()}`} id="result-difficulty-badge">
                  {result.difficulty}
                </span>
                <span className="badge badge-info" id="result-type-badge">
                  {result.questionType}
                </span>
                <span className="badge badge-neutral" id="result-level-badge">
                  {result.experienceLevel}
                </span>
                <span className="badge badge-primary" id="result-topic-badge">
                  📌 {result.topic}
                </span>
              </div>

              {result.sessionId && (
                <div className="result-session-tag">
                  <span className="session-indicator-dot"></span>
                  Session Question {result.questionNumber} of {result.totalQuestions}
                </div>
              )}
            </div>

            {/* Question Text */}
            <div className="result-question-body">
              <span className="result-label">Generated Interview Question</span>
              <h3 className="result-question-text" id="generated-question-text">
                {result.question}
              </h3>
            </div>

            {/* Follow-up question if provided */}
            {result.followUpQuestion && (
              <div className="result-followup glass-card" id="follow-up-card">
                <div className="followup-header">
                  <span className="followup-icon">💡</span>
                  <span className="followup-title">Interviewer Follow-up Probe</span>
                </div>
                <p className="followup-text" id="follow-up-text">
                  {result.followUpQuestion}
                </p>
                <span className="followup-note">
                  Be prepared to address this probe after your initial response.
                </span>
              </div>
            )}

            {/* Expected Answer Points (Hidden Evaluation Rubric) */}
            {result.expectedAnswerPoints && result.expectedAnswerPoints.length > 0 && (
              <div className="rubric-disclosure" id="rubric-disclosure">
                <button
                  type="button"
                  className="rubric-toggle-btn"
                  onClick={() => setShowRubric((prev) => !prev)}
                  id="toggle-rubric-btn"
                  aria-expanded={showRubric}
                >
                  <span>{showRubric ? '🔒 Hide' : '👁️ View'} Evaluation Criteria (Interviewer Guide)</span>
                  <span className={`rubric-arrow ${showRubric ? 'open' : ''}`}>▼</span>
                </button>

                {showRubric && (
                  <div className="rubric-content animate-fade-in" id="rubric-content">
                    <p className="rubric-warning">
                      ⚠️ <em>Hidden during practice to simulate authentic interview pressure.</em> The AI grader evaluates your answer against these key points:
                    </p>
                    <ul className="rubric-list">
                      {result.expectedAnswerPoints.map((point, idx) => (
                        <li key={idx} className="rubric-item">
                          <span className="rubric-check">✓</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="result-actions">
              {result.sessionId ? (
                <button
                  type="button"
                  className="btn btn-primary btn-lg result-cta-btn"
                  onClick={() => navigate(`/practice/${result.sessionId}`)}
                  id="go-to-practice-btn"
                >
                  🚀 Enter Interactive Practice Room →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-lg result-cta-btn"
                  onClick={() => {
                    setPersistSession(true);
                    handleSubmit();
                  }}
                  id="convert-to-session-btn"
                >
                  💾 Save to Session & Practice
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
                id="generate-another-btn"
              >
                ⚙️ Configure New Question
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Configuration Form */
        <form className="session-form glass-card" onSubmit={handleSubmit} id="session-form" noValidate>
          {/* Row 1: Role */}
          <div className="form-group">
            <div className="label-with-hint">
              <label htmlFor="role" className="form-label">Job Role *</label>
              <span className="field-hint">e.g. Frontend Developer, Backend Engineer</span>
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
              <span className="field-error" id="role-error" role="alert">
                {errors.role}
              </span>
            )}

            {/* Quick role presets */}
            <div className="quick-chips">
              <span className="quick-chips-label">Quick select:</span>
              {POPULAR_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`chip ${formData.role === r ? 'chip-active' : ''}`}
                  onClick={() => handleSelectRole(r)}
                  disabled={loading}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Topic */}
          <div className="form-group">
            <div className="label-with-hint">
              <label htmlFor="topic" className="form-label">Interview Topic *</label>
              <span className="field-hint">Specific technology or domain concept</span>
            </div>
            <input
              type="text"
              id="topic"
              name="topic"
              className={`form-input ${errors.topic ? 'input-error' : ''}`}
              placeholder="e.g. React Hooks, System Design, SQL Indexing…"
              value={formData.topic}
              onChange={handleChange}
              maxLength={100}
              disabled={loading}
              required
            />
            {errors.topic && (
              <span className="field-error" id="topic-error" role="alert">
                {errors.topic}
              </span>
            )}

            {/* Quick topic presets */}
            <div className="quick-chips">
              <span className="quick-chips-label">Suggested topics:</span>
              {suggestedTopics.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${formData.topic === t ? 'chip-active' : ''}`}
                  onClick={() => handleSelectTopic(t)}
                  disabled={loading}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Experience + Difficulty */}
          <div className="form-row">
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
                    {level} {level === 'Fresher' ? '(0–1 yrs)' : level === 'Junior' ? '(1–2 yrs)' : level === 'Mid-Level' ? '(3–5 yrs)' : '(5+ yrs)'}
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
                    {level} {level === 'Easy' ? '🟢' : level === 'Medium' ? '🟡' : '🔴'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Question Type */}
          <div className="form-group">
            <label htmlFor="question_type" className="form-label">
              Question Type
            </label>
            <div className="question-type-grid">
              {questionTypes.map((type) => (
                <label
                  key={type}
                  className={`type-radio-card ${formData.question_type === type ? 'type-radio-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="question_type"
                    value={type}
                    checked={formData.question_type === type}
                    onChange={handleChange}
                    disabled={loading}
                    className="visually-hidden"
                  />
                  <span className="type-title">
                    {type === 'Technical' && '💻 Technical'}
                    {type === 'Scenario-Based' && '🏗️ Scenario-Based'}
                    {type === 'Behavioral' && '🤝 Behavioral'}
                  </span>
                  <span className="type-desc">
                    {type === 'Technical' && 'Core algorithms, language internals & APIs'}
                    {type === 'Scenario-Based' && 'Architecture trade-offs, debugging & scale'}
                    {type === 'Behavioral' && 'Team dynamics, leadership & past impact'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Row 5: Session Persistence & Question Count */}
          <div className="session-options-box glass-card">
            <div className="session-toggle-row">
              <label className="checkbox-container" htmlFor="persist-session-toggle">
                <input
                  type="checkbox"
                  id="persist-session-toggle"
                  checked={persistSession}
                  onChange={(e) => setPersistSession(e.target.checked)}
                  disabled={loading}
                />
                <span className="checkbox-checkmark"></span>
                <span className="checkbox-label">
                  <strong>Track Interview Session</strong> — Save question history and progress to database
                </span>
              </label>
            </div>

            {persistSession && (
              <div className="form-group questions-slider-group animate-fade-in">
                <div className="slider-header">
                  <label htmlFor="total_questions" className="form-label">
                    Total Session Questions
                  </label>
                  <span className="slider-value-pill">{formData.total_questions} Questions</span>
                </div>
                <input
                  type="range"
                  id="total_questions"
                  name="total_questions"
                  className="form-range"
                  min={1}
                  max={20}
                  value={formData.total_questions}
                  onChange={handleChange}
                  disabled={loading}
                />
                <div className="range-labels">
                  <span>1 (Quick test)</span>
                  <span>5 (Standard)</span>
                  <span>10 (Full mock)</span>
                  <span>20 (Marathon)</span>
                </div>
              </div>
            )}
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="generating-indicator glass-card animate-fade-in" id="generation-spinner">
              <LoadingSpinner message={loadingStep || 'AI is crafting your interview question…'} size="md" />
              <p className="generating-subtext">
                Using local <strong>Qwen 2.5</strong> on Ollama. Structured JSON generation takes ~5–15 seconds.
              </p>
            </div>
          )}

          {/* Error Banner with Retry */}
          {apiError && !loading && (
            <div className="form-error" role="alert" id="form-error">
              <div className="error-icon-box">⚠️</div>
              <div className="error-content-box">
                <strong>Question Generation Error:</strong>
                <p>{apiError}</p>
                {canRetry && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm retry-btn"
                    onClick={() => handleSubmit()}
                    id="retry-generation-btn"
                  >
                    🔄 Retry Generation
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary btn-lg start-submit-btn"
            disabled={loading}
            id="create-session-btn"
          >
            {loading ? (
              <>
                <span className="btn-spinner"></span>
                Generating AI Question…
              </>
            ) : (
              <>✨ Generate AI Question & Start Practice</>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
