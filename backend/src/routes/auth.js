import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db/db.js';
import { validateBody, signupSchema, loginSchema, googleAuthSchema, passwordSchema } from '../validation/schemas.js';
import { authAttemptLimiter, signupLimiter } from '../middleware/rateLimiters.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// JWT_ISSUER/JWT_AUDIENCE are fixed, app-internal constants (not secrets) —
// they don't need an env var. Including them lets requireAuth() reject tokens
// that weren't issued by this specific service, which matters if the JWT_SECRET
// were ever reused across services (defense in depth, OWASP API2).
const JWT_ISSUER = 'notes-app';
const JWT_AUDIENCE = 'notes-app-client';

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}

// ---- Email/password signup ----
router.post('/signup', signupLimiter, validateBody(signupSchema), async (req, res) => {
  // email is already trimmed + lowercased + validated by the zod schema
  const { email, password, name } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    // Cost factor 12 — meaningfully more brute-force resistant than 10 on
    // modern hardware, still fast enough (~250ms) not to hurt UX.
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [email, name || null, passwordHash]
    );

    const user = result.rows[0];
    const token = issueToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Could not create account' });
  }
});

// ---- Email/password login ----
router.post('/login', authAttemptLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Deliberately identical error for "no such user" and "wrong password" —
    // distinguishing them lets an attacker enumerate which emails have
    // accounts (OWASP API2: Broken Authentication / user enumeration).
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = issueToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Could not sign in' });
  }
});

// ---- Google Sign-In ----
// Frontend sends the ID token (credential) it got from Google's button.
// We verify it server-side — never trust a client-decoded token.
router.post('/google', authAttemptLimiter, validateBody(googleAuthSchema), async (req, res) => {
  const { credential } = req.body;

  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes('your_google_client_id')) {
    return res.status(500).json({ error: 'Server is missing GOOGLE_CLIENT_ID configuration' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email: rawEmail, name, email_verified } = payload;
    const email = rawEmail.trim().toLowerCase();

    if (!email_verified) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = result.rows[0];

    if (!user) {
      // Link to an existing email/password account if one matches, else create new
      const existingResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const existingByEmail = existingResult.rows[0];

      if (existingByEmail) {
        await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, existingByEmail.id]);
        user = { ...existingByEmail, google_id: googleId };
      } else {
        const insertResult = await pool.query(
          'INSERT INTO users (email, name, google_id) VALUES ($1, $2, $3) RETURNING *',
          [email, name || null, googleId]
        );
        user = insertResult.rows[0];
      }
    }

    const token = issueToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Google verification failed:', err.message);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// ---- Forgot password (stub) ----
// This generates and stores a real, single-use, expiring reset token —
// the cryptographic and DB logic is fully implemented and tested — but does
// NOT send an email, since that requires an email-delivery provider
// (Resend, SES, etc.) which hasn't been configured for this project yet.
// See README "Forgot password" section for what's needed to complete this.
//
// Deliberately returns the same generic response whether or not the email
// exists, to avoid leaking which emails have accounts (OWASP API2: user
// enumeration) — same principle as the /login error message.
router.post('/forgot-password', authAttemptLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      // Send the reset email via Resend
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
          to: email,
          subject: 'Reset your Notes password',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="margin-bottom: 8px;">Reset your password</h2>
              <p style="color: #555;">Click the link below to set a new password. This link expires in 1 hour.</p>
              <a href="${resetUrl}"
                 style="display: inline-block; margin: 24px 0; padding: 12px 24px;
                        background: #1c1b19; color: #fff; border-radius: 4px;
                        text-decoration: none; font-weight: 600;">
                Reset password
              </a>
              <p style="color: #999; font-size: 13px;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `,
        });
      } else {
        console.log(`[forgot-password] RESEND_API_KEY not set — reset link: ${resetUrl}`);
      }
    }

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Could not process request' });
  }
});

// ---- Reset password (stub counterpart) ----
// Fully functional IF a valid, unexpired, unused token is presented — the
// part that's missing is only the email step above that would deliver the
// token to the user in the first place.
router.post('/reset-password', authAttemptLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Reset token is required' });
  }
  const parsedPassword = passwordSchema.safeParse(newPassword);
  if (!parsedPassword.success) {
    return res.status(400).json({ error: parsedPassword.error.errors[0]?.message || 'Invalid password' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash]
    );
    const resetRecord = result.rows[0];
    if (!resetRecord) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }

    const passwordHash = await bcrypt.hash(parsedPassword.data, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      resetRecord.user_id,
    ]);
    await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [
      resetRecord.id,
    ]);

    res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Could not reset password' });
  }
});

export { JWT_ISSUER, JWT_AUDIENCE };
export default router;