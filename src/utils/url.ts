/**
 * URL normalization and validation helpers for GitHub repositories and public URLs.
 */

const GITHUB_URL_REGEX = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/.*)?$/i;
const OWNER_REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/**
 * Normalizes a GitHub repository input ('owner/repo', 'github.com/owner/repo', or full URL)
 * into a canonical https://github.com/owner/repo URL.
 */
export function normalizeRepoUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.toLowerCase().startsWith('github.com/')) {
    return `https://${trimmed}`;
  }
  if (OWNER_REPO_REGEX.test(trimmed)) {
    return `https://github.com/${trimmed}`;
  }
  return `https://${trimmed}`;
}

/**
 * Returns true if the input matches a GitHub repository URL or owner/repo shorthand.
 */
export function isGitHubRepoInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return GITHUB_URL_REGEX.test(trimmed) || OWNER_REPO_REGEX.test(trimmed);
}

/**
 * Validates a GitHub repository URL or owner/repo shorthand.
 */
export function validateGitHubUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Please enter a GitHub repository URL (e.g. https://github.com/owner/repo or owner/repo).';
  }

  if (!isGitHubRepoInput(trimmed)) {
    return 'Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo or owner/repo).';
  }

  const normalized = normalizeRepoUrl(trimmed);
  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) {
      return 'GitHub URL must include both owner and repository name (e.g. owner/repo).';
    }
    return null;
  } catch {
    return 'Please enter a valid GitHub repository URL.';
  }
}

/**
 * Validates a public HTTP/HTTPS webpage URL.
 */
export function validatePublicUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Please enter a public webpage URL (e.g. https://docs.example.com/guide).';
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'URL must use http:// or https://.';
    }
    if (!parsed.hostname.includes('.')) {
      return 'Please enter a valid public domain URL (e.g. https://fastapi.tiangolo.com).';
    }
    return null;
  } catch {
    return 'Please enter a valid public URL (e.g. https://docs.example.com/guide).';
  }
}

/**
 * Ensures a public URL starts with http:// or https://.
 */
export function normalizePublicUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

