import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, clearTokens, getAccessToken, saveTokens, setSessionLostHandler } from './api';

// Who is signed in, for the whole app.
//
// The API client cannot navigate — it has no router — so when a refresh
// finally fails it calls back here, and here is where the user is
// dropped to the login screen. That keeps the expiry handling in one
// place instead of every screen checking for a 401.

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const signOutLocally = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => {
      setUser(null);
    });
  }, []);

  // On launch, a stored token is only a claim. Ask the API who it
  // belongs to rather than trusting it — it may have been revoked from
  // another device since.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const data = await auth.me();
        if (!cancelled) setUser(data?.user ?? null);
      } catch {
        await clearTokens();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (identifier, password, { remember = true } = {}) => {
    const data = await auth.login(identifier, password);
    await saveTokens(data.tokens, { remember });
    setUser(data.user);
  }, []);

  const signInWithGoogle = useCallback(async (idToken, phone) => {
    const data = await auth.google(idToken, phone);
    await saveTokens(data.tokens);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload) => {
    const data = await auth.register(payload);
    await saveTokens(data.tokens);
    setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      // Tell the server so the refresh token is revoked rather than
      // left valid until it expires.
      await auth.logout();
    } catch {
      // Already gone, or offline. The local session goes either way.
    }
    await signOutLocally();
  }, [signOutLocally]);

  const value = useMemo(
    () => ({ user, loading, signIn, signInWithGoogle, register, signOut }),
    [user, loading, signIn, signInWithGoogle, register, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside a SessionProvider');
  return context;
}
