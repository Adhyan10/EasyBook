import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { request } from '../api/http.js';
import { queryCache } from '../lib/queryCache.js';
import { browserSessionStore } from '../lib/sessionStore.js';

const UNAUTHORIZED = 401;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const store = useRef(null);
  if (store.current === null) {
    store.current = browserSessionStore();
    store.current.clearLegacy();
  }
  // The saved user is trusted for rendering right away; /auth/me re-checks it in the background.
  const [session, setSession] = useState(() => store.current.read());
  const token = session?.token ?? null;
  const user = session?.user ?? null;

  const save = useCallback((next) => {
    store.current.write(next);
    setSession((previous) => {
      if (previous?.user?.id !== next?.user?.id) queryCache.clear();
      return next;
    });
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let isCurrent = true;
    request('/auth/me', { token })
      .then((data) => isCurrent && save({ token, user: data.user }))
      .catch((err) => {
        if (isCurrent && err.status === UNAUTHORIZED) save(null);
      });
    return () => {
      isCurrent = false;
    };
  }, [token, save]);

  const establish = useCallback(
    (data) => {
      save({ token: data.token, user: data.user });
      return data.user;
    },
    [save],
  );

  const login = useCallback(
    async (email, password) => establish(await request('/auth/login', { method: 'POST', body: { email, password } })),
    [establish],
  );
  const register = useCallback(
    async (fields) => establish(await request('/auth/register', { method: 'POST', body: fields })),
    [establish],
  );
  const logout = useCallback(() => save(null), [save]);
  const call = useCallback((path, options = {}) => request(path, { ...options, token }), [token]);

  const value = useMemo(
    () => ({ user, token, ready: true, login, register, logout, call }),
    [user, token, login, register, logout, call],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
