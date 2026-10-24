import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request } from '../api/http.js';

const TOKEN_KEY = 'easybook.token';
const AuthContext = createContext(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked (private mode); the session just won't persist.
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(() => !readToken());

  useEffect(() => {
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    request('/auth/me', { token })
      .then((data) => setUser(data.user))
      .catch(() => {
        writeToken(null);
        setToken(null);
      })
      .finally(() => setReady(true));
  }, [token]);

  const establish = useCallback((data) => {
    writeToken(data.token);
    setUser(data.user);
    setToken(data.token);
    return data.user;
  }, []);

  const login = useCallback(
    async (email, password) => establish(await request('/auth/login', { method: 'POST', body: { email, password } })),
    [establish],
  );
  const register = useCallback(
    async (fields) => establish(await request('/auth/register', { method: 'POST', body: fields })),
    [establish],
  );
  const logout = useCallback(() => {
    writeToken(null);
    setUser(null);
    setToken(null);
  }, []);
  const call = useCallback((path, options = {}) => request(path, { ...options, token }), [token]);

  const value = useMemo(
    () => ({ user, token, ready, login, register, logout, call }),
    [user, token, ready, login, register, logout, call],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
