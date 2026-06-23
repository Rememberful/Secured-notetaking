import React from 'react';

export default function SessionWarningModal({ secondsLeft, onStay, onLogout }) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`;

  const pct = Math.max(0, Math.min(100, (secondsLeft / 60) * 100));

  return (
    <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-live="assertive">
      <div className="modal-panel session-warning-panel">
        <div className="modal-header">
          <h2 className="modal-title">Session expiring</h2>
        </div>
        <div className="session-warning-body">
          <p>
            You'll be automatically signed out in{' '}
            <strong className="session-countdown">{timeStr}</strong>.
            Any unsaved notes will be saved before sign-out.
          </p>
          <div className="session-track">
            <div className="session-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary modal-edit-btn" onClick={onStay}>
            Stay signed in
          </button>
          <button className="modal-close-btn" onClick={onLogout}>
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}