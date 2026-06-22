import rateLimit from 'express-rate-limit';

// OWASP API4:2023 (Unrestricted Resource Consumption) and a direct mitigation
// for brute-force credential attacks against /login and account-enumeration
// via repeated /signup attempts.
//
// Render sits behind a reverse proxy, so req.ip is only accurate once
// `app.set('trust proxy', 1)` is set in server.js — otherwise every request
// would appear to come from the same internal IP and rate limiting would be
// either useless (everyone shares one bucket) or wrong.

// Strict limiter for auth attempts that could be brute-forced (login).
export const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// Looser limiter for account creation — still bounded, but signups are
// naturally less frequent per-user than logins.
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this location. Please try again later.' },
});

// General-purpose limiter for all other API traffic — generous, just a
// backstop against scripted abuse rather than targeting any specific flow.
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});