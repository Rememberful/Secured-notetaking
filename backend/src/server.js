import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { pool, initDb } from './db/db.js';
import authRoutes, { JWT_ISSUER, JWT_AUDIENCE } from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import mediaRoutes from './routes/media.js';
import { generalApiLimiter } from './middleware/rateLimiters.js';

const app = express();

// Render (and most PaaS hosts) sit behind a reverse proxy. Without this,
// req.ip always reports the proxy's internal IP rather than the real client
// IP, which would make rate limiting either share one bucket across every
// user or silently not work at all.
app.set('trust proxy', 1);

// helmet sets a broad set of security-relevant HTTP response headers in one
// call: X-Content-Type-Options (anti MIME-sniffing), X-Frame-Options
// (clickjacking), a baseline Content-Security-Policy, HSTS, and more.
// (OWASP A05:2021 Security Misconfiguration)
app.use(helmet());

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));

// Explicit body size limit — without this express.json() still has a
// default (100kb), but leaving it implicit/undocumented is exactly the kind
// of "security misconfiguration" OWASP flags. Set deliberately here so it's
// visible and intentional. Note: media uploads use multer with its own
// separate limit and bypass this JSON body parser entirely (multipart data).
app.use(express.json({ limit: '256kb' }));

// General rate limit as a backstop on all API traffic; auth routes layer
// stricter limiters on top of this (see routes/auth.js).
app.use('/api', generalApiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api', mediaRoutes); // mounts /api/notes/:noteId/media and /api/media/:id

// GET /api/auth/me — quick helper to check current session & fetch user
app.get('/api/auth/me', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [payload.sub]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});

// Centralized error handler — never leak stack traces or internal error
// details to the client (OWASP A09: Security Logging and Monitoring
// Failures / information disclosure). Full detail goes to the server log only.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 4000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });