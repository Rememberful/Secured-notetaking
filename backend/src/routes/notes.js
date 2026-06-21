import { Router } from 'express';
import { pool } from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth); // every route below requires a valid session

// CREATE
router.post('/', async (req, res) => {
  const { title, content } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, title.trim(), content || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create note error:', err);
    res.status(500).json({ error: 'Could not create note' });
  }
});

// READ all (only this user's notes)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List notes error:', err);
    res.status(500).json({ error: 'Could not load notes' });
  }
});

// READ one
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Note not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get note error:', err);
    res.status(500).json({ error: 'Could not load note' });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  const { title, content } = req.body;

  try {
    const existing = await pool.query(
      'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    const note = existing.rows[0];
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const result = await pool.query(
      `UPDATE notes SET title = $1, content = $2, updated_at = now() WHERE id = $3 RETURNING *`,
      [title?.trim() || note.title, content ?? note.content, note.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update note error:', err);
    res.status(500).json({ error: 'Could not update note' });
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

    await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('Delete note error:', err);
    res.status(500).json({ error: 'Could not delete note' });
  }
});

export default router;