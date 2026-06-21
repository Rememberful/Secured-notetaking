import React from 'react';

export default function TagFilter({ tags, activeTag, onSelect }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="tag-filter">
      <button
        className={`tag-filter-pill ${!activeTag ? 'active' : ''}`}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {tags.map((t) => (
        <button
          key={t.name}
          className={`tag-filter-pill ${activeTag === t.name ? 'active' : ''}`}
          onClick={() => onSelect(t.name)}
        >
          {t.name} <span className="tag-count">{t.note_count}</span>
        </button>
      ))}
    </div>
  );
}