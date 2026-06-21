import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton({ onError }) {
  const divRef = useRef(null);
  const { login, apiUrl } = useAuth();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('your_google_client_id')) {
      return; // not configured — render() below will show a placeholder instead
    }

    function handleCredentialResponse(response) {
      fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
          login(data.token, data.user);
        })
        .catch((err) => onError?.(err.message));
    }

    function tryInit() {
      if (!window.google?.accounts?.id) {
        // Google SDK script may not have loaded yet — retry briefly
        setTimeout(tryInit, 150);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(divRef.current, {
        theme: 'outline',
        size: 'large',
        width: 316,
        text: 'continue_with',
      });
    }

    tryInit();
  }, [apiUrl, login, onError]);

  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('your_google_client_id')) {
    return (
      <div
        style={{
          fontSize: 13,
          color: 'var(--ink-soft)',
          border: '1px dashed var(--rule)',
          borderRadius: 3,
          padding: '12px',
          textAlign: 'center',
        }}
      >
        Google Sign-In not configured yet. Add VITE_GOOGLE_CLIENT_ID to frontend/.env
      </div>
    );
  }

  return <div className="google-btn-wrap" ref={divRef} />;
}
