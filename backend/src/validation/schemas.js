import { z } from 'zod';

// Centralized input validation schemas using zod.
//
// Why this matters for security (not just correctness):
// - Rejects malformed/oversized input before it reaches business logic or the DB
//   (OWASP API8: Lack of Protection from Automated Threats / Injection-adjacent hardening)
// - Acts as an explicit allowlist of accepted fields — req.body is never spread
//   directly into a DB query anywhere in this app, so unexpected fields a client
//   sends (e.g. trying to set { role: 'admin' } during signup) are simply ignored,
//   not processed. This is the standard defense against mass assignment
//   (OWASP API6 / A08:2021 Software and Data Integrity Failures).
// - Centralizing limits (string lengths, etc.) means there's one place to audit,
//   not scattered ad-hoc checks across route handlers.

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address')
  .max(254); // RFC 5321 max email length

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .refine(
    (val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val),
    'Password must contain at least one letter and one number'
  );

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(100).optional().nullable(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const googleAuthSchema = z.object({
  credential: z.string().min(1).max(4096),
});

export const noteCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().max(50000).optional().default(''),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
});

export const noteUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
});

// Express middleware factory: validates req.body against a zod schema.
// On success, replaces req.body with the parsed (and coerced/trimmed) data —
// so downstream handlers always work with clean, validated values.
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return res.status(400).json({
        error: firstError?.message || 'Invalid request body',
      });
    }
    req.body = result.data;
    next();
  };
}