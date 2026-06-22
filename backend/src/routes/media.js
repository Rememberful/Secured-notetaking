import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — matches the DB CHECK constraint

// Only these exact MIME types are accepted. This is checked against the
// actual decoded file signature below (not just the browser-supplied
// Content-Type header), since that header is trivially spoofable and trusting
// it is exactly the kind of "unrestricted file upload" issue OWASP flags
// (A04:2021 Insecure Design / API-equivalent: improper inventory of accepted
// media types). A malicious actor could rename a .html or .js file to
// "photo.jpg" and the browser-reported Content-Type would happily lie.
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Magic-byte signatures for the formats above. We check the first few bytes
// of the actual uploaded buffer against these before trusting the file at all.
function detectRealMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

// multer keeps the upload in memory (not written to disk) since we're
// storing straight into Postgres. fileSize limit is a first line of defense;
// the DB-level CHECK constraint on media.size_bytes is the backstop.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

// Strips any path components and unsafe characters from a client-supplied
// filename before storing it — defends against path-traversal-style payloads
// in the filename being reflected back later (e.g. in a Content-Disposition
// header) even though we never write to disk using this value.
function sanitizeFilename(name) {
  const base = name.split(/[/\\]/).pop() || 'upload';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

// UPLOAD — attach an image to a note the user owns
router.post('/notes/:noteId/media', upload.single('file'), async (req, res) => {
  if (!/^\d+$/.test(req.params.noteId)) {
    return res.status(400).json({ error: 'Invalid note id' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded (expected field name "file")' });
  }

  const realType = detectRealMimeType(req.file.buffer);
  if (!realType || !ALLOWED_MIME_TYPES.has(realType)) {
    return res.status(415).json({
      error: 'Unsupported file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
    });
  }

  try {
    // Ownership check: the note must belong to the authenticated user.
    // Without this, any logged-in user could attach files to ANY note id
    // by guessing/incrementing ids (OWASP API1: Broken Object Level Authorization).
    const noteCheck = await pool.query(
      'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.noteId, req.userId]
    );
    if (!noteCheck.rows[0]) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const filename = sanitizeFilename(req.file.originalname);

    const result = await pool.query(
      `INSERT INTO media (note_id, user_id, filename, mime_type, size_bytes, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, note_id, filename, mime_type, size_bytes, created_at`,
      [req.params.noteId, req.userId, filename, realType, req.file.size, req.file.buffer]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      // Postgres CHECK constraint violation code — the size cap backstop fired
      return res.status(413).json({ error: 'File is too large (max 2MB)' });
    }
    console.error('Media upload error:', err);
    res.status(500).json({ error: 'Could not upload file' });
  }
});

// FETCH — stream the actual image bytes back, scoped to the owner
router.get('/media/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid media id' });
  }

  try {
    const result = await pool.query(
      'SELECT mime_type, data, filename FROM media WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    const file = result.rows[0];
    if (!file) return res.status(404).json({ error: 'File not found' });

    res.set('Content-Type', file.mime_type);
    // inline (not attachment) so images render in <img> tags; filename is
    // sanitized at upload time so it's safe to echo back here.
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    // Private cache only — this is per-user content behind auth, must never
    // be cached by a shared/CDN cache (OWASP API3: excessive data exposure
    // via caching infrastructure that doesn't know about per-user auth).
    res.set('Cache-Control', 'private, max-age=3600');
    // Explicitly coerce to a Buffer before sending. node-postgres normally
    // returns BYTEA columns as a true Buffer already, but res.send() silently
    // JSON-serializes anything that ISN'T recognized as Buffer/string/stream
    // (e.g. a plain Uint8Array or array-like object) instead of erroring —
    // which would corrupt every downloaded file with no obvious symptom
    // until you compare bytes. Buffer.from() is a safe no-op if it's already
    // a real Buffer, and correctly converts other binary-like shapes.
    res.send(Buffer.from(file.data));
  } catch (err) {
    console.error('Media fetch error:', err);
    res.status(500).json({ error: 'Could not load file' });
  }
});

// DELETE
router.delete('/media/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid media id' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM media WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'File not found' });

    await pool.query('DELETE FROM media WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error('Media delete error:', err);
    res.status(500).json({ error: 'Could not delete file' });
  }
});

// Multer-specific error handler (must come after the routes that use `upload`)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File is too large (max 2MB)' });
    }
    return res.status(400).json({ error: 'File upload error' });
  }
  next(err);
});

export default router;