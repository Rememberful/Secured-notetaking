import React, { useState, useRef } from 'react';
import TagInput from './TagInput.jsx';
import MediaGallery from './MediaGallery.jsx';

export default function Composer({ onCreate, onMediaUploaded }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
  const [media, setMedia] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    // Step 1: create the note — returns the saved note with a real id
    const note = await onCreate({ title: title.trim(), content, tags });

    // Step 2: upload any queued images against the real noteId
    if (note?.id && pendingRef.current) {
      const uploaded = await pendingRef.current.flush(note.id);
      if (uploaded.length > 0) {
        onMediaUploaded?.(note.id, uploaded);
      }
    }

    setTitle('');
    setContent('');
    setTags([]);
    setMedia([]);
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
      <textarea
        placeholder="Write something worth keeping…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
      />
      <TagInput tags={tags} onChange={setTags} placeholder="Add tags…" />
      <MediaGallery
        noteId={null}
        media={media}
        onMediaChange={setMedia}
        pendingRef={pendingRef}
      />
      <div className="composer-footer">
        <button className="btn btn-primary" type="submit" disabled={submitting || !title.trim()}>
          {submitting ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </form>
  );
}