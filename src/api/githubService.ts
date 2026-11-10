/**
 * GitHub API service — Repository validation, README retrieval, file listing,
 * and repository-grounded interview question generation.
 *
 * Endpoints:
 *   POST /api/v1/github/validate
 *   GET  /api/v1/github/readme
 *   GET  /api/v1/github/files
 *   POST /api/v1/github/file-content
 *   POST /api/v1/github/question
 */

import apiClient from './client';
import type {
  RepoIdentifierRequest,
  RepoMetadataResponse,
  RepoReadmeResponse,
  RepoFilesListResponse,
  RepoFileRequest,
  RepoFileContentResponse,
  RepoQuestionRequest,
  RepoQuestionResponse,
} from '../types';
import { formatApiError } from '../utils/error';
import type { ApiRequestOptions } from './healthService';

const GITHUB_PREFIX = '/api/v1/github';
const LONG_TIMEOUT_MS = 150_000;

/**
 * Normalizes user input for repository identifier (strips whitespace, trailing slash).
 */
export function sanitizeRepoIdentifier(input: string): string {
  if (!input) return '';
  return input.trim().replace(/\/+$/, '');
}

/**
 * Validate repository identifier and fetch its metadata.
 */
export async function validateRepository(
  repoUrlOrName: string,
  options?: ApiRequestOptions
): Promise<RepoMetadataResponse> {
  const cleanIdentifier = sanitizeRepoIdentifier(repoUrlOrName);
  const payload: RepoIdentifierRequest = { repo_url_or_name: cleanIdentifier };

  const response = await apiClient.post<RepoMetadataResponse>(
    `${GITHUB_PREFIX}/validate`,
    payload,
    { signal: options?.signal, timeout: 30_000 }
  );
  return response.data;
}

/**
 * Fetch and decode the repository's README markdown.
 */
export async function getRepositoryReadme(
  repo: string,
  ref?: string,
  options?: ApiRequestOptions
): Promise<RepoReadmeResponse> {
  const cleanRepo = sanitizeRepoIdentifier(repo);
  const params: Record<string, string> = { repo: cleanRepo };
  if (ref && ref.trim()) {
    params.ref = ref.trim();
  }

  const response = await apiClient.get<RepoReadmeResponse>(
    `${GITHUB_PREFIX}/readme`,
    { params, signal: options?.signal, timeout: 30_000 }
  );
  return response.data;
}

/**
 * List files and subdirectories within a repository path.
 */
export async function listRepositoryFiles(
  repo: string,
  path: string = '',
  ref?: string,
  options?: ApiRequestOptions
): Promise<RepoFilesListResponse> {
  const cleanRepo = sanitizeRepoIdentifier(repo);
  const params: Record<string, string> = { repo: cleanRepo, path: path || '' };
  if (ref && ref.trim()) {
    params.ref = ref.trim();
  }

  const response = await apiClient.get<RepoFilesListResponse>(
    `${GITHUB_PREFIX}/files`,
    { params, signal: options?.signal, timeout: 30_000 }
  );
  return response.data;
}

/**
 * Fetch decoded content of a specific source file.
 */
export async function getFileContent(
  repoUrlOrName: string,
  filePath: string,
  ref?: string,
  options?: ApiRequestOptions
): Promise<RepoFileContentResponse> {
  const cleanRepo = sanitizeRepoIdentifier(repoUrlOrName);
  const payload: RepoFileRequest = {
    repo_url_or_name: cleanRepo,
    file_path: filePath.trim().replace(/^\/+/, ''),
    ref: ref?.trim() || null,
  };

  const response = await apiClient.post<RepoFileContentResponse>(
    `${GITHUB_PREFIX}/file-content`,
    payload,
    { signal: options?.signal, timeout: 30_000 }
  );
  return response.data;
}

/**
 * Generate an interview question grounded in repository source code or README.
 */
export async function generateRepoQuestion(
  payload: RepoQuestionRequest,
  options?: ApiRequestOptions
): Promise<RepoQuestionResponse> {
  const cleanPayload: RepoQuestionRequest = {
    ...payload,
    repo_url_or_name: sanitizeRepoIdentifier(payload.repo_url_or_name),
    focus_file_path: payload.focus_file_path?.trim() || null,
    ref: payload.ref?.trim() || null,
  };

  const response = await apiClient.post<RepoQuestionResponse>(
    `${GITHUB_PREFIX}/question`,
    cleanPayload,
    { signal: options?.signal, timeout: LONG_TIMEOUT_MS }
  );
  return response.data;
}

/**
 * Helper to extract descriptive, user-friendly error messages from Axios API errors.
 */
export function formatGitHubApiError(err: unknown, defaultFallback: string): string {
  return formatApiError(err, defaultFallback);
}
