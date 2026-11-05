import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { requireSupabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { PlaylistItem } from '../lib/playlists';
import type { CustomTaskListMeta } from '../types';

export type TaskWorkspaceView = 'calendar' | 'today' | 'upcoming' | 'all' | 'lists';

export type DashboardGridMode = '1-col' | '2-col' | 'auto';
export type DashboardWidgetId =
  | 'agenda'
  | 'tasks'
  | 'calendar'
  | 'focus'
  | 'notes'
  | 'finance'
  | 'fitness'
  | 'habits';

export interface DashboardGridPrefs {
  mode: DashboardGridMode;
  autoAdapt?: boolean;
  hiddenWidgets?: DashboardWidgetId[];
  widgetOrder?: DashboardWidgetId[];
}
export const DEFAULT_DASHBOARD_GRID: DashboardGridPrefs = {
  mode: 'auto',
  autoAdapt: true,
  hiddenWidgets: [],
  widgetOrder: ['agenda', 'tasks', 'calendar', 'focus', 'notes', 'finance', 'fitness', 'habits'],
};

export type CalendarTab = 'overview' | 'tasks' | 'notes' | 'workout' | 'expenses';

export interface AppleMusicPrefs { url: string | null; x: number; y: number; w: number; h: number; mode: 'compact' | 'expanded' | 'minimized'; visible: boolean }
export interface Prefs {
  appleMusic?: Partial<AppleMusicPrefs>;
  mailFolder?: string;
  playlists?: PlaylistItem[];
  activePlaylistId?: string;
  monthlyBudgets?: Record<string, number>;
  dashboardGrid?: DashboardGridPrefs;
  preferredCalendarTab?: CalendarTab;
  lastSelectedDate?: string;
  customTaskLists?: CustomTaskListMeta[];
  activeTaskWorkspaceView?: TaskWorkspaceView;
  selectedTaskList?: string;
}

interface PrefsContextType {
  prefs: Prefs;
  loaded: boolean;
  update: (patch: Prefs) => void;
  setMonthlyBudget: (monthKey: string, amount: number) => void;
  setDashboardGrid: (grid: Partial<DashboardGridPrefs>) => void;
  setPreferredCalendarTab: (tab: CalendarTab) => void;
  setLastSelectedDate: (date: string) => void;
  createCustomTaskList: (name: string, color?: string) => void;
  renameCustomTaskList: (oldName: string, newName: string) => void;
  updateCustomTaskList: (name: string, patch: Partial<CustomTaskListMeta>) => void;
  deleteCustomTaskList: (name: string) => void;
  setActiveTaskWorkspaceView: (view: TaskWorkspaceView) => void;
  setSelectedTaskList: (listName: string) => void;
}
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

  const setMonthlyBudget = useCallback((monthKey: string, amount: number) => {
    update({
      monthlyBudgets: {
        ...(latest.current.monthlyBudgets ?? {}),
        [monthKey]: Math.max(0, amount),
      },
    });
  }, [update]);

  const setDashboardGrid = useCallback((grid: Partial<DashboardGridPrefs>) => {
    update({
      dashboardGrid: {
        ...(latest.current.dashboardGrid ?? DEFAULT_DASHBOARD_GRID),
        ...grid,
      },
    });
  }, [update]);

  const setPreferredCalendarTab = useCallback((tab: CalendarTab) => {
    update({ preferredCalendarTab: tab });
  }, [update]);

  const setLastSelectedDate = useCallback((date: string) => {
    update({ lastSelectedDate: date });
  }, [update]);

  const createCustomTaskList = useCallback((name: string, color?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const currentLists = latest.current.customTaskLists ?? [];
    if (currentLists.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) return;
    const newList: CustomTaskListMeta = {
      id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      color: color || '#3B82F6',
      archived: false,
    };
    update({
      customTaskLists: [...currentLists, newList],
      selectedTaskList: trimmed,
    });
  }, [update]);

  const renameCustomTaskList = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || oldName === trimmed) return;
    const currentLists = latest.current.customTaskLists ?? [];
    update({
      customTaskLists: currentLists.map((l) =>
        l.name === oldName ? { ...l, name: trimmed } : l
      ),
      selectedTaskList: latest.current.selectedTaskList === oldName ? trimmed : latest.current.selectedTaskList,
    });
  }, [update]);

  const updateCustomTaskList = useCallback((name: string, patch: Partial<CustomTaskListMeta>) => {
    const currentLists = latest.current.customTaskLists ?? [];
    update({
      customTaskLists: currentLists.map((l) =>
        l.name === name ? { ...l, ...patch } : l
      ),
    });
  }, [update]);

  const deleteCustomTaskList = useCallback((name: string) => {
    const currentLists = latest.current.customTaskLists ?? [];
    update({
      customTaskLists: currentLists.filter((l) => l.name !== name),
      selectedTaskList: latest.current.selectedTaskList === name ? 'Inbox' : latest.current.selectedTaskList,
    });
  }, [update]);

  const setActiveTaskWorkspaceView = useCallback((view: TaskWorkspaceView) => {
    update({ activeTaskWorkspaceView: view });
  }, [update]);

  const setSelectedTaskList = useCallback((listName: string) => {
    update({ selectedTaskList: listName });
  }, [update]);

  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void save(); } }, [save]);   // flush on unmount

  return (
    <Ctx.Provider
      value={{
        prefs,
        loaded,
        update,
        setMonthlyBudget,
        setDashboardGrid,
        setPreferredCalendarTab,
        setLastSelectedDate,
        createCustomTaskList,
        renameCustomTaskList,
        updateCustomTaskList,
        deleteCustomTaskList,
        setActiveTaskWorkspaceView,
        setSelectedTaskList,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export function usePrefs(): PrefsContextType {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePrefs must be used inside PrefsProvider');
  return c;
}
