import React, { useState } from 'react';

export default function NoteCard({ note, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);

  function cancel() {
    setTitle(note.title);
    setContent(note.content);
    setEditing(false);
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    await onUpdate(note.id, { title: title.trim(), content });
    setSaving(false);
    setEditing(false);
  }

  const formattedDate = new Date(note.updated_at + 'Z').toLocaleDateString(undefined, {
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
      <div className="note-meta">Updated {formattedDate}</div>
      <div className="note-actions">
        <button onClick={() => setEditing(true)}>Edit</button>
        <button className="danger" onClick={() => onDelete(note.id)}>Delete</button>
      </div>
    </div>
  );
}
