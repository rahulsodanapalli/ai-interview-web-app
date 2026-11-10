import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  message?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({
  message = 'Loading…',
  subtext,
  size = 'md',
}: LoadingSpinnerProps) {
  return (
    <div className={`loading-spinner ${size}`} role="status" aria-live="polite" aria-label={message}>
      <div className="spinner-ring" aria-hidden="true" />
      {message && <p className="spinner-message">{message}</p>}
      {subtext && <p className="spinner-subtext">{subtext}</p>}
    </div>
  );
}
