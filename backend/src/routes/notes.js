import { Router } from 'express';
import { pool } from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth); // every route below requires a valid session

// Explicit column list (instead of SELECT *) so the auto-generated
// search_vector column never leaks into API responses — it's an internal
// search-index artifact, not data the frontend needs.
const NOTE_COLUMNS = 'id, user_id, title, content, created_at, updated_at';

// Attaches a note to the given tag names for a user, creating any tags
// that don't exist yet. Replaces the note's existing tag set entirely
// (simplest mental model: "these are the tags now", not "add these tags").
// Must run inside the same transaction as the note write that calls it.
async function setNoteTags(client, userId, noteId, tagNames) {
  await client.query('DELETE FROM note_tags WHERE note_id = $1', [noteId]);

  if (!tagNames || tagNames.length === 0) return;

  // Normalize: trim, dedupe, drop empties
  const cleanNames = [...new Set(tagNames.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (cleanNames.length === 0) return;

  for (const name of cleanNames) {
    // Upsert the tag (create if missing, otherwise fetch existing id)
    const tagResult = await client.query(
      `INSERT INTO tags (user_id, name) VALUES ($1, $2)
       ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [userId, name]
    );
    const tagId = tagResult.rows[0].id;

    await client.query(
      `INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [noteId, tagId]
    );
  }
}

// Fetches tag names for a set of note ids in one query, grouped by note_id.
// Avoids an N+1 query pattern when listing many notes.
async function getTagsForNotes(noteIds) {
  if (noteIds.length === 0) return {};

  const result = await pool.query(
    `SELECT nt.note_id, t.name
     FROM note_tags nt
     JOIN tags t ON t.id = nt.tag_id
     WHERE nt.note_id = ANY($1::int[])
     ORDER BY t.name ASC`,
    [noteIds]
  );

  const byNoteId = {};
  for (const row of result.rows) {
    if (!byNoteId[row.note_id]) byNoteId[row.note_id] = [];
    byNoteId[row.note_id].push(row.name);
  }
  return byNoteId;
}

// CREATE
router.post('/', async (req, res) => {
  const { title, content, tags } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING ${NOTE_COLUMNS}`,
      [req.userId, title.trim(), content || '']
    );
    const note = result.rows[0];

    await setNoteTags(client, req.userId, note.id, tags);

    await client.query('COMMIT');
    res.status(201).json({ ...note, tags: tags ? [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))] : [] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create note error:', err);
    res.status(500).json({ error: 'Could not create note' });
  } finally {
    client.release();
  }
});

// READ all (only this user's notes), with optional search + tag filter
// Query params:
//   ?q=keyword       — full-text search across title + content
//   ?tag=work        — only notes tagged with this exact tag name
router.get('/', async (req, res) => {
  const { q, tag } = req.query;

  try {
    let notesResult;

    if (q && q.trim()) {
      // websearch_to_tsquery handles natural phrasing ("foo bar", "foo -bar", "\"exact phrase\"")
      // ts_rank ranks results by relevance using the weighted search_vector (title > content)
      notesResult = await pool.query(
        `SELECT ${NOTE_COLUMNS}, ts_rank(n.search_vector, websearch_to_tsquery('english', $2)) AS rank
         FROM notes n
         WHERE n.user_id = $1
           AND n.search_vector @@ websearch_to_tsquery('english', $2)
         ORDER BY rank DESC, n.updated_at DESC`,
        [req.userId, q.trim()]
      );
    } else {
      notesResult = await pool.query(
        `SELECT ${NOTE_COLUMNS} FROM notes WHERE user_id = $1 ORDER BY updated_at DESC`,
        [req.userId]
      );
    }

    let notes = notesResult.rows;

    const noteIds = notes.map((n) => n.id);
    const tagsByNoteId = await getTagsForNotes(noteIds);
    notes = notes.map((n) => ({ ...n, tags: tagsByNoteId[n.id] || [] }));

    if (tag && tag.trim()) {
      const wanted = tag.trim().toLowerCase();
      notes = notes.filter((n) => n.tags.includes(wanted));
    }

    res.json(notes);
  } catch (err) {
    console.error('List notes error:', err);
    res.status(500).json({ error: 'Could not load notes' });
  }
});

// READ all tags for the current user, with note counts — powers a tag sidebar/filter UI
router.get('/tags/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.name, COUNT(nt.note_id)::int AS note_count
       FROM tags t
       LEFT JOIN note_tags nt ON nt.tag_id = t.id
       WHERE t.user_id = $1
       GROUP BY t.id, t.name
       ORDER BY t.name ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List tags error:', err);
    res.status(500).json({ error: 'Could not load tags' });
  }
});

// READ one
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${NOTE_COLUMNS} FROM notes WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Note not found' });

    const tagsByNoteId = await getTagsForNotes([result.rows[0].id]);
    res.json({ ...result.rows[0], tags: tagsByNoteId[result.rows[0].id] || [] });
  } catch (err) {
    console.error('Get note error:', err);
    res.status(500).json({ error: 'Could not load note' });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  const { title, content, tags } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT ${NOTE_COLUMNS} FROM notes WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    const note = existing.rows[0];
    if (!note) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Note not found' });
    }

    const result = await client.query(
      `UPDATE notes SET title = $1, content = $2, updated_at = now() WHERE id = $3 RETURNING ${NOTE_COLUMNS}`,
      [title?.trim() || note.title, content ?? note.content, note.id]
    );

    // Only touch tags if the field was actually sent — lets clients update
    // just title/content without accidentally wiping tags.
    if (tags !== undefined) {
      await setNoteTags(client, req.userId, note.id, tags);
    }

    await client.query('COMMIT');

    const tagsByNoteId = await getTagsForNotes([note.id]);
    res.json({ ...result.rows[0], tags: tagsByNoteId[note.id] || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update note error:', err);
    res.status(500).json({ error: 'Could not update note' });
  } finally {
    client.release();
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Note not found' });

    // note_tags rows are cleaned up automatically via ON DELETE CASCADE
    await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('Delete note error:', err);
    res.status(500).json({ error: 'Could not delete note' });
  }
});

export default router;