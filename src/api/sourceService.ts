/**
 * Source & URL Ingestion API service — Unified source management, webpage/GitHub ingestion,
 * status polling, question generation, and session creation.
 *
 * Primary Endpoints:
 *   POST /api/v1/sources/url
 *   GET  /api/v1/sources/:source_id/status
 *   GET  /api/v1/sources
 *   POST /api/v1/sources/:source_id/questions
 *   POST /api/v1/sources/sessions
 *
 * Fallback Endpoints:
 *   POST /api/v1/documents/url
 *   GET  /api/v1/documents/:document_id/status
 *   POST /api/v1/interview/source-questions
 *   POST /api/v1/documents/:document_id/questions
 *   POST /api/v1/interview/sessions
 */

import apiClient from './client';
import type {
  SourceUploadResponse,
  SourceStatusResponse,
  SourceQuestionsRequest,
  SourceQuestionsResponse,
  CreateSessionRequest,
  SessionDetailResponse,
} from '../types';
import { formatApiError, getErrorStatus } from '../utils/error';
import type { ApiRequestOptions } from './healthService';

const SOURCES_PREFIX = '/api/v1/sources';
const DOCUMENTS_PREFIX = '/api/v1/documents';
const INTERVIEW_PREFIX = '/api/v1/interview';
const LONG_TIMEOUT_MS = 150_000;

/**
 * Normalizes user input for URL or source identifier.
 */
export function sanitizeSourceId(id: string): string {
  if (!id) return '';
  let clean = id.trim();
  if (clean.includes('#')) {
    clean = clean.split('#')[0].trim();
  }
  return clean;
}

/**
 * Ingest and index content from a public webpage or GitHub repository.
 */
export async function ingestUrl(
  url: string,
  options?: ApiRequestOptions
): Promise<SourceUploadResponse> {
  const cleanUrl = url.trim();
  const payload = { url: cleanUrl };
  const config = { signal: options?.signal, timeout: LONG_TIMEOUT_MS };

  try {
    const response = await apiClient.post<SourceUploadResponse>(
      `${SOURCES_PREFIX}/url`,
      payload,
      config
    );
    return response.data;
  } catch (err: unknown) {
    if (getErrorStatus(err) === 404) {
      const fallbackResponse = await apiClient.post<SourceUploadResponse>(
        `${DOCUMENTS_PREFIX}/url`,
        payload,
        config
      );
      return fallbackResponse.data;
    }
    throw err;
  }
}

/**
 * Check the processing and indexing status for a source ID.
 */
export async function getSourceStatus(
  sourceId: string,
  options?: ApiRequestOptions
): Promise<SourceStatusResponse> {
  const cleanId = sanitizeSourceId(sourceId);
  const config = { signal: options?.signal, timeout: 15_000 };

  try {
    const response = await apiClient.get<SourceStatusResponse>(
      `${SOURCES_PREFIX}/${encodeURIComponent(cleanId)}/status`,
      config
    );
    return response.data;
  } catch (err: unknown) {
    if (getErrorStatus(err) === 404) {
      const fallbackResponse = await apiClient.get<SourceStatusResponse>(
        `${DOCUMENTS_PREFIX}/${encodeURIComponent(cleanId)}/status`,
        config
      );
      return fallbackResponse.data;
    }
    throw err;
  }
}

/**
 * List all registered sources with optional pagination.
 */
export async function listSources(
  limit = 50,
  skip = 0,
  options?: ApiRequestOptions
): Promise<SourceStatusResponse[]> {
  const response = await apiClient.get<SourceStatusResponse[]>(SOURCES_PREFIX, {
    params: { limit, skip },
    signal: options?.signal,
  });
  return response.data;
}

/**
 * Generate multiple interview questions grounded in chunks from the given source.
 */
export async function generateSourceQuestions(
  sourceId: string,
  payload?: SourceQuestionsRequest,
  options?: ApiRequestOptions
): Promise<SourceQuestionsResponse> {
  const cleanId = sanitizeSourceId(sourceId);
  const bodyPayload: SourceQuestionsRequest = {
    role: 'General Technical Interview',
    experience_level: 'Intermediate',
    difficulty: 'Medium',
    count: 5,
    question_type: 'Technical',
    ...(payload || {}),
    source_id: cleanId,
  };
  const config = { signal: options?.signal, timeout: LONG_TIMEOUT_MS };

  try {
    const response = await apiClient.post<SourceQuestionsResponse>(
      `${SOURCES_PREFIX}/${encodeURIComponent(cleanId)}/questions`,
      bodyPayload,
      config
    );
    return response.data;
  } catch (err: unknown) {
    if (getErrorStatus(err) === 404) {
      try {
        const fbResponse1 = await apiClient.post<SourceQuestionsResponse>(
          `${INTERVIEW_PREFIX}/source-questions`,
          bodyPayload,
          config
        );
        return fbResponse1.data;
      } catch (fb1Err: unknown) {
        if (getErrorStatus(fb1Err) === 404) {
          const fbResponse2 = await apiClient.post<SourceQuestionsResponse>(
            `${DOCUMENTS_PREFIX}/${encodeURIComponent(cleanId)}/questions`,
            bodyPayload,
            config
          );
          return fbResponse2.data;
        }
        throw fb1Err;
      }
    }
    throw err;
  }
}

/**
 * Create an interview session linked to a source ID and optional pre-generated questions.
 */
export async function createSourceSession(
  payload: CreateSessionRequest,
  options?: ApiRequestOptions
): Promise<SessionDetailResponse> {
  const cleanPayload: CreateSessionRequest = {
    ...payload,
    source_id: payload.source_id ? sanitizeSourceId(payload.source_id) : undefined,
  };
  const config = { signal: options?.signal };

  try {
    const response = await apiClient.post<SessionDetailResponse>(
      `${SOURCES_PREFIX}/sessions`,
      cleanPayload,
      config
    );
    return response.data;
  } catch (err: unknown) {
    if (getErrorStatus(err) === 404) {
      const fallbackResponse = await apiClient.post<SessionDetailResponse>(
        `${INTERVIEW_PREFIX}/sessions`,
        cleanPayload,
        config
      );
      return fallbackResponse.data;
    }
    throw err;
  }
}

/**
 * Helper to extract descriptive, user-friendly error messages from source API errors.
 */
export function formatSourceApiError(err: unknown, defaultFallback: string): string {
  return formatApiError(err, defaultFallback);
}
