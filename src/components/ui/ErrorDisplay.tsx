import './ErrorDisplay.css';

interface ErrorDisplayProps {
  /** The error message to show */
  message: string;
  /** Optional retry callback */
  onRetry?: () => void;
}

/**
 * Reusable error state display with optional retry button.
 */
export default function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="error-display animate-fade-in" role="alert" id="error-display">
      <div className="error-icon">⚠️</div>
      <h3 className="error-title">Something went wrong</h3>
      <p className="error-message">{message}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry} id="error-retry-btn">
          Try Again
        </button>
      )}
    </div>
  );
}
