import jwt from 'jsonwebtoken';
import { JWT_ISSUER, JWT_AUDIENCE } from '../routes/auth.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Verifying issuer + audience (not just the signature) means a token
    // signed with this same JWT_SECRET for a different purpose/service
    // would still be rejected here — defense in depth, not just "is it signed".
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}