/**
 * Session API service — interview session lifecycle management.
 *
 * Endpoints:
 *   POST   /api/v1/interview/sessions
 *   GET    /api/v1/interview/sessions
 *   GET    /api/v1/interview/sessions/:session_id
 *   POST   /api/v1/interview/sessions/:session_id/next-question
 *   POST   /api/v1/interview/sessions/:session_id/answers
 *   POST   /api/v1/interview/sessions/:session_id/complete
 */

import apiClient from './client';
import type {
  CreateSessionRequest,
  SessionDetailResponse,
  SessionNextQuestionResponse,
  SubmitAnswerRequest,
  SessionSubmitAnswerResponse,
  InterviewSessionSummaryResponse,
} from '../types';

const SESSION_PREFIX = '/api/v1/interview/sessions';

/** Create a new interview session */
export async function createSession(
  payload: CreateSessionRequest
): Promise<SessionDetailResponse> {
  const response = await apiClient.post<SessionDetailResponse>(SESSION_PREFIX, payload);
  return response.data;
}

/** List interview sessions (with optional pagination) */
export async function listSessions(
  limit = 50,
  skip = 0
): Promise<SessionDetailResponse[]> {
  const response = await apiClient.get<SessionDetailResponse[]>(SESSION_PREFIX, {
    params: { limit, skip },
  });
  return response.data;
}

/** Get full session details by ID */
export async function getSession(
  sessionId: string
): Promise<SessionDetailResponse> {
  const response = await apiClient.get<SessionDetailResponse>(
    `${SESSION_PREFIX}/${sessionId}`
  );
  return response.data;
}

/** Generate the next question for a session */
export async function getNextQuestion(
  sessionId: string
): Promise<SessionNextQuestionResponse> {
  const response = await apiClient.post<SessionNextQuestionResponse>(
    `${SESSION_PREFIX}/${sessionId}/next-question`
  );
  return response.data;
}

/** Submit a candidate answer for evaluation within a session */
export async function submitAnswer(
  sessionId: string,
  payload: SubmitAnswerRequest
): Promise<SessionSubmitAnswerResponse> {
  const response = await apiClient.post<SessionSubmitAnswerResponse>(
    `${SESSION_PREFIX}/${sessionId}/answers`,
    payload
  );
  return response.data;
}

/** Complete a session and get the summary */
export async function completeSession(
  sessionId: string
): Promise<InterviewSessionSummaryResponse> {
  const response = await apiClient.post<InterviewSessionSummaryResponse>(
    `${SESSION_PREFIX}/${sessionId}/complete`
  );
  return response.data;
}
