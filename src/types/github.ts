/**
 * TypeScript types matching the backend GitHub inspection and question schemas.
 * Source: BackEnd/app/schemas/github.py
 */

export type GitHubDifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export type RepoFileItemType = 'file' | 'dir' | 'symlink' | 'submodule';

export type EvidenceSourceType = 'readme' | 'source_file' | 'repo_metadata' | 'none';

/**
 * Request schema for validating a repository identifier.
 */
export interface RepoIdentifierRequest {
  repo_url_or_name: string;
}

/**
 * Metadata response for a validated GitHub repository.
 */
export interface RepoMetadataResponse {
  owner: string;
  repo: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  is_private: boolean;
  html_url: string;
  has_readme: boolean;
}

/**
 * Response containing the decoded repository README text.
 */
export interface RepoReadmeResponse {
  owner: string;
  repo: string;
  filename: string;
  content: string;
  size_bytes: number;
  html_url?: string | null;
}

/**
 * Item in repository directory listing.
 */
export interface RepoFileItem {
  name: string;
  path: string;
  type: RepoFileItemType;
  size?: number | null;
  html_url?: string | null;
}

/**
 * Response containing directory listing.
 */
export interface RepoFilesListResponse {
  owner: string;
  repo: string;
  path: string;
  items: RepoFileItem[];
}

/**
 * Request schema for reading a specific repository file.
 */
export interface RepoFileRequest {
  repo_url_or_name: string;
  file_path: string;
  ref?: string | null;
}

/**
 * Response containing decoded source content of a file.
 */
export interface RepoFileContentResponse {
  owner: string;
  repo: string;
  file_path: string;
  size_bytes: number;
  content: string;
  is_truncated: boolean;
  html_url?: string | null;
}

/**
 * Grounding evidence for a repository interview question.
 */
export interface RepoEvidence {
  source_type: EvidenceSourceType;
  source_path: string;
  excerpt: string;
}

/**
 * Request schema for generating repository-grounded interview questions.
 */
export interface RepoQuestionRequest {
  repo_url_or_name: string;
  role?: string;
  focus_file_path?: string | null;
  topic?: string;
  difficulty?: GitHubDifficultyLevel;
  ref?: string | null;
}

/**
 * Response schema for a repository-grounded interview question.
 */
export interface RepoQuestionResponse {
  question: string;
  expected_answer_points: string[];
  follow_up_question: string;
  difficulty: GitHubDifficultyLevel;
  topic: string;
  repository: string;
  context_grounded: boolean;
  evidence?: RepoEvidence | null;
  grounding_note?: string | null;
}
