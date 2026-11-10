import { AlertCircleIcon, RefreshIcon } from './Icons';
import './ErrorDisplay.css';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorDisplay({
  title = 'Unable to load content',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorDisplayProps) {
  return (
    <div className="error-display surface-card animate-fade-in" role="alert" id="error-display">
      <div className="error-display-icon">
        <AlertCircleIcon size={20} />
      </div>
      <div className="error-display-body">
        <h3 className="error-title">{title}</h3>
        <p className="error-message">{message}</p>
        {onRetry && (
          <div className="error-display-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry} id="error-retry-btn">
              <RefreshIcon size={14} />
              <span>{retryLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
