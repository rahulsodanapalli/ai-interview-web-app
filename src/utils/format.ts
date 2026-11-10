/**
 * Shared formatting helpers for file sizes, dates, and evaluation ratings.
 */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatRelativeDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function getRatingBadgeClass(rating: string): string {
  switch (rating) {
    case 'Excellent':
      return 'badge-success';
    case 'Good':
      return 'badge-info';
    case 'Fair':
      return 'badge-warning';
    default:
      return 'badge-error';
  }
}

export function getRatingColor(rating: string): string {
  switch (rating) {
    case 'Excellent':
      return 'var(--color-success)';
    case 'Good':
      return 'var(--color-info)';
    case 'Fair':
      return 'var(--color-warning)';
    default:
      return 'var(--color-error)';
  }
}

export function getRatingFromScore(score: number): 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement' {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
}

export function getDifficultyBadgeClass(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 'badge-success';
    case 'medium':
      return 'badge-info';
    case 'hard':
      return 'badge-warning';
    default:
      return 'badge-neutral';
  }
}

