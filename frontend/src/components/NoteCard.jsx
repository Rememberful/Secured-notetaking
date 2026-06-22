import React, { useState } from 'react';
import TagInput from './TagInput.jsx';
import MediaGallery from './MediaGallery.jsx';

export default function NoteCard({ note, onUpdate, onDelete, onTagClick }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags || []);
  const [media, setMedia] = useState(note.media || []);
  const [saving, setSaving] = useState(false);

  function cancel() {
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags || []);
    setMedia(note.media || []);
    setEditing(false);
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    await onUpdate(note.id, { title: title.trim(), content, tags });
    setSaving(false);
    setEditing(false);
  }

  // note.updated_at comes from Postgres as a TIMESTAMPTZ — already a valid
  // ISO string with timezone info, so it parses directly with no hacks.
  const formattedDate = new Date(note.updated_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (editing) {
    return (
      <div className="note-card">
        <input
          className="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoFocus
        />
        <textarea
          className="edit-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
        />
        <TagInput tags={tags} onChange={setTags} placeholder="Add tags…" />
        <MediaGallery noteId={note.id} media={media} onMediaChange={setMedia} />
        <div className="note-actions">
          <button onClick={cancel} disabled={saving}>Cancel</button>
          <button className="save" onClick={save} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="note-card">
      <h3>{note.title}</h3>
      <p>{note.content || <em style={{ color: '#b3ac9d' }}>No content</em>}</p>
      <MediaGallery noteId={note.id} media={note.media} onMediaChange={() => {}} readOnly />
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
        <button onClick={() => setEditing(true)}>Edit</button>
        <button className="danger" onClick={() => onDelete(note.id)}>Delete</button>
      </div>
    </div>
  );
}