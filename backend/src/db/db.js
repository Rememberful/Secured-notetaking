import pg from 'pg';

const { Pool } = pg;

// Render's internal Postgres connection string already requires SSL on
// external connections but not internal ones. We detect based on the
// connection string host to avoid SSL errors on Render's internal network,
// while still requiring SSL when connecting from outside (e.g. local dev
// against a Render DB, or any other managed Postgres).
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const isInternal = connectionString.includes('.internal');

export const pool = new Pool({
  connectionString,
  ssl: isInternal ? false : { rejectUnauthorized: false },
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
  `);

  // --- Tags ---
  // Tags are scoped per-user (two users can each have their own "work" tag,
  // they don't share a global tag namespace). Name is unique per user.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, name)
    );
  `);

  // Join table: many-to-many between notes and tags.
  // Composite primary key prevents the same tag being attached twice to one note.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
  `);

  // --- Full-text search ---
  // A generated tsvector column, auto-maintained by Postgres on every
  // INSERT/UPDATE — no application code needs to keep it in sync.
  // Weight 'A' (title) ranks higher in search results than weight 'B' (content).
  await pool.query(`
    ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_vector tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B')
      ) STORED;
  `);

  // GIN index makes full-text search fast even on large note collections.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notes_search_vector ON notes USING GIN (search_vector);
  `);

  // --- Media (images attached to notes) ---
  // Stored directly as bytea in Postgres rather than external object storage —
  // a deliberate simplicity tradeoff for this project (see README). Enforced
  // size cap happens at the application layer (multer + an explicit check),
  // not here, but a DB-level CHECK constraint is added too as defense in depth
  // so a bug in the application layer can't silently bypass the limit.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes <= 2097152), -- 2MB hard ceiling
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_media_note_id ON media(note_id);
  `);

  // --- Password reset tokens (stub — email delivery not yet wired up) ---
  // Schema exists now so the feature can be completed later without another
  // migration. See README for what's still needed (an email provider) before
  // this is functional end-to-end.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
  `);
}