import { CheckIcon, AlertCircleIcon } from '../ui/Icons';
import './RagProgressTracker.css';

export type RagStageStatus = 'pending' | 'active' | 'completed' | 'error';

export interface RagStageItem {
  id: string;
  label: string;
  detail: string;
  status: RagStageStatus;
}

interface RagProgressTrackerProps {
  stages: RagStageItem[];
  onCancel?: () => void;
  isSubmitting: boolean;
}

/**
 * Displays honest, backend-confirmed processing stages for the RAG workflow.
 * Never displays fake percentages or marks a stage complete before the API confirms it.
 */
export default function RagProgressTracker({
  stages,
  onCancel,
  isSubmitting,
}: RagProgressTrackerProps) {
  return (
    <div className="rag-progress-card surface-card animate-fade-in" id="auto-questions-generating" role="status" aria-live="polite">
      <div className="rag-progress-header">
        <div>
          <h4 className="rag-progress-title">Generating Grounded Interview</h4>
          <p className="rag-progress-subtitle">
            Each step advances only after the backend confirms completion.
          </p>
        </div>
        {isSubmitting && onCancel && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            id="cancel-rag-btn"
          >
            Cancel
          </button>
        )}
      </div>

      <ol className="rag-stage-list">
        {stages.map((stage) => (
          <li key={stage.id} className={`rag-stage-item status-${stage.status}`}>
            <div className="rag-stage-indicator" aria-hidden="true">
              {stage.status === 'completed' && <CheckIcon size={13} />}
              {stage.status === 'active' && <span className="rag-stage-spinner" />}
              {stage.status === 'error' && <AlertCircleIcon size={13} />}
              {stage.status === 'pending' && <span className="rag-stage-dot" />}
            </div>

            <div className="rag-stage-content">
              <span className="rag-stage-label">{stage.label}</span>
              <span className="rag-stage-detail">{stage.detail}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

