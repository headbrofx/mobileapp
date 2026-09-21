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
  // The signed-in client's own patient record. Orbit is offered on the
  // gender recorded here, so the tab bar reads it — which is why it
  // lives in context rather than being fetched per screen. A screen
  // that fetched it would render the bar first and change it after.
  const [self, setSelf] = useState(null);
  const [loading, setLoading] = useState(true);

  const signOutLocally = useCallback(async () => {
    await clearTokens();
    setUser(null);
    setSelf(null);
  }, []);

  // Ask the API who this is, and adopt both halves of the answer.
  //
  // Sign-in and registration go through here too, rather than taking
  // the user off their own response: those responses carry no self,
  // and a tab bar that appears without Orbit and grows it a moment
  // later is worse than one extra request at sign-in.
  const refresh = useCallback(async () => {
    const data = await auth.me();
    setUser(data?.user ?? null);
    setSelf(data?.self ?? null);
    return data;
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => {
      setUser(null);
      setSelf(null);
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
        if (!cancelled) {
          setUser(data?.user ?? null);
          setSelf(data?.self ?? null);
        }
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

  const signIn = useCallback(
    async (identifier, password, { remember = true } = {}) => {
      const data = await auth.login(identifier, password);
      await saveTokens(data.tokens, { remember });
      setUser(data.user);
      await refresh();
    },
    [refresh]
  );

  const signInWithGoogle = useCallback(
    async (idToken, phone) => {
      const data = await auth.google(idToken, phone);
      await saveTokens(data.tokens);
      setUser(data.user);
      await refresh();
    },
    [refresh]
  );

  const register = useCallback(
    async (payload) => {
      const data = await auth.register(payload);
      await saveTokens(data.tokens);
      setUser(data.user);
      await refresh();
    },
    [refresh]
  );

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
    () => ({ user, self, loading, refresh, signIn, signInWithGoogle, register, signOut }),
    [user, self, loading, refresh, signIn, signInWithGoogle, register, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// Who Orbit is for.
//
// One rule in one place, because three things ask it: the tab bar, the
// menu, and the screen itself — the screen because neither of the
// other two guards a deep link or a back-button return.
//
// FEMALE sees it. MALE and OTHER do not.
//
// Unknown is the case worth explaining. Registration never asked until
// today, so every account that already exists has no gender recorded.
// Reading unknown as "no" would take Orbit away from every woman
// currently using it, without a word. So unknown still sees it, and
// the screen opens by asking — one tap, and the answer settles the tab
// from then on.
export function showsOrbit(self) {
  const gender = self?.gender ?? null;
  return gender === 'FEMALE' || gender === null;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside a SessionProvider');
  return context;
}
