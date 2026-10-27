/**
 * TypeScript types matching the backend Pydantic schemas.
 * Source: BackEnd/app/schemas/session.py
 *
 * These types mirror the exact request/response shapes from:
 *   POST   /api/v1/interview/sessions
 *   GET    /api/v1/interview/sessions
 *   GET    /api/v1/interview/sessions/:session_id
 *   POST   /api/v1/interview/sessions/:session_id/next-question
 *   POST   /api/v1/interview/sessions/:session_id/answers
 *   POST   /api/v1/interview/sessions/:session_id/complete
 */

import type {
  DifficultyLevel,
  EvaluationRating,
  ExperienceLevel,
  InterviewEvaluationResponse,
  QuestionType,
} from './interview';

// ─── Session Enums ───────────────────────────────────────────────────────────

/** Lifecycle status of an interview session */
export type SessionStatus = 'in_progress' | 'completed';

// ─── Session Creation ────────────────────────────────────────────────────────

/** POST /api/v1/interview/sessions — request body */
export interface CreateSessionRequest {
  role: string;
  experience_level: ExperienceLevel;
  difficulty: DifficultyLevel;
  topic: string;
  question_type: QuestionType;
  total_questions?: number; // defaults to 5, range 1–20
}

// ─── Session Question Item ───────────────────────────────────────────────────

/** A single question within a session, including optional answer and evaluation */
export interface SessionQuestionItem {
  question_number: number;
  question: string;
  expected_answer_points: string[];
  follow_up_question: string | null;
  difficulty: DifficultyLevel;
  topic: string;
  candidate_answer: string | null;
  evaluation: InterviewEvaluationResponse | null;
}

// ─── Session Detail ──────────────────────────────────────────────────────────

/**
 * Full session detail — returned by:
 *   POST /api/v1/interview/sessions (201)
 *   GET  /api/v1/interview/sessions (200, as array)
 *   GET  /api/v1/interview/sessions/:session_id (200)
 */
export interface SessionDetailResponse {
  session_id: string;
  role: string;
  experience_level: ExperienceLevel;
  difficulty: DifficultyLevel;
  topic: string;
  question_type: QuestionType;
  total_questions: number;
  completed_questions: number;
  current_question_number: number;
  status: SessionStatus;
  questions: SessionQuestionItem[];
  created_at: string;
  updated_at: string;
}

// ─── Next Question ───────────────────────────────────────────────────────────

/** POST /api/v1/interview/sessions/:session_id/next-question — response body */
export interface SessionNextQuestionResponse {
  session_id: string;
  question_number: number;
  total_questions: number;
  question: string;
  expected_answer_points: string[];
  follow_up_question: string | null;
  difficulty: DifficultyLevel;
  topic: string;
}

// ─── Submit Answer ───────────────────────────────────────────────────────────

/** POST /api/v1/interview/sessions/:session_id/answers — request body */
export interface SubmitAnswerRequest {
  candidate_answer: string;
  question_number?: number; // optional, targets active unanswered question if omitted
}

/** POST /api/v1/interview/sessions/:session_id/answers — response body */
export interface SessionSubmitAnswerResponse {
  session_id: string;
  question_number: number;
  completed_questions: number;
  total_questions: number;
  status: SessionStatus;
  evaluation: InterviewEvaluationResponse;
}

// ─── Session Completion / Summary ────────────────────────────────────────────

/** POST /api/v1/interview/sessions/:session_id/complete — response body */
export interface InterviewSessionSummaryResponse {
  session_id: string;
  role: string;
  topic: string;
  total_questions: number;
  questions_answered: number;
  average_score: number;
  overall_rating: EvaluationRating;
  aggregated_strengths: string[];
  aggregated_improvement_areas: string[];
  session_status: SessionStatus;
}
