import './EmptyState.css';

interface EmptyStateProps {
  /** Large emoji or icon */
  icon?: string;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Optional CTA */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Reusable empty state for lists and sections with no data.
 */
export default function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state animate-fade-in" id="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-description">{description}</p>}
      {action && (
        <button className="btn btn-primary btn-sm" onClick={action.onClick} id="empty-state-action">
          {action.label}
        </button>
      )}
    </div>
  );
}
