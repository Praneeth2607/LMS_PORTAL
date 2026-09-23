import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService.js';
import { getToken, setToken } from '../services/api.js';

const AuthContext = createContext(null);

// Single source of auth state: the JWT from the backend (localStorage) plus
// the user object from GET /api/auth/me.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(() => !getToken());

  useEffect(() => {
    if (!getToken()) return;
    authService
      .me()
      .then(setUser)
      .catch(() => {}) // a 401 clears the token inside api.js
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (credentials) => {
    const { token, user: loggedIn } = await authService.login(credentials);
    setToken(token);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const register = useCallback(async (details) => {
    const { token, user: created } = await authService.register(details);
    setToken(token);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
