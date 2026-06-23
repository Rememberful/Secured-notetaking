import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Composer from '../components/Composer.jsx';
import NoteCard from '../components/NoteCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import TagFilter from '../components/TagFilter.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import SessionWarningModal from '../components/SessionWarningModal.jsx';
import useSessionTimeout from '../hooks/useSessionTimeout.js';

export default function Dashboard() {
  const { token, user, logout, apiUrl } = useAuth();
  const [notes, setNotes]       = useState([]);
  const [allTags, setAllTags]   = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showWarning, setShowWarning] = useState(false);

  const composerSaveRef = useRef(null);
  const editCardSaveRef = useRef(null);

  const flushAllSaves = useCallback(async () => {
    const flushes = [];
    if (composerSaveRef.current?.flush) flushes.push(composerSaveRef.current.flush());
    if (editCardSaveRef.current?.flush)  flushes.push(editCardSaveRef.current.flush());
    await Promise.allSettled(flushes);
  }, []);

  const { warningSeconds, extendSession } = useSessionTimeout({
    onWarn: () => setShowWarning(true),
    onExpire: async () => {
      setShowWarning(false);
      await flushAllSaves();
      logout();
    },
  });

  useEffect(() => {
    function handleBeforeUnload(e) {
      if (composerSaveRef.current?.flush) composerSaveRef.current.flush();
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const authedFetch = useCallback(
    (path, options = {}) =>
      fetch(`${apiUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      }),
    [apiUrl, token]
  );

  const loadTags = useCallback(() => {
    authedFetch('/notes/tags/all')
      .then((res) => (res.ok ? res.json() : []))
      .then(setAllTags)
      .catch(() => {});
  }, [authedFetch]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (activeTag)   params.set('tag', activeTag);
    const qs = params.toString() ? `?${params.toString()}` : '';
    authedFetch(`/notes${qs}`)
      .then((res) => { if (!res.ok) throw new Error('Could not load notes'); return res.json(); })
      .then(setNotes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authedFetch, searchQuery, activeTag]);

  useEffect(() => { loadTags(); }, [loadTags]);

  async function handleCreate({ title, content, tags }) {
    setError('');
    try {
      const res = await authedFetch('/notes', {
        method: 'POST',
        body: JSON.stringify({ title, content, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create note');
      if (!activeTag || data.tags?.includes(activeTag)) {
        setNotes((prev) => [data, ...prev]);
      }
      loadTags();
      return data;
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdate(id, { title, content, tags }) {
    setError('');
    try {
      const res = await authedFetch(`/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update note');
      setNotes((prev) => {
        if (activeTag && !data.tags?.includes(activeTag)) {
          return prev.filter((n) => n.id !== id);
        }
        return prev
          .map((n) => (n.id === id ? data : n))
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      });
      loadTags();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    setError('');
    const prevNotes = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await authedFetch(`/notes/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not delete note');
      }
      loadTags();
    } catch (err) {
      setNotes(prevNotes);
      setError(err.message);
    }
  }

  const isFiltering = Boolean(searchQuery || activeTag);

  return (
    <div className="app-shell">
      {showWarning && warningSeconds !== null && (
        <SessionWarningModal
          secondsLeft={warningSeconds}
          onStay={() => { extendSession(); setShowWarning(false); }}
          onLogout={async () => { setShowWarning(false); await flushAllSaves(); logout(); }}
        />
      )}

      <header className="app-header">
        <div className="brand">
          <h1>Notes</h1>
          <span className="tag">{notes.length} {isFiltering ? 'found' : 'saved'}</span>
        </div>
        <div className="user-chip">
          <ThemeToggle />
          <span className="name">{user?.name || user?.email}</span>
          <button onClick={async () => { await flushAllSaves(); logout(); }}>Sign out</button>
        </div>
      </header>

      <main className="dashboard">
        {error && <div className="error-banner">{error}</div>}

        <Composer
          onCreate={handleCreate}
          onMediaUploaded={(noteId, uploaded) => {
            setNotes((prev) =>
              prev.map((n) =>
                n.id === noteId
                  ? { ...n, media: [...(n.media || []), ...uploaded] }
                  : n
              )
            );
          }}
          saveRef={composerSaveRef}
        />

        <SearchBar onSearch={setSearchQuery} />
        <TagFilter tags={allTags} activeTag={activeTag} onSelect={(t) => setActiveTag(t)} />

        {loading ? (
          <div className="loading-state">Loading your notes…</div>
        ) : notes.length === 0 ? (
          <div className="empty-state">
            <h3>{isFiltering ? 'No matching notes' : 'Nothing here yet'}</h3>
            <p>
              {isFiltering
                ? 'Try a different search term or clear the tag filter.'
                : 'Write your first note above to get started.'}
            </p>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onTagClick={(t) => setActiveTag(t)}
                editSaveRef={editCardSaveRef}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}