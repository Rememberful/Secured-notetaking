import React, { useState } from 'react';

// Chip-style tag editor. Type a tag name and press Enter or comma to add it,
// Backspace on an empty input removes the last tag, click × on a chip to remove it.
export default function TagInput({ tags, onChange, placeholder = 'Add a tag…' }) {
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const clean = draft.trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      onChange([...tags, clean]);
    }
    setDraft('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(tagToRemove) {
    onChange(tags.filter((t) => t !== tagToRemove));
  }

  return (
    <div className="tag-input">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`}>
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="tag-input-field"
      />
    </div>
  );
}