import type { ReactNode } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state surface-card animate-fade-in" id="empty-state">
      {icon && <div className="empty-icon-box">{icon}</div>}
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-description">{description}</p>}
      {(action || secondaryAction) && (
        <div className="empty-actions">
          {action && (
            <button type="button" className="btn btn-primary btn-sm" onClick={action.onClick} id="empty-state-action">
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
