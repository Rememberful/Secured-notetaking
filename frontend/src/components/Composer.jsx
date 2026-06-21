import React, { useState } from 'react';
import TagInput from './TagInput.jsx';

export default function Composer({ onCreate }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await onCreate({ title: title.trim(), content, tags });
    setTitle('');
    setContent('');
    setTags([]);
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
      <div className="composer-footer">
        <button className="btn btn-primary" type="submit" disabled={submitting || !title.trim()}>
          {submitting ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </form>
  );
}