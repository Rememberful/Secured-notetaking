import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { message, devNote } | null
  const [error, setError] = useState('');
  const { apiUrl } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setResult({ message: data.message, devNote: data._devNote });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow">Notes</div>
        <h1>Reset your password</h1>
        <p className="auth-sub">
          Enter your account email and we'll generate a reset link.
        </p>

        {error && <div className="error-banner">{error}</div>}

        {result ? (
          <>
            <div className="info-banner">{result.message}</div>
            {result.devNote && (
              <div className="dev-note-banner">
                <strong>Demo note:</strong> {result.devNote}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="auth-switch">
          <Link to="/login"><button type="button">Back to sign in</button></Link>
        </div>
      </div>
    </div>
  );
}