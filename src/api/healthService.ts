/**
 * Health API service.
 *
 * Endpoints:
 *   GET /api/v1/health
 *   GET /api/v1/health/ollama
 *   GET /api/v1/health/db
 */

import apiClient from './client';
import type {
  HealthCheckResponse,
  OllamaHealthResponse,
  DatabaseHealthResponse,
} from '../types';

const HEALTH_PREFIX = '/api/v1/health';
const HEALTH_TIMEOUT_MS = 10_000;

export interface ApiRequestOptions {
  signal?: AbortSignal;
}

/** Check backend health status */
export async function getBackendHealth(
  options?: ApiRequestOptions
): Promise<HealthCheckResponse> {
  const response = await apiClient.get<HealthCheckResponse>(HEALTH_PREFIX, {
    signal: options?.signal,
    timeout: HEALTH_TIMEOUT_MS,
  });
  return response.data;
}

/** Check Ollama LLM service health */
export async function getOllamaHealth(
  options?: ApiRequestOptions
): Promise<OllamaHealthResponse> {
  const response = await apiClient.get<OllamaHealthResponse>(`${HEALTH_PREFIX}/ollama`, {
    signal: options?.signal,
    timeout: HEALTH_TIMEOUT_MS,
  });
  return response.data;
}

/** Check database connectivity health */
export async function getDatabaseHealth(
  options?: ApiRequestOptions
): Promise<DatabaseHealthResponse> {
  const response = await apiClient.get<DatabaseHealthResponse>(`${HEALTH_PREFIX}/db`, {
    signal: options?.signal,
    timeout: HEALTH_TIMEOUT_MS,
  });
  return response.data;
}
