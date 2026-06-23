import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser]   = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('login_time');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setUser(data.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, logout]);

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('login_time', String(Date.now()));
    setToken(newToken);
    setUser(newUser);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, apiUrl: API_URL }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}