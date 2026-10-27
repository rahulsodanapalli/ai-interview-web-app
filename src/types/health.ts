/**
 * TypeScript types matching the backend Pydantic schemas.
 * Source: BackEnd/app/schemas/health.py
 *
 * These types mirror the exact response shapes from:
 *   GET /api/v1/health
 *   GET /api/v1/health/ollama
 *   GET /api/v1/health/db
 */

/** GET /api/v1/health */
export interface HealthCheckResponse {
  status: string;
  app_name: string;
  environment: string;
}

/** GET /api/v1/health/ollama */
export interface OllamaHealthResponse {
  status: string;
  ollama_connected: boolean;
  configured_model: string;
  model_available: boolean;
  available_models: string[];
}

/** GET /api/v1/health/db */
export interface DatabaseHealthResponse {
  status: string;
  database: string;
  database_connected: boolean;
  database_configured: boolean;
}
