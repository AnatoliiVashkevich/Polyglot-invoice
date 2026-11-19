// Who is signed in. The session is kept in the iPhone's secure storage (Keychain), so the app stays signed in.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { loadSession, publicRequest, saveSession, setSignedOutHandler, type Session } from '@/lib/api';

type Auth = {
  ready: boolean; // false while the saved session is being read
  signedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    loadSession().then((s) => {
      setSignedIn(!!s);
      setReady(true);
    });
    setSignedOutHandler(() => setSignedIn(false));
    return () => setSignedOutHandler(null);
  }, []);

  const start = useCallback(async (path: string, email: string, password: string) => {
    const s = await publicRequest<Session>(path, { email, password });
    await saveSession(s);
    setSignedIn(true);
  }, []);

  const value = useMemo<Auth>(
    () => ({
      ready,
      signedIn,
      signIn: (email, password) => start('/api/auth/login', email, password),
      signUp: (email, password) => start('/api/auth/signup', email, password),
      signOut: async () => {
        await saveSession(null);
        setSignedIn(false);
      },
    }),
    [ready, signedIn, start],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth outside AuthProvider');
  return auth;
}
