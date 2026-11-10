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
import type { ApiRequestOptions } from './healthService';

const SESSION_PREFIX = '/api/v1/interview/sessions';
const LONG_TIMEOUT_MS = 150_000;

/** Create a new interview session */
export async function createSession(
  payload: CreateSessionRequest,
  options?: ApiRequestOptions
): Promise<SessionDetailResponse> {
  const response = await apiClient.post<SessionDetailResponse>(SESSION_PREFIX, payload, {
    signal: options?.signal,
  });
  return response.data;
}

/** List interview sessions (with optional pagination) */
export async function listSessions(
  limit = 50,
  skip = 0,
  options?: ApiRequestOptions
): Promise<SessionDetailResponse[]> {
  const response = await apiClient.get<SessionDetailResponse[]>(SESSION_PREFIX, {
    params: { limit, skip },
    signal: options?.signal,
    timeout: 20_000,
  });
  return response.data;
}

/** Get full session details by ID */
export async function getSession(
  sessionId: string,
  options?: ApiRequestOptions
): Promise<SessionDetailResponse> {
  const response = await apiClient.get<SessionDetailResponse>(
    `${SESSION_PREFIX}/${encodeURIComponent(sessionId)}`,
    { signal: options?.signal, timeout: 20_000 }
  );
  return response.data;
}

/** Generate the next question for a session */
export async function getNextQuestion(
  sessionId: string,
  options?: ApiRequestOptions
): Promise<SessionNextQuestionResponse> {
  const response = await apiClient.post<SessionNextQuestionResponse>(
    `${SESSION_PREFIX}/${encodeURIComponent(sessionId)}/next-question`,
    undefined,
    { signal: options?.signal, timeout: LONG_TIMEOUT_MS }
  );
  return response.data;
}

/** Submit a candidate answer for evaluation within a session */
export async function submitAnswer(
  sessionId: string,
  payload: SubmitAnswerRequest,
  options?: ApiRequestOptions
): Promise<SessionSubmitAnswerResponse> {
  const response = await apiClient.post<SessionSubmitAnswerResponse>(
    `${SESSION_PREFIX}/${encodeURIComponent(sessionId)}/answers`,
    payload,
    { signal: options?.signal, timeout: LONG_TIMEOUT_MS }
  );
  return response.data;
}

/** Complete a session and get the summary */
export async function completeSession(
  sessionId: string,
  options?: ApiRequestOptions
): Promise<InterviewSessionSummaryResponse> {
  const response = await apiClient.post<InterviewSessionSummaryResponse>(
    `${SESSION_PREFIX}/${encodeURIComponent(sessionId)}/complete`,
    undefined,
    { signal: options?.signal, timeout: 30_000 }
  );
  return response.data;
}
