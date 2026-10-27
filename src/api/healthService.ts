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

/** Check backend health status */
export async function getBackendHealth(): Promise<HealthCheckResponse> {
  const response = await apiClient.get<HealthCheckResponse>(HEALTH_PREFIX);
  return response.data;
}

/** Check Ollama LLM service health */
export async function getOllamaHealth(): Promise<OllamaHealthResponse> {
  const response = await apiClient.get<OllamaHealthResponse>(`${HEALTH_PREFIX}/ollama`);
  return response.data;
}

/** Check database connectivity health */
export async function getDatabaseHealth(): Promise<DatabaseHealthResponse> {
  const response = await apiClient.get<DatabaseHealthResponse>(`${HEALTH_PREFIX}/db`);
  return response.data;
}
