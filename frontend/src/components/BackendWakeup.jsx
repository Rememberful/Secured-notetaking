import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const POLL_INTERVAL = 2000;
const GIVEUP_AFTER  = 90000;
const WAKE_TIMEOUT  = 5000;

export default function BackendWakeup({ onReady }) {
  const { apiUrl } = useAuth();
  const [status, setStatus]   = useState('checking');
  const [elapsed, setElapsed] = useState(0);
  const startRef  = useRef(Date.now());
  const timerRef  = useRef(null);
  const pollRef   = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);

    async function ping() {
      try {
        const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          clearInterval(timerRef.current);
          clearInterval(pollRef.current);
          const tookMs = Date.now() - startRef.current;
          if (tookMs < WAKE_TIMEOUT) {
            onReady();
          } else {
            setStatus('ready');
            setTimeout(onReady, 1200);
          }
          return;
        }
      } catch {
        // still sleeping — keep polling
      }

      const age = Date.now() - startRef.current;
      if (age < WAKE_TIMEOUT) {
        setStatus('checking');
      } else if (age < GIVEUP_AFTER) {
        setStatus('waking');
      } else {
        clearInterval(timerRef.current);
        clearInterval(pollRef.current);
        setStatus('error');
      }
    }

    ping();
    pollRef.current = setInterval(ping, POLL_INTERVAL);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
    };
  }, [apiUrl, onReady]);

  if (status === 'checking') return null;

  if (status === 'ready') {
    return (
      <div className="wakeup-banner wakeup-banner-ready">
        <span className="wakeup-icon">✓</span>
        <span>Backend is ready!</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="wakeup-banner wakeup-banner-error">
        <span className="wakeup-icon">⚠</span>
        <span>Backend is taking unusually long to start. You can still try signing in.</span>
      </div>
    );
  }

  const progressPct = Math.min((elapsed / 60) * 100, 95);

  return (
    <div className="wakeup-banner">
      <div className="wakeup-top">
        <span className="wakeup-spinner" aria-hidden="true" />
        <span className="wakeup-text">
          Waking up the server… <strong>{elapsed}s</strong>
        </span>
        <span className="wakeup-note">Free tier sleeps after inactivity — usually takes 30–60s</span>
      </div>
      <div className="wakeup-track" role="progressbar" aria-valuenow={elapsed} aria-valuemax={60}>
        <div className="wakeup-fill" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}