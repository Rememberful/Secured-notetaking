import React, { useEffect } from 'react';
import RichEditor from './RichEditor.jsx';
import MediaGallery from './MediaGallery.jsx';

export default function NoteViewModal({ note, onClose, onEdit }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const formattedDate = new Date(note.updated_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={note.title}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">{note.title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-meta">
          {note.tags && note.tags.length > 0 && (
            <div className="modal-tags">
              {note.tags.map((tag) => (
                <span key={tag} className="tag-pill" style={{ cursor: 'default' }}>{tag}</span>
              ))}
            </div>
          )}
          <span className="modal-date">Updated {formattedDate}</span>
        </div>

        <div className="modal-body">
          <RichEditor content={note.content} readOnly />
          {note.media && note.media.length > 0 && (
            <div className="modal-media">
              <MediaGallery noteId={note.id} media={note.media} onMediaChange={() => {}} readOnly />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary modal-edit-btn" onClick={() => { onClose(); onEdit(); }}>
            Edit note
          </button>
          <button className="modal-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}