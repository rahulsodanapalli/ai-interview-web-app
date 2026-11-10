/**
 * Interview API service — standalone question generation and answer evaluation.
 *
 * Endpoints:
 *   POST /api/v1/interview/question
 *   POST /api/v1/interview/evaluate
 */

import apiClient from './client';
import type {
  InterviewQuestionRequest,
  InterviewQuestionResponse,
  InterviewEvaluationRequest,
  InterviewEvaluationResponse,
} from '../types';
import type { ApiRequestOptions } from './healthService';

const INTERVIEW_PREFIX = '/api/v1/interview';
const LONG_TIMEOUT_MS = 150_000;

/** Generate a tailored interview question */
export async function generateQuestion(
  payload: InterviewQuestionRequest,
  options?: ApiRequestOptions
): Promise<InterviewQuestionResponse> {
  const response = await apiClient.post<InterviewQuestionResponse>(
    `${INTERVIEW_PREFIX}/question`,
    payload,
    { signal: options?.signal, timeout: LONG_TIMEOUT_MS }
  );
  return response.data;
}

/** Evaluate a candidate's answer against expected criteria */
export async function evaluateAnswer(
  payload: InterviewEvaluationRequest,
  options?: ApiRequestOptions
): Promise<InterviewEvaluationResponse> {
  const response = await apiClient.post<InterviewEvaluationResponse>(
    `${INTERVIEW_PREFIX}/evaluate`,
    payload,
    { signal: options?.signal, timeout: LONG_TIMEOUT_MS }
  );
  return response.data;
}
