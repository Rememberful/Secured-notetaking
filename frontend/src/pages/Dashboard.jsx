import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Composer from '../components/Composer.jsx';
import NoteCard from '../components/NoteCard.jsx';

export default function Dashboard() {
  const { token, user, logout, apiUrl } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    authedFetch('/notes')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load notes');
        return res.json();
      })
      .then(setNotes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authedFetch]);

  async function handleCreate({ title, content }) {
    setError('');
    try {
      const res = await authedFetch('/notes', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create note');
      setNotes((prev) => [data, ...prev]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdate(id, { title, content }) {
    setError('');
    try {
      const res = await authedFetch(`/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update note');
      setNotes((prev) => prev.map((n) => (n.id === id ? data : n)).sort(
        (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
      ));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    setError('');
    const prevNotes = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id)); // optimistic
    try {
      const res = await authedFetch(`/notes/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not delete note');
      }
    } catch (err) {
      setNotes(prevNotes); // revert on failure
      setError(err.message);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <h1>Notes</h1>
          <span className="tag">{notes.length} saved</span>
        </div>
        <div className="user-chip">
          <span className="name">{user?.name || user?.email}</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="dashboard">
        {error && <div className="error-banner">{error}</div>}

        <Composer onCreate={handleCreate} />

        {loading ? (
          <div className="loading-state">Loading your notes…</div>
        ) : notes.length === 0 ? (
          <div className="empty-state">
            <h3>Nothing here yet</h3>
            <p>Write your first note above to get started.</p>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
