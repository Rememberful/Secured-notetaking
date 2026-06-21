import React, { useState, useEffect, useRef } from 'react';

// Debounced search input — waits 300ms after the user stops typing before
// firing onSearch, so we're not hitting the API on every keystroke.
export default function SearchBar({ onSearch }) {
  const [value, setValue] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [value, onSearch]);

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search your notes…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Search notes"
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          onClick={() => setValue('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}