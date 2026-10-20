import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearLocalData, getMeta, setMeta } from '../db/db';
import { setCurrentUser } from '../db/mutate';
import { ensureDefaults } from '../db/actions';
import { supabase } from '../lib/supabase';
import { onAfterSync, startSync, stopSync } from '../sync/engine';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  recovering: boolean; // arrived via a password-reset link
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// Cached so the installed app opens offline even if the access token can't be refreshed.
const CACHED_USER_KEY = 'lula.user';

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHED_USER_KEY);
  } catch {
    // storage unavailable; the online session still works
  }
}

onAfterSync(ensureDefaults);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function activate(next: AuthUser) {
      // A different account on this device: drop the previous account's local data.
      const previous = await getMeta<string>('userId');
      if (previous && previous !== next.id) await clearLocalData();
      await setMeta('userId', next.id);
      setCurrentUser(next.id);
      writeCachedUser(next);
      if (!cancelled) setUser(next);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (s?.user) await activate({ id: s.user.id, email: s.user.email ?? '' });
      else if (!navigator.onLine) {
        const cached = readCachedUser();
        if (cached) await activate(cached);
      }
      if (!cancelled) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (session?.user && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY')) {
        void activate({ id: session.user.id, email: session.user.email ?? '' });
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    startSync();
    return stopSync;
  }, [user]);

  // Ask the browser not to evict IndexedDB; installed iOS PWAs are the main target.
  useEffect(() => {
    if (user) void navigator.storage?.persist?.();
  }, [user]);

  const value: AuthState = {
    user,
    loading,
    recovering,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      stopSync();
      await supabase.auth.signOut();
      // Explicit sign-out only: unsynced changes are lost, so the UI warns first.
      await clearLocalData();
      writeCachedUser(null);
      setCurrentUser(null);
      setUser(null);
    },
    clearRecovery: () => setRecovering(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
