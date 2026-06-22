import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'notes-app-theme'; // stores 'light' | 'dark' | 'system'

function getSystemPreference() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved) {
  document.documentElement.setAttribute('data-theme', resolved);
}

export function ThemeProvider({ children }) {
  // `mode` is the user's chosen setting (light/dark/system).
  // `resolved` is the actual light/dark value currently applied to the DOM.
  const [mode, setMode] = useState(() => localStorage.getItem(STORAGE_KEY) || 'system');
  const [resolved, setResolved] = useState(() =>
    mode === 'system' ? getSystemPreference() : mode
  );

  useEffect(() => {
    const next = mode === 'system' ? getSystemPreference() : mode;
    setResolved(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // While in "system" mode, react live if the OS-level preference changes
  // (e.g. the user's OS switches to dark mode at sunset) without needing a reload.
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next = getSystemPreference();
      setResolved(next);
      applyTheme(next);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode]);

  const cycleTheme = useCallback(() => {
    setMode((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}