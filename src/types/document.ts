/**
 * TypeScript types matching the backend document and RAG schemas.
 * Sources:
 *   - BackEnd/app/schemas/document.py
 *   - BackEnd/app/schemas/interview.py
 */

import type { ExperienceLevel, DifficultyLevel, QuestionType } from './interview';

/**
 * Supported source ingestion types.
 */
export type SourceType = 'document' | 'url' | 'github';

/**
 * Processing and indexing lifecycle status.
 */
export type SourceProcessingStatus = 'processing' | 'completed' | 'failed';

/**
 * Response returned from POST /api/v1/documents/upload
 */
export interface DocumentUploadResponse {
  success: boolean;
  filename: string;
  page_count: number;
  character_count: number;
  preview: string;
  document_id: string;
  source_id?: string;
  status?: SourceProcessingStatus | string;
  chunk_count?: number;
  vector_count?: number;
  message: string;
}

/**
 * Request payload for POST /api/v1/sources/url and POST /api/v1/documents/url
 */
export interface UrlIngestRequest {
  url: string;
}

/**
 * Response returned upon successful ingestion of a document or URL source.
 * Returned from POST /api/v1/sources/url and POST /api/v1/documents/url
 */
export interface SourceUploadResponse {
  success: boolean;
  source_id: string;
  source_type: SourceType;
  status: SourceProcessingStatus;
  url?: string;
  title: string;
  character_count: number;
  chunk_count: number;
  vector_count: number;
  preview: string;
  message: string;
}

/**
 * Detailed status and metadata for a registered source.
 * Returned from GET /api/v1/sources/:source_id/status
 */
export interface SourceStatusResponse {
  source_id: string;
  status: SourceProcessingStatus;
  source_type: SourceType;
  title: string;
  url?: string | null;
  filename?: string | null;
  character_count: number;
  chunk_count: number;
  vector_count: number;
  error_message?: string | null;
  created_at: string;
}

/**
 * Citation metadata for a retrieved document chunk from Pinecone.
 */
export interface RetrievedChunkMetadata {
  chunk_id: string;
  chunk_index: number;
  similarity_score: number;
  excerpt: string;
}

/**
 * Structured interview question item with stable ID grounded in source context.
 */
export interface SourceQuestionItem {
  id: string;
  order: number;
  question: string;
  expected_answer_points: string[];
  follow_up_question?: string | null;
  difficulty: DifficultyLevel;
  topic: string;
}

/**
 * Request payload for generating multiple questions grounded in a specific source.
 * POST /api/v1/sources/:source_id/questions
 */
export interface SourceQuestionsRequest {
  source_id?: string;
  role?: string;
  experience_level?: ExperienceLevel;
  difficulty?: DifficultyLevel;
  topic?: string;
  question_type?: QuestionType;
  count?: number;
  force_regenerate?: boolean;
}

/**
 * Structured response containing generated questions grounded in source content.
 * POST /api/v1/sources/:source_id/questions
 */
export interface SourceQuestionsResponse {
  source_id: string;
  context_grounded: boolean;
  total_questions: number;
  questions: SourceQuestionItem[];
  retrieved_chunks: RetrievedChunkMetadata[];
}

/**
 * Request payload for POST /api/v1/interview/document-question
 * and POST /api/v1/documents/{document_id}/question
 */
export interface DocumentQuestionRequest {
  document_id: string;
  role?: string;
  experience_level?: ExperienceLevel;
  difficulty?: DifficultyLevel;
  topic?: string;
  question_type?: QuestionType;
  top_k?: number;
  min_score?: number;
}

/**
 * Response payload for document-grounded question generation (RAG).
 */
export interface DocumentQuestionResponse {
  question: string;
  expected_answer_points: string[];
  follow_up_question: string;
  difficulty: DifficultyLevel;
  topic: string;
  document_id: string;
  context_grounded: boolean;
  retrieved_chunks: RetrievedChunkMetadata[];
}
