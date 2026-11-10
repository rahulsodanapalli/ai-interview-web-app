/**
 * Document & RAG API service — PDF upload and document-grounded question generation.
 *
 * Endpoints:
 *   POST /api/v1/documents/upload
 *   POST /api/v1/interview/document-question
 *   POST /api/v1/documents/{document_id}/question
 */

import apiClient from './client';
import type {
  DocumentUploadResponse,
  DocumentQuestionRequest,
  DocumentQuestionResponse,
} from '../types';
import type { ApiRequestOptions } from './healthService';

const DOCUMENTS_PREFIX = '/api/v1/documents';
const INTERVIEW_PREFIX = '/api/v1/interview';
const LONG_TIMEOUT_MS = 150_000;

/**
 * Sanitize document_id to base ID by stripping trailing hash/chunk fragments and whitespace.
 */
export function sanitizeDocumentId(documentId: string): string {
  if (!documentId) return '';
  let clean = documentId.trim();
  if (clean.includes('#')) {
    clean = clean.split('#')[0].trim();
  }
  return clean;
}

/**
 * Upload a PDF document for text extraction, chunking, and Pinecone vector indexing.
 */
export async function uploadDocument(
  file: File,
  options?: ApiRequestOptions
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await apiClient.post<DocumentUploadResponse>(
    `${DOCUMENTS_PREFIX}/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal: options?.signal,
      timeout: LONG_TIMEOUT_MS,
    }
  );

  const data = response.data;
  if (data.document_id) {
    data.document_id = sanitizeDocumentId(data.document_id);
  }
  if (!data.source_id && data.document_id) {
    data.source_id = data.document_id;
  }
  return data;
}

/**
 * Generate a document-grounded interview question using candidate document context.
 */
export async function generateDocumentQuestion(
  payload: DocumentQuestionRequest,
  options?: ApiRequestOptions
): Promise<DocumentQuestionResponse> {
  const cleanPayload: DocumentQuestionRequest = {
    ...payload,
    document_id: sanitizeDocumentId(payload.document_id),
  };

  const response = await apiClient.post<DocumentQuestionResponse>(
    `${INTERVIEW_PREFIX}/document-question`,
    cleanPayload,
    { signal: options?.signal, timeout: LONG_TIMEOUT_MS }
  );
  return response.data;
}

/**
 * Convenience endpoint for generating a document-grounded question for a specific path document_id.
 */
export async function generateQuestionForDocument(
  documentId: string,
  payload?: Partial<DocumentQuestionRequest>,
  options?: ApiRequestOptions
): Promise<DocumentQuestionResponse> {
  const cleanId = sanitizeDocumentId(documentId);
  const bodyPayload: DocumentQuestionRequest = {
    document_id: cleanId,
    ...(payload || {}),
  };

  const response = await apiClient.post<DocumentQuestionResponse>(
    `${DOCUMENTS_PREFIX}/${encodeURIComponent(cleanId)}/question`,
    bodyPayload,
    { signal: options?.signal, timeout: LONG_TIMEOUT_MS }
  );
  return response.data;
}
