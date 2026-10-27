/**
 * TypeScript types matching the backend Pydantic schemas.
 * Source: BackEnd/app/schemas/interview.py
 *
 * These types mirror the exact request/response shapes from:
 *   POST /api/v1/interview/question
 *   POST /api/v1/interview/evaluate
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/** Candidate experience level — maps to backend ExperienceLevel enum */
export type ExperienceLevel = 'Fresher' | 'Junior' | 'Mid-Level' | 'Senior';

/** Question difficulty level — maps to backend DifficultyLevel enum */
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

/** Type of interview question — maps to backend QuestionType enum */
export type QuestionType = 'Technical' | 'Scenario-Based' | 'Behavioral';

/** Categorical performance rating — maps to backend EvaluationRating enum */
export type EvaluationRating = 'Needs Improvement' | 'Fair' | 'Good' | 'Excellent';

// ─── Question Generation ─────────────────────────────────────────────────────

/** POST /api/v1/interview/question — request body */
export interface InterviewQuestionRequest {
  role: string;
  experience_level: ExperienceLevel;
  difficulty: DifficultyLevel;
  topic: string;
  question_type: QuestionType;
}

/** POST /api/v1/interview/question — response body */
export interface InterviewQuestionResponse {
  question: string;
  expected_answer_points: string[];
  follow_up_question: string;
  difficulty: DifficultyLevel;
  topic: string;
}

// ─── Answer Evaluation ───────────────────────────────────────────────────────

/** POST /api/v1/interview/evaluate — request body */
export interface InterviewEvaluationRequest {
  question: string;
  expected_answer_points: string[];
  candidate_answer: string;
}

/** POST /api/v1/interview/evaluate — response body */
export interface InterviewEvaluationResponse {
  overall_score: number;
  rating: EvaluationRating;
  correct_points: string[];
  missing_points: string[];
  strengths: string[];
  improvements: string[];
  sample_answer: string;
}
