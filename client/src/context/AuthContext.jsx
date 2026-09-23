import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService.js';
import { getToken, setToken } from '../services/api.js';

const AuthContext = createContext(null);

// Single source of auth state: the JWT from the backend (localStorage) plus
// the user object from GET /api/auth/me.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(() => !getToken());
  // True after the user clicks "Sign out" (as opposed to a session expiring), so
  // route guards send them home instead of remembering the page they were on.
  const [signedOut, setSignedOut] = useState(false);

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
    setSignedOut(false);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const register = useCallback(async (details) => {
    const { token, user: created } = await authService.register(details);
    setToken(token);
    setSignedOut(false);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setSignedOut(true);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signedOut, login, register, logout }),
    [user, ready, signedOut, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
