// src/screens/Upload/components/BatchProgress.tsx
import React from 'react';

export interface BatchProjectStatus {
  name: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  progress?: number;
  error?: string;
}

interface BatchProgressProps {
  projects: BatchProjectStatus[];
  creditsUsed: number;
  creditsRemaining: number;
  onPause?: () => void;
  onCancel?: () => void;
  onDone?: () => void;
  isPaused?: boolean;
}

const BatchProgress: React.FC<BatchProgressProps> = ({
  projects,
  creditsUsed,
  creditsRemaining,
  onPause,
  onCancel,
  onDone,
  isPaused,
}) => {
  const completed = projects.filter(p => p.status === 'completed').length;
  const total = projects.length;
  const allDone = projects.every(p => p.status === 'completed' || p.status === 'error');
  const globalProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="batch-progress">
      <div className="batch-header">
        <h2>
          {allDone
            ? `Done — ${completed} of ${total} completed`
            : `Processing — ${completed} of ${total}`}
        </h2>
        <div className="batch-credits">
          <span>{creditsUsed} credits used</span>
          <span className="batch-credits-remaining">{creditsRemaining} remaining</span>
        </div>
      </div>

      <div className="batch-progress-bar">
        <div className="batch-progress-fill" style={{ width: `${globalProgress}%` }} />
      </div>

      <div className="batch-list">
        {projects.map((p, i) => (
          <div key={i} className={`batch-item batch-item-${p.status}`}>
            <div className="batch-item-icon">
              {p.status === 'completed' && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#34C759" strokeWidth="1.5"/>
                  <path d="M5 8l2 2 4-4" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {p.status === 'error' && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#FF3B30" strokeWidth="1.5"/>
                  <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
              {p.status === 'running' && <span className="batch-spinner" />}
              {p.status === 'queued' && <span className="batch-queued-dot" />}
            </div>

            <span className="batch-item-name">{p.name}</span>

            {p.status === 'running' && p.progress !== undefined && (
              <div className="batch-item-progress">
                <div className="batch-item-progress-fill" style={{ width: `${p.progress}%` }} />
              </div>
            )}

            {p.status === 'error' && p.error && (
              <span className="batch-item-error">{p.error}</span>
            )}

            <span className="batch-item-status">
              {p.status === 'completed' ? 'Done' : p.status === 'running' ? `${p.progress ?? 0}%` : p.status === 'error' ? 'Failed' : 'Queue'}
            </span>
          </div>
        ))}
      </div>

      <div className="batch-actions">
        {!allDone ? (
          <>
            {onPause && (
              <button className="btn-ghost" onClick={onPause}>
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
            {onCancel && (
              <button className="btn-ghost" onClick={onCancel}>Cancel</button>
            )}
          </>
        ) : (
          onDone && (
            <button className="btn-primary-orange" onClick={onDone}>
              View Collection
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default BatchProgress;
