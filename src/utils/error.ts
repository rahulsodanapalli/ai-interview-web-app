import axios from 'axios';

/**
 * Checks whether an error is a cancelled/aborted request.
 */
export function isRequestAborted(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err && typeof err === 'object') {
    const e = err as { name?: string; code?: string };
    return e.name === 'AbortError' || e.name === 'CanceledError' || e.code === 'ERR_CANCELED';
  }
  return false;
}

/**
 * Extracts HTTP status code from an Axios-like error if present.
 */
export function getErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: { status?: number } }).response;
    return resp?.status;
  }
  return undefined;
}

/**
 * Unified user-friendly API error extractor for FastAPI + Axios errors.
 */
export function formatApiError(err: unknown, fallback = 'An unexpected error occurred. Please try again.'): string {
  if (!err || typeof err !== 'object') {
    return fallback;
  }

  if (isRequestAborted(err)) {
    return 'Request was cancelled.';
  }

  if ('response' in err) {
    const axiosErr = err as {
      response?: {
        status?: number;
        data?: {
          detail?: string | Array<{ msg?: string; loc?: string[] }>;
          message?: string;
        };
      };
    };

    const status = axiosErr.response?.status;
    const data = axiosErr.response?.data;
    const detail = data?.detail;

    if (Array.isArray(detail)) {
      const messages = detail.map((d) => d.msg).filter(Boolean);
      if (messages.length > 0) return messages.join('. ');
    }

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message;
    }

    switch (status) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 403:
        return 'Access denied. The resource requires authentication or permission.';
      case 404:
        return 'The requested resource could not be found.';
      case 413:
        return 'Content exceeds the maximum allowed size limit.';
      case 422:
        return 'Validation failed. Please review your input values.';
      case 429:
        return 'Rate limit exceeded. Please wait a moment before trying again.';
      case 502:
        return 'The AI model returned an invalid response structure. Please retry.';
      case 503:
        return 'Service unavailable: Verify backend, Pinecone, or local Ollama service is running.';
      case 504:
        return 'Request timed out waiting for the AI model or external service.';
      default:
        break;
    }
  }

  if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
    const msg = (err as { message: string }).message;
    if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
      return 'The request timed out. AI generation or content indexing took longer than expected.';
    }
    if (msg.includes('Network Error')) {
      return 'Network error: Unable to reach the backend API server. Verify FastAPI is running on port 8000.';
    }
    return msg;
  }

  return fallback;
}

