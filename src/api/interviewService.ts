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

const INTERVIEW_PREFIX = '/api/v1/interview';

/** Generate a tailored interview question */
export async function generateQuestion(
  payload: InterviewQuestionRequest
): Promise<InterviewQuestionResponse> {
  const response = await apiClient.post<InterviewQuestionResponse>(
    `${INTERVIEW_PREFIX}/question`,
    payload
  );
  return response.data;
}

/** Evaluate a candidate's answer against expected criteria */
export async function evaluateAnswer(
  payload: InterviewEvaluationRequest
): Promise<InterviewEvaluationResponse> {
  const response = await apiClient.post<InterviewEvaluationResponse>(
    `${INTERVIEW_PREFIX}/evaluate`,
    payload
  );
  return response.data;
}
