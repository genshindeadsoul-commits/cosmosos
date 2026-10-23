import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

interface AuthContextType {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signingIn: boolean;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Translate OAuth callback errors (?error=... or #error=...) into readable text. */
function readCallbackError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('error') || hash.get('error');
  if (!code) return null;
  const desc = params.get('error_description') || hash.get('error_description') || '';
  let msg: string;
  if (code === 'access_denied') msg = 'Sign-in was cancelled or access was denied.';
  else if (/redirect/i.test(desc)) msg = 'Redirect URL mismatch. The app URL must be listed in Supabase Auth → URL Configuration.';
  else msg = desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'Sign-in failed.';
  window.history.replaceState({}, document.title, window.location.pathname);
  return msg;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(() => readCallbackError());
  // Did we land here carrying a sign-in code? (Read once at mount, before the client finishes exchanging it.)
  const [cameBackWithCode] = useState(() => /[?&]code=/.test(window.location.search));

  // The ONE auth observer in the app. Effect cleanup unsubscribes, so StrictMode/HMR can't double-register.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) { setAuthError(error.message); setSession(data.session); setLoading(false); return; }
      if (cameBackWithCode && !data.session) {
        // The library exchanges the ?code= automatically but stays silent when it can't (e.g. its stored sign-in secret
        // is missing). Try once explicitly so we can report the real reason instead of just showing the login screen.
        const code = new URLSearchParams(window.location.search).get('code') ?? '';
        const hasSecret = Object.keys(localStorage).some((k) => k.endsWith('-code-verifier'));
        let reason = '';
        if (code) {
          const r = await supabase!.auth.exchangeCodeForSession(code);
          if (!active) return;
          if (r.data?.session) { window.history.replaceState({}, document.title, window.location.pathname); setSession(r.data.session); setLoading(false); return; }
          reason = r.error?.message ?? '';
        }
        setAuthError(`Google sign-in finished, but this page couldn’t complete it${reason ? ` (${reason.slice(0, 160)})` : ''}. ${hasSecret ? '' : 'This browser has no saved sign-in secret for this address. '}Sign-in has to finish on the same web address it started from, and you’re on ${window.location.host}. Open the app at its main address, or add this address to Supabase → Authentication → URL Configuration → Redirect URLs, then try again (click once and wait).`);
        window.history.replaceState({}, document.title, window.location.pathname);   // a reload must not retry a spent code
      }
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      if (event === 'SIGNED_OUT') setIsAdmin(false);
      setLoading(false);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Admin status comes from the database (app_admins row), never from client state.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!supabase || !userId) { setIsAdmin(false); return; }
    let active = true;
    supabase.from('app_admins').select('user_id').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (active) setIsAdmin(Boolean(data)); });
    return () => { active = false; };
  }, [userId]);

  const signingInRef = useRef(false);
  const [signingIn, setSigningIn] = useState(false);
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) { setAuthError('Supabase is not configured.'); return; }
    // One sign-in at a time: a second start would overwrite the first one's stored secret and the return trip would fail.
    if (signingInRef.current) return;
    signingInRef.current = true; setSigningIn(true);
    const stop = () => { signingInRef.current = false; setSigningIn(false); };
    setAuthError(null);
    // Pre-flight: if the provider is disabled, Supabase answers the redirect with a raw JSON error page.
    // Its public settings endpoint tells us first, so we can show a readable message instead.
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey ?? '' } });
      if (res.ok) {
        const settings = await res.json();
        if (settings?.external && settings.external.google === false) {
          setAuthError('Google sign-in is not enabled for this Supabase project. In Supabase go to Authentication → Sign In / Providers → Google, turn it on, and paste your Google Client ID and Secret (docs/SETUP.md, section 2).');
          stop(); return;
        }
      }
    } catch { /* offline or blocked: fall through and let the normal flow report the problem */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },  // identity only; Gmail etc. need separate consent
    });
    if (error) { setAuthError(error.message); stop(); }      // on success the page navigates away
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
    setSession(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      configured: isSupabaseConfigured, loading, session, user: session?.user ?? null, isAdmin, authError,
      signInWithGoogle, signingIn, signOut, clearAuthError: () => setAuthError(null),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
