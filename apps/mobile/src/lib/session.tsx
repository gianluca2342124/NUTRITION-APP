import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { backendConfigured } from './env';
import { supabase } from './supabase';

type Status = 'loading' | 'ready' | 'unconfigured' | 'error';

interface SessionValue {
  status: Status;
  session: Session | null;
  userId: string | null;
  isAnonymous: boolean;
  error: string | null;
  /** Converts the guest profile into an email account (keeps all data). */
  createAccount(email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

async function ensureSession(): Promise<Session> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session;
  // Try before you sign up: a guest profile with real, private storage.
  const res = await sb.auth.signInAnonymously();
  if (res.error || !res.data.session) throw res.error ?? new Error('Anonymous sign-in failed');
  return res.data.session;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(backendConfigured ? 'loading' : 'unconfigured');
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!backendConfigured) return;
    let mounted = true;
    ensureSession()
      .then((s) => {
        if (!mounted) return;
        setSession(s);
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Session error');
        setStatus('error');
      });
    const { data } = supabase().auth.onAuthStateChange((_event, next) => {
      if (mounted && next) setSession(next);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value: SessionValue = {
    status,
    session,
    userId: session?.user.id ?? null,
    isAnonymous: session?.user.is_anonymous ?? false,
    error,
    async createAccount(email, password) {
      const { error: e } = await supabase().auth.updateUser({ email, password });
      if (e) throw e;
    },
    async signIn(email, password) {
      const { error: e } = await supabase().auth.signInWithPassword({ email, password });
      if (e) throw e;
    },
    async signOut() {
      await supabase().auth.signOut();
      setSession(await ensureSession());
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
