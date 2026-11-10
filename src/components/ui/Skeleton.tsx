import './Skeleton.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '16px', className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export function SkeletonStatsRow({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-stats-grid" aria-busy="true" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="surface-card skeleton-stat-card">
          <Skeleton width="40%" height="12px" />
          <Skeleton width="32%" height="26px" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonListRows({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading items">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="surface-card skeleton-row-card">
          <div className="skeleton-row-left">
            <Skeleton width="180px" height="15px" />
            <Skeleton width="240px" height="12px" />
          </div>
          <div className="skeleton-row-right">
            <Skeleton width="84px" height="22px" />
          </div>
        </div>
      ))}
    </div>
  );
}

