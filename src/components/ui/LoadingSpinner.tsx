import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  /** Message shown below the spinner */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable loading spinner with optional message.
 */
export default function LoadingSpinner({
  message = 'Loading…',
  size = 'md',
}: LoadingSpinnerProps) {
  return (
    <div className={`loading-spinner ${size}`} role="status" aria-label="Loading">
      <div className="spinner-ring">
        <div className="ring-inner"></div>
      </div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );
}
