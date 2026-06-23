import React, { useState, useCallback, useEffect } from 'react';
import TagInput from './TagInput.jsx';
import MediaGallery from './MediaGallery.jsx';
import RichEditor from './RichEditor.jsx';
import NoteViewModal from './NoteViewModal.jsx';
import useAutoSave from '../hooks/useAutoSave.js';
import { getPreviewText } from '../utils/richText.js';

function SaveStatus({ status }) {
  if (status === 'idle') return <span className="save-status" />;
  return (
    <span className={`save-status save-status-${status}`}>
      {status === 'saving' && <><span className="save-spinner" />Saving…</>}
      {status === 'saved'  && <>✓ Saved</>}
      {status === 'error'  && <>⚠ Save failed</>}
    </span>
  );
}

export default function NoteCard({ note, onUpdate, onDelete, onTagClick, editSaveRef }) {
  const [mode, setMode]       = useState('view');
  const [title, setTitle]     = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags]       = useState(note.tags || []);
  const [media, setMedia]     = useState(note.media || []);
  const [saving, setSaving]   = useState(false);

  const autoSaveFn = useCallback(async () => {
    if (!title.trim()) return;
    await onUpdate(note.id, { title: title.trim(), content, tags });
  }, [note.id, title, content, tags, onUpdate]);

  const { status, flushSave } = useAutoSave(autoSaveFn, [title, content, tags], {
    delay: 3000,
    minContent: title,
  });

  useEffect(() => {
    if (editSaveRef && mode === 'edit') {
      editSaveRef.current = { flush: flushSave };
    }
    return () => { if (editSaveRef) editSaveRef.current = null; };
  }, [editSaveRef, mode, flushSave]);

  function cancel() {
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags || []);
    setMedia(note.media || []);
    setMode('view');
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    await onUpdate(note.id, { title: title.trim(), content, tags });
    setSaving(false);
    setMode('view');
  }

  const formattedDate = new Date(note.updated_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  if (mode === 'edit') {
    return (
      <div className="note-card note-card-editing">
        <input
          className="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoFocus
        />
        <RichEditor
          content={content}
          onChange={setContent}
          placeholder="Write something worth keeping…"
        />
        <TagInput tags={tags} onChange={setTags} placeholder="Add tags…" />
        <MediaGallery noteId={note.id} media={media} onMediaChange={setMedia} />
        <div className="note-actions-edit">
          <SaveStatus status={status} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancel} disabled={saving}>Cancel</button>
            <button className="save" onClick={save} disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { preview, truncated } = getPreviewText(note.content, 20);

  return (
    <>
      <div className="note-card">
        <h3>{note.title}</h3>
        <p className="note-preview">
          {preview
            ? <>{preview}{truncated && <span className="preview-fade">…</span>}</>
            : <em style={{ color: 'var(--ink-soft)' }}>No content</em>
          }
        </p>
        {note.media && note.media.length > 0 && (
          <MediaGallery
            noteId={note.id}
            media={note.media.slice(0, 1)}
            onMediaChange={() => {}}
            readOnly
          />
        )}
        {note.tags && note.tags.length > 0 && (
          <div className="note-tags">
            {note.tags.map((tag) => (
              <button key={tag} className="tag-pill" onClick={() => onTagClick?.(tag)}>
                {tag}
              </button>
            ))}
          </div>
        )}
        <div className="note-meta">Updated {formattedDate}</div>
        <div className="note-actions">
          <button onClick={() => setMode('modal')}>View</button>
          <button onClick={() => setMode('edit')}>Edit</button>
          <button className="danger" onClick={() => onDelete(note.id)}>Delete</button>
        </div>
      </div>
      {mode === 'modal' && (
        <NoteViewModal
          note={{ ...note, content, tags, media }}
          onClose={() => setMode('view')}
          onEdit={() => setMode('edit')}
        />
      )}
    </>
  );
}