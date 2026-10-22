import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { requireSupabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface AppleMusicPrefs { url: string | null; x: number; y: number; w: number; h: number; mode: 'compact' | 'expanded' | 'minimized'; visible: boolean }
export interface Prefs { appleMusic?: Partial<AppleMusicPrefs>; mailFolder?: string }

interface PrefsContextType { prefs: Prefs; loaded: boolean; update: (patch: Prefs) => void }
const Ctx = createContext<PrefsContextType | undefined>(undefined);

/**
 * Workspace layout preferences live in user_settings.preferences (per user, RLS-protected). A localStorage copy,
 * keyed by user id, only avoids a flash of default layout; the database is authoritative. Contains no secrets.
 */
export const PrefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const cacheKey = `cosmos_prefs:${user?.id}`;
  const [prefs, setPrefs] = useState<Prefs>(() => { try { return JSON.parse(localStorage.getItem(cacheKey) ?? '{}'); } catch { return {}; } });
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(prefs); latest.current = prefs;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    requireSupabase().from('user_settings').select('preferences').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (!active) return;
      if (data?.preferences && typeof data.preferences === 'object' && !dirty.current) { setPrefs(data.preferences as Prefs); localStorage.setItem(cacheKey, JSON.stringify(data.preferences)); }
      setLoaded(true);
    });
    return () => { active = false; };
  }, [user?.id]);

  const save = useCallback(async () => {
    if (!user) return;
    localStorage.setItem(cacheKey, JSON.stringify(latest.current));
    const { error } = await requireSupabase().from('user_settings').upsert({ user_id: user.id, preferences: latest.current }, { onConflict: 'user_id' });
    if (error) console.warn('Could not save workspace preferences:', error.message);   // layout only; never blocks the UI
  }, [user?.id, cacheKey]);

  const update = useCallback((patch: Prefs) => {
    dirty.current = true;
    setPrefs((p) => ({ ...p, ...patch, ...(patch.appleMusic ? { appleMusic: { ...p.appleMusic, ...patch.appleMusic } } : {}) }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 700);
  }, [save]);

  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void save(); } }, [save]);   // flush on unmount

  return <Ctx.Provider value={{ prefs, loaded, update }}>{children}</Ctx.Provider>;
};

export function usePrefs(): PrefsContextType {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePrefs must be used inside PrefsProvider');
  return c;
}
