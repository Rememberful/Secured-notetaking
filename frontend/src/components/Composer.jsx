import React, { useState, useRef, useCallback, useEffect } from 'react';
import TagInput from './TagInput.jsx';
import MediaGallery from './MediaGallery.jsx';
import RichEditor from './RichEditor.jsx';
import useAutoSave from '../hooks/useAutoSave.js';
import { useAuth } from '../context/AuthContext.jsx';

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

export default function Composer({ onCreate, onMediaUploaded, saveRef }) {
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags]       = useState([]);
  const [media, setMedia]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef  = useRef(null);
  const savedNoteId = useRef(null);
  const { token, apiUrl } = useAuth();

  const autoSaveFn = useCallback(async () => {
    if (!title.trim()) return;

    if (!savedNoteId.current) {
      const note = await onCreate({ title: title.trim(), content, tags });
      if (note?.id) {
        savedNoteId.current = note.id;
        if (pendingRef.current) {
          const uploaded = await pendingRef.current.flush(note.id);
          if (uploaded.length > 0) onMediaUploaded?.(note.id, uploaded);
        }
      }
    } else {
      await fetch(`${apiUrl}/notes/${savedNoteId.current}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title.trim(), content, tags }),
      });
    }
  }, [title, content, tags, onCreate, onMediaUploaded, apiUrl, token]);

  const { status, flushSave } = useAutoSave(autoSaveFn, [title, content, tags], {
    delay: 3000,
    minContent: title,
  });

  useEffect(() => {
    if (saveRef) saveRef.current = { flush: flushSave };
  }, [saveRef, flushSave]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    if (savedNoteId.current) {
      await fetch(`${apiUrl}/notes/${savedNoteId.current}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title.trim(), content, tags }),
      });
    } else {
      const note = await onCreate({ title: title.trim(), content, tags });
      if (note?.id && pendingRef.current) {
        const uploaded = await pendingRef.current.flush(note.id);
        if (uploaded.length > 0) onMediaUploaded?.(note.id, uploaded);
      }
    }

    setTitle('');
    setContent('');
    setTags([]);
    setMedia([]);
    savedNoteId.current = null;
    setSubmitting(false);
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Note title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
      />
      <RichEditor
        content={content}
        onChange={setContent}
        placeholder="Write something worth keeping…"
      />
      <TagInput tags={tags} onChange={setTags} placeholder="Add tags…" />
      <MediaGallery
        noteId={null}
        media={media}
        onMediaChange={setMedia}
        pendingRef={pendingRef}
      />
      <div className="composer-footer">
        <SaveStatus status={status} />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={submitting || !title.trim()}
        >
          {submitting ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </form>
  );
}