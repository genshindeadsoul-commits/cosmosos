import React, { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  ModuleType,
  Task,
  CalendarEvent,
  Note,
  TableCollection,
  NewTable,
  Transaction,
  Subscription,
  WorkoutLog,
  Goal,
  Habit,
  CustomTracker,
  IntegrationAccount,
  ThemePreference,
  UserProfile,
  GmailMessage,
} from '../types';
import { CosmosAppData, EMPTY_DATA, newId, healIds, describeSaveFailures, computeStreak } from '../data/cloudData';
import { loadUserData, applyChanges, planChanges, toRows } from '../data/cloudStore';
import { TABLE_ORDER } from '../data/cloudData';
import type { RowSet } from '../data/cloudData';
import { exportCosmosBackup, parseBackup } from '../data/backup';
import { useAuth } from './AuthContext';
import { nextOccurrence } from '../lib/recurrence';
import type { ImportedEvent } from '../lib/integrationsApi';
import { supabase } from '../lib/supabase';
import { dateNoteTitle, dateNoteContent, isUntouchedDateNote, todayKey } from '../lib/dates';
import { getNextSubscriptionDate } from '../lib/finance';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface AppContextType {
  activeModule: ModuleType;
  setActiveModule: (mod: ModuleType) => void;
  
  // Theme & Appearance (Controlled exclusively via Settings)
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  effectiveTheme: 'light' | 'dark';
  
  // Sidebar
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  
  // User Profile
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  isProfileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  
  // Core Entities
  tasks: Task[];
  events: CalendarEvent[];
  notes: Note[];
  tables: TableCollection[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  workouts: WorkoutLog[];
  goals: Goal[];
  habits: Habit[];
  trackers: CustomTracker[];
  
  // Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  bulkUpdateTasks: (ids: string[], patch: Partial<Task>) => void;
  bulkDeleteTasks: (ids: string[]) => void;
  renameTaskList: (oldName: string, newName: string) => void;
  deleteTaskList: (name: string, targetListForTasks?: string | null) => void;
  
  // Events
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (event: CalendarEvent) => void;
  deleteEvent: (id: string) => void;
  
  // Notes
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  addDateNote: (date: string) => Note;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  toggleStarNote: (id: string) => void;
  
  // Tables
  selectedTableId: string;
  setSelectedTableId: (id: string) => void;
  addTableRow: (tableId: string, row: Record<string, any>) => void;
  addTableRows: (tableId: string, rows: Record<string, any>[]) => void;
  updateTableRow: (tableId: string, rowId: string, row: Record<string, any>) => void;
  deleteTableRow: (tableId: string, rowId: string) => void;
  duplicateTableRow: (tableId: string, rowId: string) => void;
  addTableCollection: (table: NewTable) => void;
  updateTableCollection: (tableId: string, updates: Partial<TableCollection>) => void;
  deleteTableCollection: (tableId: string) => void;
  duplicateTableCollection: (tableId: string, includeRows: boolean) => void;
  archiveTableCollection: (tableId: string) => void;
  restoreTableCollection: (tableId: string) => void;
  
  // Transactions & Subscriptions
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  addTransactions: (txs: Omit<Transaction, 'id'>[]) => void;
  updateTransaction: (tx: Transaction) => void;
  duplicateTransaction: (id: string) => void;
  deleteTransaction: (id: string) => void;
  reassignCategory: (oldCategory: string, newCategory: string) => void;
  addSubscription: (sub: Omit<Subscription, 'id'>) => void;
  updateSubscription: (sub: Subscription) => void;
  deleteSubscription: (id: string) => void;
  recordSubscriptionPayment: (subscriptionId: string, paidDate?: string) => void;
  
  // Fitness
  addWorkout: (w: Omit<WorkoutLog, 'id'>) => void;
  deleteWorkout: (id: string) => void;
  
  // Goals & Habits
  addGoal: (g: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  incrementGoal: (id: string, delta?: number) => void;
  deleteGoal: (id: string) => void;
  toggleHabitCheckin: (habitId: string, date: string) => void;
  addHabit: (h: Omit<Habit, 'id' | 'streak' | 'checkins'>) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  
  // Trackers
  selectedTrackerId: string;
  setSelectedTrackerId: (id: string) => void;
  addTrackerEntry: (trackerId: string, value: number, date?: string, notes?: string) => void;
  deleteTrackerEntry: (trackerId: string, entryId: string) => void;
  addCustomTracker: (tracker: Omit<CustomTracker, 'id' | 'entries'>) => void;
  updateCustomTracker: (id: string, updates: Partial<CustomTracker>) => void;
  deleteCustomTracker: (id: string) => void;
  
  // Integrations & Diagnostics
  
  
  importCalendarEvents: (incoming: ImportedEvent[]) => { added: number; updated: number };
  refreshImportedWorkouts: () => Promise<void>;
  focusRecord: { kind: string; id: string } | null;
  setFocusRecord: (r: { kind: string; id: string } | null) => void;
  signOutUser: () => Promise<void>;

  // Persistence status (Supabase is the source of truth)
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  retrySave: () => void;

  // Backup / Restore
  exportBackup: () => void;
  getCosmosData: () => CosmosAppData;
  mergeRecords: (d: CosmosAppData) => void;
  replaceAllData: (d: CosmosAppData) => void;
  importBackup: (jsonContent: string) => { success: boolean; error?: string };
  resetAllData: () => void;
  
  // Global Modals
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  isQuickCaptureOpen: boolean;
  setQuickCaptureOpen: (open: boolean) => void;
  quickCaptureTab: 'task' | 'note' | 'expense' | 'workout' | 'habit';
  openQuickCapture: (tab?: 'task' | 'note' | 'expense' | 'workout' | 'habit') => void;
  
  // Music Hub (Single floating player)
  musicHub: { open: boolean; minimized: boolean; focusTick: number };
  toggleMusicHub: () => void;
  openMusicHub: () => void;
  closeMusicHub: () => void;
  setMusicMinimized: (minimized: boolean) => void;
  
  // Focus Timer
  focusDurationMins: number;
  setFocusDurationMins: (mins: number) => void;
  focusTaskTitle: string;
  setFocusTaskTitle: (title: string) => void;
  isFocusRunning: boolean;
  focusSecondsLeft: number;
  toggleFocusTimer: () => void;
  resetFocusTimer: () => void;
  
  // Toasts
  toasts: Toast[];
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const ROUTABLE: ModuleType[] = ['dashboard', 'notes', 'tables', 'expenses', 'fitness', 'goals', 'trackers', 'tasks', 'mail', 'settings'];
export const moduleFromPath = (pathname: string): ModuleType => {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/')[0] as ModuleType;
  return ROUTABLE.includes(seg) ? seg : 'dashboard';
};
export const pathForModule = (m: ModuleType) => (m === 'dashboard' ? '/' : `/${m}`);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Minimal URL router: /notes, /tasks, ... (dashboard = "/"). Back/forward and deep links work; no extra dependency.
  const [activeModule, setActiveModuleState] = useState<ModuleType>(() => moduleFromPath(window.location.pathname));
  const setActiveModule = (mod: ModuleType) => {
    setActiveModuleState(mod);
    const target = pathForModule(mod);
    if (window.location.pathname !== target) window.history.pushState({ module: mod }, '', target);
  };
  useEffect(() => {
    const onPop = () => setActiveModuleState(moduleFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  
  // Theme Preference: 'light' | 'dark' | 'system'
  const [themePreference, setThemePrefState] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('cosmos_theme_cache');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved as ThemePreference;
    }
    return 'system';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    return typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  });

  // Effective theme computed
  const effectiveTheme: 'light' | 'dark' = useMemo(() => {
    if (themePreference === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return themePreference;
  }, [themePreference, systemIsDark]);

  // Listen to system dark mode changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Sync effectiveTheme to root DOM class
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  const setThemePreference = (pref: ThemePreference) => {
    setThemePrefState(pref);
    localStorage.setItem('cosmos_theme_cache', pref);   // cache only; user_settings is authoritative
    if (supabase && user) {
      supabase.from('user_settings').upsert({ user_id: user.id, theme: pref }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) showToast(`Theme not saved to your account: ${error.message}`, 'error');
          else showToast(`Theme updated to ${pref.toUpperCase()}`, 'info');
        });
    }
  };

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // User Profile: derived from the authenticated account, never hardcoded.
  const { user, signOut: authSignOut } = useAuth();
  const [displayName, setDisplayName] = useState<string>(() => {
    if (user?.id) {
      try {
        const cached = localStorage.getItem(`cosmos_profile_name:${user.id}`);
        if (cached?.trim()) return cached.trim();
      } catch {}
    }
    return (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User') as string;
  });

  // Keep displayName in sync when the user session becomes available
  useEffect(() => {
    if (!user?.id) return;
    try {
      const cached = localStorage.getItem(`cosmos_profile_name:${user.id}`);
      if (cached?.trim()) {
        setDisplayName(cached.trim());
        return;
      }
    } catch {}
    const authFallback = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User') as string;
    setDisplayName((prev) => (prev === 'User' || !prev ? authFallback : prev));
  }, [user?.id]);

  const userProfile: UserProfile = useMemo(() => ({
    name: displayName,
    email: user?.email ?? '',
    workspaceName: `${displayName}'s Workspace`,
    avatarInitials: (displayName.trim()[0] ?? 'U').toUpperCase(),
    role: 'Member',
    accountType: 'Cloud Synchronized',
  }), [displayName, user?.email]);

  const [isProfileOpen, setProfileOpen] = useState(false);

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    // Only display name is editable; email comes from the auth provider and role from the database.
    const nextName = updates.name?.trim();
    if (!nextName || !supabase || !user) return;
    supabase.from('profiles').update({ display_name: nextName }).eq('id', user.id).then(({ error }) => {
      if (error) { showToast(`Profile not saved: ${error.message}`, 'error'); return; }
      setDisplayName(nextName);
      try {
        localStorage.setItem(`cosmos_profile_name:${user.id}`, nextName);
      } catch {}
      showToast('Profile updated', 'success');
    });
  };

  // App Data
  const [data, setDataRaw] = useState<CosmosAppData | null>(null);
  // Single choke point for ALL record updates: any temporary/non-UUID id is repaired here, once, with references kept
  // consistent, so a view can never poison the shared save queue (the "r-1792730074210" bug).
  const pendingRemap = useRef(new Map<string, string>());
  const setData: React.Dispatch<React.SetStateAction<CosmosAppData | null>> = (update) =>
    setDataRaw((prev) => {
      const next = typeof update === 'function' ? (update as (p: CosmosAppData | null) => CosmosAppData | null)(prev) : update;
      if (!next) return next;
      const healed = healIds(next);
      healed.map.forEach((v, k) => pendingRemap.current.set(k, v));
      return healed.data;
    });
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedTrackerId, setSelectedTrackerId] = useState<string>('');
  
  // Modals
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isQuickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [quickCaptureTab, setQuickCaptureTab] = useState<'task' | 'note' | 'expense' | 'workout' | 'habit'>('task');
  
  // Music Hub (Single floating player, non-persisted visibility)
  const [musicHub, setMusicHub] = useState<{ open: boolean; minimized: boolean; focusTick: number }>({
    open: false,
    minimized: false,
    focusTick: 0,
  });
  const toggleMusicHub = useCallback(() => {
    setMusicHub((prev) => {
      if (!prev.open) return { open: true, minimized: false, focusTick: prev.focusTick + 1 };
      if (!prev.minimized) return { open: true, minimized: true, focusTick: prev.focusTick };
      return { open: true, minimized: false, focusTick: prev.focusTick + 1 };
    });
  }, []);
  const openMusicHub = useCallback(() => {
    setMusicHub((prev) => ({ open: true, minimized: false, focusTick: prev.focusTick + 1 }));
  }, []);
  const closeMusicHub = useCallback(() => {
    setMusicHub((prev) => ({ open: false, minimized: false, focusTick: prev.focusTick }));
  }, []);
  const setMusicMinimized = useCallback((minimized: boolean) => {
    setMusicHub((prev) => ({ ...prev, minimized }));
  }, []);

  // Focus Timer
  const [focusDurationMins, setFocusDurationMins] = useState(30);
  const [focusTaskTitle, setFocusTaskTitle] = useState('Cleaning up desk');
  const [isFocusRunning, setIsFocusRunning] = useState(false);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(30 * 60);
  
  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // ---- Load from Supabase (runs once per signed-in user; AppProvider is keyed by user id) ----
  const [focusRecord, setFocusRecord] = useState<{ kind: string; id: string } | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const syncedRows = useRef<RowSet | null>(null);   // what the server is known to hold

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadState('loading');
    Promise.all([
      loadUserData(),
      supabase!.from('user_settings').select('theme').eq('user_id', user.id).maybeSingle(),
      supabase!.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    ]).then(([loaded, settings, profile]) => {
      if (!active) return;
      syncedRows.current = loaded.rows;
      setData(loaded.data);
      const th = settings.data?.theme;
      if (th === 'light' || th === 'dark' || th === 'system') { setThemePrefState(th); localStorage.setItem('cosmos_theme_cache', th); }
      if (profile.data?.display_name?.trim()) {
        const remoteName = profile.data.display_name.trim();
        setDisplayName(remoteName);
        try {
          localStorage.setItem(`cosmos_profile_name:${user.id}`, remoteName);
        } catch {}
      }
      setSelectedNoteId(loaded.data.notes[0]?.id ?? null);
      setSelectedTableId(loaded.data.tables[0]?.id ?? '');
      setSelectedTrackerId(loaded.data.trackers[0]?.id ?? '');
      setLoadError(null);
      setLoadState('ready');
    }).catch((err: Error) => {
      if (!active) return;
      setLoadError(err.message);
      setLoadState('error');
    });
    return () => { active = false; };
  }, [user?.id, loadNonce]);

  // ---- Save: debounce, diff against the last server-confirmed snapshot, serialize writes ----
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const saving = useRef(false);
  const dataRef = useRef<CosmosAppData | null>(null);
  dataRef.current = data;

  const retries = useRef(0);
  const lastToast = useRef('');
  const flush = async () => {
    if (saving.current || !syncedRows.current || !dataRef.current) return;
    const target = dataRef.current;
    const before = syncedRows.current;
    const nextRows = toRows(target);
    const plan = planChanges(before, nextRows);
    if (plan.isEmpty) { if (saveStatus === 'error') { setSaveError(null); setSaveStatus('saved'); } return; }
    saving.current = true;
    setSaveStatus('saving');
    try {
      const failures = await applyChanges(plan);
      // Only tables the server accepted advance the "known saved" snapshot; failed tables stay pending (edits are kept).
      const failedTables = new Set(failures.map((f) => f.table));
      syncedRows.current = Object.fromEntries(TABLE_ORDER.map((t) => [t, failedTables.has(t) ? before[t] : nextRows[t]])) as RowSet;
      if (failures.length === 0) {
        retries.current = 0; lastToast.current = '';
        setSaveError(null); setSaveStatus('saved');                       // "Saved" only after the server confirmed everything
      } else {
        const msg = describeSaveFailures(failures);
        setSaveError(msg); setSaveStatus('error');
        if (lastToast.current !== msg) { lastToast.current = msg; showToast(msg, 'error'); }
        if (retries.current++ < 3) setTimeout(() => void flush(), 8000 * retries.current);   // gentle automatic retry for transient problems
      }
    } catch (err) {
      const msg = describeSaveFailures([{ table: 'notes', message: (err as Error).message }]).replace('Notes', 'Your changes');
      setSaveError(msg); setSaveStatus('error');
    } finally {
      saving.current = false;
      if (dataRef.current !== target && saveStatusRetry.current) flushSoon();  // changed during save
    }
  };
  const retrySave = () => { retries.current = 0; lastToast.current = ''; void flush(); };

  /** Wait for any in-flight save, push remaining edits, report whether the server is fully up to date. */
  const flushNow = async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    for (let i = 0; i < 100 && saving.current; i++) await new Promise((r) => setTimeout(r, 50));
    await flush();
    if (!syncedRows.current || !dataRef.current) return true;
    return planChanges(syncedRows.current, toRows(dataRef.current)).isEmpty;
  };
  const signOut = async () => {
    const clean = await flushNow();
    if (!clean && !window.confirm('Some recent changes could not be saved. Sign out anyway and lose them?')) return;
    await authSignOut();
  };
  // If healing re-keyed a record the user had selected, follow it to its new id.
  useEffect(() => {
    if (pendingRemap.current.size === 0) return;
    const m = pendingRemap.current; pendingRemap.current = new Map();
    setSelectedNoteId((id) => (id && m.get(id)) || id);
    setSelectedTableId((id) => m.get(id) ?? id);
    setSelectedTrackerId((id) => m.get(id) ?? id);
  }, [data]);
  const saveStatusRetry = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSoon = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => void flush(), 600); };
  useEffect(() => {
    if (loadState !== 'ready' || !data) return;
    flushSoon();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [data, loadState]);
  // Warn if the tab closes with unsaved edits.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'saving' || saveStatus === 'error') { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saveStatus]);

  // Focus Timer effect
  useEffect(() => {
    let interval: any = null;
    if (isFocusRunning && focusSecondsLeft > 0) {
      interval = setInterval(() => {
        setFocusSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsFocusRunning(false);
            showToast(`Focus session completed: ${focusTaskTitle}`, 'success');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isFocusRunning, focusSecondsLeft, focusTaskTitle]);

  const toggleFocusTimer = () => {
    if (focusSecondsLeft <= 0) {
      setFocusSecondsLeft(focusDurationMins * 60);
    }
    setIsFocusRunning((prev) => {
      const next = !prev;
      if (next) {
        showToast(`Focus timer started (${focusDurationMins}m)`, 'info');
      }
      return next;
    });
  };

  const resetFocusTimer = () => {
    setIsFocusRunning(false);
    setFocusSecondsLeft(focusDurationMins * 60);
  };

  // Date-associated notes (Calendar <-> Notes)
  const lastDateNoteRef = useRef<Map<string, { note: Note; timestamp: number }>>(new Map());
  const addDateNote = useCallback((dateKey: string): Note => {
    const now = Date.now();
    const cached = lastDateNoteRef.current.get(dateKey);
    if (cached && now - cached.timestamp < 1500) {
      return cached.note;
    }
    const currentNotes = data?.notes ?? [];
    const existingUntouched = currentNotes.find((n: Note) => n.noteDate === dateKey && isUntouchedDateNote(n, dateKey));
    if (existingUntouched) {
      lastDateNoteRef.current.set(dateKey, { note: existingUntouched, timestamp: now });
      return existingUntouched;
    }
    const newNote: Note = {
      id: newId(),
      title: dateNoteTitle(dateKey),
      content: dateNoteContent(dateKey),
      excerpt: dateNoteTitle(dateKey),
      tags: ['Daily'],
      noteDate: dateKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setData((prev) => (prev ? { ...prev, notes: [newNote, ...prev.notes] } : prev));
    lastDateNoteRef.current.set(dateKey, { note: newNote, timestamp: now });
    return newNote;
  }, [data?.notes]);

  // Refresh imported workouts (Health Connect / Google Fit)
  const refreshImportedWorkouts = useCallback(async () => {
    if (!user?.id || !supabase) return;
    try {
      const { data: rows, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .or('source.not.is.null,external_id.not.is.null');
      if (error || !rows) return;
      const imported: WorkoutLog[] = rows.map((w: any) => ({
        id: String(w.id),
        title: String(w.title),
        date: String(w.workout_date).slice(0, 10),
        durationMinutes: w.duration_minutes == null ? null : Number(w.duration_minutes),
        calories: w.calories == null ? null : Number(w.calories),
        exercises: (w.exercises as WorkoutLog['exercises']) ?? [],
        notes: (w.notes as string) ?? undefined,
        source: (w.source as string) ?? undefined,
        externalId: (w.external_id as string) ?? undefined,
      }));
      if (imported.length === 0) return;
      setData((prev) => {
        if (!prev) return prev;
        const existingIds = new Set(prev.workouts.map((w: WorkoutLog) => w.id));
        const toAdd = imported.filter((w) => !existingIds.has(w.id));
        const updated = prev.workouts.map((w: WorkoutLog) => {
          const match = imported.find((m) => m.id === w.id);
          return match ?? w;
        });
        return { ...prev, workouts: [...updated, ...toAdd] };
      });
      if (syncedRows.current) {
        const existingIds = new Set(syncedRows.current.workouts.map((w) => w.id));
        const toAdd = imported.filter((w) => !existingIds.has(w.id));
        const updated = syncedRows.current.workouts.map((w) => {
          const match = imported.find((m) => m.id === w.id);
          return match ? { ...match, ...w } : w;
        });
        syncedRows.current = {
          ...syncedRows.current,
          workouts: [
            ...updated,
            ...toAdd.map((w) => ({
              id: w.id,
              title: w.title,
              workout_date: w.date,
              duration_minutes: w.durationMinutes,
              calories: w.calories,
              exercises: w.exercises ?? [],
              notes: w.notes ?? null,
              source: w.source ?? null,
              external_id: w.externalId ?? null,
            })),
          ],
        };
      }
    } catch {
      // ignore
    }
  }, [user?.id]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refreshImportedWorkouts();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshImportedWorkouts]);

  // Keyboard shortcut for Search (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Quick Capture helper
  const openQuickCapture = (tab: 'task' | 'note' | 'expense' | 'workout' | 'habit' = 'task') => {
    setQuickCaptureTab(tab);
    setQuickCaptureOpen(true);
  };

  // Task Handlers
  const addTask = (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    setData((prev) => (prev ? { ...prev, tasks: [newTask, ...prev.tasks] } : null));
    showToast(`Task added to ${newTask.list}`, 'success');
  };

  const updateTask = (updated: Task) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)),
          }
        : null
    );
  };

  const deleteTask = (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.filter((t) => t.id !== id),
          }
        : null
    );
    showToast('Task removed', 'info');
  };

  // Critical fix: toggle task completion persists immediately to storage
  const toggleTaskStatus = (id: string) => {
    setData((prev) => {
      if (!prev) return null;
      const target = prev.tasks.find((t) => t.id === id);
      if (!target) return prev;
      const completing = target.status !== 'completed';
      const tasks = prev.tasks.map((t) =>
        t.id === id
          ? { ...t, status: (completing ? 'completed' : 'todo') as Task['status'], completedAt: completing ? new Date().toISOString() : undefined }
          : t
      );
      // Completing a recurring task creates the next occurrence once (never a duplicate open one).
      if (completing && target.recurrence && target.dueDate) {
        const nextDue = nextOccurrence(target.dueDate, target.recurrence);
        const exists = prev.tasks.some((t) => t.id !== id && t.status !== 'completed' && t.title === target.title && t.recurrence === target.recurrence && t.dueDate === nextDue);
        if (!exists) {
          tasks.push({ ...target, id: newId(), status: 'todo', dueDate: nextDue, completedAt: undefined, createdAt: new Date().toISOString() });
        }
      }
      return { ...prev, tasks };
    });
  };

  const bulkUpdateTasks = (ids: string[], patch: Partial<Task>) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setData((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) => (idSet.has(t.id) ? { ...t, ...patch } : t)),
          }
        : null
    );
    showToast(`Updated ${ids.length} tasks`, 'success');
  };

  const bulkDeleteTasks = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setData((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.filter((t) => !idSet.has(t.id)),
          }
        : null
    );
    showToast(`Deleted ${ids.length} tasks`, 'info');
  };

  const renameTaskList = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || oldName === trimmed) return;
    setData((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) => (t.list === oldName ? { ...t, list: trimmed } : t)),
          }
        : null
    );
    showToast(`Renamed list "${oldName}" to "${trimmed}"`, 'success');
  };

  const deleteTaskList = (name: string, targetListForTasks?: string | null) => {
    setData((prev) => {
      if (!prev) return null;
      let tasks = prev.tasks;
      if (targetListForTasks && targetListForTasks !== '__DELETE__') {
        tasks = tasks.map((t) => (t.list === name ? { ...t, list: targetListForTasks } : t));
      } else {
        tasks = tasks.filter((t) => t.list !== name);
      }
      return { ...prev, tasks };
    });
    showToast(`Deleted list "${name}"`, 'info');
  };

  // Calendar Event Handlers
  /** One-way import. Dedupes on (source, providerId); re-importing updates changed events instead of duplicating. */
  const mergeGoogleEvents = (cur: CalendarEvent[], incoming: ImportedEvent[]) => {
    const byProv = new Map(cur.filter((e) => e.source === 'google_calendar' && e.providerId).map((e) => [e.providerId!, e]));
    let added = 0, updated = 0;
    const patched = new Map<string, CalendarEvent>();
    const fresh: CalendarEvent[] = [];
    for (const ev of incoming) {
      const ex = byProv.get(ev.providerId);
      if (!ex) { fresh.push({ id: newId(), source: 'google_calendar', category: 'Google Calendar', providerId: ev.providerId, title: ev.title, description: ev.description, date: ev.date, startTime: ev.startTime, endTime: ev.endTime, location: ev.location }); added++; continue; }
      if (ex.title !== ev.title || ex.date !== ev.date || ex.startTime !== ev.startTime || ex.endTime !== ev.endTime || ex.location !== ev.location || ex.description !== ev.description) {
        patched.set(ex.id, { ...ex, title: ev.title, description: ev.description, date: ev.date, startTime: ev.startTime, endTime: ev.endTime, location: ev.location }); updated++;
      }
    }
    return { events: [...cur.map((e) => patched.get(e.id) ?? e), ...fresh], added, updated };
  };

  const importCalendarEvents = (incoming: ImportedEvent[]) => {
    const { added, updated } = mergeGoogleEvents(dataRef.current?.events ?? [], incoming);
    setData((prev) => (prev ? { ...prev, events: mergeGoogleEvents(prev.events, incoming).events } : null));
    return { added, updated };
  };

  const addEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: newId(),
    };
    setData((prev) => (prev ? { ...prev, events: [...prev.events, newEvent] } : null));
    showToast('Event scheduled', 'success');
  };

  const updateEvent = (updatedEvent: CalendarEvent) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            events: prev.events.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
          }
        : null
    );
    showToast('Event updated', 'success');
  };

  const deleteEvent = (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            events: prev.events.filter((e) => e.id !== id),
          }
        : null
    );
    showToast('Event removed', 'info');
  };

  // Note Handlers
  const addNote = (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const id = newId();
    const newNote: Note = {
      ...noteData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setData((prev) => (prev ? { ...prev, notes: [newNote, ...prev.notes] } : null));
    setSelectedNoteId(id);
    showToast('Note created', 'success');
    return id;
  };

  const updateNote = (updated: Note) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            notes: prev.notes.map((n) =>
              n.id === updated.id
                ? { ...updated, updatedAt: new Date().toISOString() }
                : n
            ),
          }
        : null
    );
  };

  const deleteNote = (id: string) => {
    setData((prev) => {
      if (!prev) return null;
      const nextNotes = prev.notes.filter((n) => n.id !== id);
      if (selectedNoteId === id) {
        setSelectedNoteId(nextNotes.length > 0 ? nextNotes[0].id : null);
      }
      // The database nulls linked_note_id on delete; mirror that locally so a later task edit can't send a dangling reference.
      return { ...prev, notes: nextNotes, tasks: prev.tasks.map((t) => (t.linkedNoteId === id ? { ...t, linkedNoteId: undefined } : t)) };
    });
    showToast('Note deleted', 'info');
  };

  const toggleStarNote = (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            notes: prev.notes.map((n) => (n.id === id ? { ...n, starred: !n.starred } : n)),
          }
        : null
    );
  };

  // Table Handlers
  /** Batch insert: one state update, one save, one toast (used by CSV import). */
  const addTableRows = (tableId: string, rows: Record<string, any>[]) => {
    if (rows.length === 0) return;
    setData((prev) => {
      if (!prev) return null;
      return { ...prev, tables: prev.tables.map((tbl) => tbl.id !== tableId ? tbl : {
        ...tbl, updatedAt: new Date().toISOString(),
        rows: [...tbl.rows, ...rows.map((r, i) => ({ ...r, id: newId(), index: tbl.rows.length + i + 1 }))],
      }) };
    });
  };

  const addTableRow = (tableId: string, row: Record<string, any>) => {
    const newRowId = newId();
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tables: prev.tables.map((tbl) => {
          if (tbl.id === tableId) {
            const nextIndex = tbl.rows.length + 1;
            const fullRow = { ...row, id: newRowId, index: nextIndex };
            return {
              ...tbl,
              rows: [...tbl.rows, fullRow],
              updatedAt: new Date().toISOString(),
            };
          }
          return tbl;
        }),
      };
    });
    showToast('Row added to table', 'success');
  };

  const updateTableRow = (tableId: string, rowId: string, row: Record<string, any>) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tables: prev.tables.map((tbl) => {
          if (tbl.id === tableId) {
            return {
              ...tbl,
              rows: tbl.rows.map((r) => (r.id === rowId ? { ...r, ...row } : r)),
              updatedAt: new Date().toISOString(),
            };
          }
          return tbl;
        }),
      };
    });
  };

  const deleteTableRow = (tableId: string, rowId: string) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tables: prev.tables.map((tbl) => {
          if (tbl.id === tableId) {
            return {
              ...tbl,
              rows: tbl.rows.filter((r) => r.id !== rowId),
              updatedAt: new Date().toISOString(),
            };
          }
          return tbl;
        }),
      };
    });
    showToast('Row deleted', 'info');
  };

  const duplicateTableRow = (tableId: string, rowId: string) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tables: prev.tables.map((tbl) => {
          if (tbl.id === tableId) {
            const rowIndex = tbl.rows.findIndex((r) => r.id === rowId);
            if (rowIndex === -1) return tbl;
            const original = tbl.rows[rowIndex];
            const duplicate = {
              ...original,
              id: newId(),
              index: typeof original.index === 'number' ? tbl.rows.length + 1 : undefined,
            };
            const nextRows = [...tbl.rows];
            nextRows.splice(rowIndex + 1, 0, duplicate);
            return {
              ...tbl,
              rows: nextRows,
              updatedAt: new Date().toISOString(),
            };
          }
          return tbl;
        }),
      };
    });
    showToast('Row duplicated', 'success');
  };

  const addTableCollection = (tableData: NewTable) => {
    const newTbl: TableCollection = {
      ...tableData,
      id: newId(),
      // Row ids are always assigned here: callers pass content only (a caller-made id like "r-123" is not a UUID).
      rows: (tableData.rows || []).map((r, i) => ({ ...r, id: newId(), index: typeof r.index === 'number' ? r.index : i + 1 })),
      updatedAt: new Date().toISOString(),
      archived: false,
      metadata: tableData.metadata ?? {},
    };
    setData((prev) => (prev ? { ...prev, tables: [...prev.tables, newTbl] } : null));
    setSelectedTableId(newTbl.id);
    showToast(`Table "${newTbl.name}" created`, 'success');
  };

  const updateTableCollection = (tableId: string, updates: Partial<TableCollection>) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tables: prev.tables.map((tbl) => {
          if (tbl.id === tableId) {
            return {
              ...tbl,
              ...updates,
              updatedAt: new Date().toISOString(),
            };
          }
          return tbl;
        }),
      };
    });
  };

  const deleteTableCollection = (tableId: string) => {
    setData((prev) => {
      if (!prev) return null;
      const target = prev.tables.find((t) => t.id === tableId);
      const name = target?.name || 'Table';
      const remaining = prev.tables.filter((t) => t.id !== tableId);
      if (selectedTableId === tableId) {
        const nextActive = remaining.find((t) => !t.archived) || remaining[0];
        setSelectedTableId(nextActive?.id || '');
      }
      return {
        ...prev,
        tables: remaining,
      };
    });
    showToast('Table permanently deleted', 'info');
  };

  const duplicateTableCollection = (tableId: string, includeRows: boolean) => {
    const tbl = data?.tables.find((t) => t.id === tableId);
    if (!tbl) return;
    const duplicated: TableCollection = {
      id: newId(),
      name: `${tbl.name} (Copy)`,
      description: tbl.description || '',
      columns: tbl.columns.map((c) => ({ ...c })),
      rows: includeRows ? tbl.rows.map((r, i) => ({ ...r, id: newId(), index: i + 1 })) : [],
      updatedAt: new Date().toISOString(),
      archived: false,
      metadata: tbl.metadata ? { ...tbl.metadata } : {},
    };
    setData((prev) => (prev ? { ...prev, tables: [...prev.tables, duplicated] } : null));
    setSelectedTableId(duplicated.id);
    showToast(`Table duplicated ${includeRows ? 'with records' : '(structure only)'}`, 'success');
  };

  const archiveTableCollection = (tableId: string) => {
    setData((prev) => {
      if (!prev) return null;
      const target = prev.tables.find((t) => t.id === tableId);
      const name = target?.name || 'Table';
      const updated = prev.tables.map((t) => (t.id === tableId ? { ...t, archived: true, updatedAt: new Date().toISOString() } : t));
      if (selectedTableId === tableId) {
        const nextActive = updated.find((t) => !t.archived && t.id !== tableId) || updated[0];
        setSelectedTableId(nextActive?.id || '');
      }
      return {
        ...prev,
        tables: updated,
      };
    });
    showToast('Table archived', 'info');
  };

  const restoreTableCollection = (tableId: string) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        tables: prev.tables.map((t) => (t.id === tableId ? { ...t, archived: false, updatedAt: new Date().toISOString() } : t)),
      };
    });
    setSelectedTableId(tableId);
    showToast('Table restored from archive', 'success');
  };

  // Transaction Handlers
  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...tx,
      id: newId(),
    };
    setData((prev) => (prev ? { ...prev, transactions: [newTx, ...prev.transactions] } : null));
    showToast(`${tx.type === 'income' ? 'Income' : tx.type === 'transfer' ? 'Transfer' : 'Expense'} recorded: ₹${tx.amount.toLocaleString()}`, 'success');
  };

  const addTransactions = (txs: Omit<Transaction, 'id'>[]) => {
    if (!txs.length) return;
    const newTxs: Transaction[] = txs.map((tx) => ({
      ...tx,
      id: newId(),
    }));
    setData((prev) => (prev ? { ...prev, transactions: [...newTxs, ...prev.transactions] } : null));
    showToast(`Imported ${newTxs.length} transactions`, 'success');
  };

  const duplicateTransaction = (id: string) => {
    const target = data?.transactions.find((t) => t.id === id);
    if (!target) return;
    const duplicated: Transaction = {
      ...target,
      id: newId(),
      title: `${target.title || target.description} (Copy)`,
      description: `${target.title || target.description} (Copy)`,
      date: todayKey(),
    };
    setData((prev) => (prev ? { ...prev, transactions: [duplicated, ...prev.transactions] } : null));
    showToast(`Duplicated "${target.title || target.description}"`, 'success');
  };

  const updateTransaction = (tx: Transaction) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            transactions: prev.transactions.map((t) => (t.id === tx.id ? tx : t)),
          }
        : null
    );
    showToast('Transaction updated', 'success');
  };

  const deleteTransaction = (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            transactions: prev.transactions.filter((t) => t.id !== id),
          }
        : null
    );
    showToast('Transaction deleted', 'info');
  };

  const reassignCategory = (oldCategory: string, newCategory: string) => {
    setData((prev) => {
      if (!prev) return null;
      let count = 0;
      const updatedTxs = prev.transactions.map((t) => {
        if (t.category === oldCategory) {
          count++;
          return { ...t, category: newCategory };
        }
        return t;
      });
      if (count > 0) {
        showToast(`Reassigned ${count} transactions from "${oldCategory}" to "${newCategory}"`, 'info');
      }
      return { ...prev, transactions: updatedTxs };
    });
  };

  // Subscription Handlers
  const addSubscription = (sub: Omit<Subscription, 'id'>) => {
    const newSub: Subscription = {
      ...sub,
      id: newId(),
    };
    setData((prev) => (prev ? { ...prev, subscriptions: [...prev.subscriptions, newSub] } : null));
    showToast(`Subscription "${sub.name}" added`, 'success');
  };

  const updateSubscription = (sub: Subscription) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            subscriptions: prev.subscriptions.map((s) => (s.id === sub.id ? sub : s)),
          }
        : null
    );
    showToast(`Subscription "${sub.name}" updated`, 'success');
  };

  const deleteSubscription = (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            subscriptions: prev.subscriptions.filter((s) => s.id !== id),
          }
        : null
    );
    showToast('Subscription deleted', 'info');
  };

  const recordSubscriptionPayment = (subscriptionId: string, paidDate?: string) => {
    const sub = data?.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) return;

    const dateToRecord = paidDate || todayKey();

    // Prevent duplicate expense creation when subscription payments are generated
    const alreadyRecorded = data?.transactions.some(
      (t) =>
        t.date === dateToRecord &&
        (t.title === sub.name || t.description === sub.name) &&
        t.amount === sub.amount &&
        t.type === 'expense'
    );

    if (alreadyRecorded) {
      showToast(`Payment for "${sub.name}" on ${dateToRecord} has already been recorded`, 'info');
      return;
    }

    // 1. Create transaction in ledger
    const newTx: Transaction = {
      id: newId(),
      type: 'expense',
      title: sub.name,
      description: sub.description || `${sub.name} subscription payment`,
      category: sub.category || 'Utilities',
      amount: sub.amount,
      date: dateToRecord,
      account: sub.account || 'Bank account',
      notes: `Recurring subscription (${sub.billingCycle})`,
    };

    // 2. Advance renewal date to next billing cycle
    const nextRenewal = getNextSubscriptionDate(sub.renewalDate || dateToRecord, sub.billingCycle);
    const updatedSub: Subscription = {
      ...sub,
      renewalDate: nextRenewal,
      lastPaidDate: dateToRecord,
    };

    setData((prev) =>
      prev
        ? {
            ...prev,
            transactions: [newTx, ...prev.transactions],
            subscriptions: prev.subscriptions.map((s) => (s.id === sub.id ? updatedSub : s)),
          }
        : null
    );

    showToast(`Recorded payment of ₹${sub.amount.toLocaleString()} for "${sub.name}"`, 'success');
  };

  // Workout Handlers
  const addWorkout = (w: Omit<WorkoutLog, 'id'>) => {
    const newW: WorkoutLog = {
      ...w,
      id: newId(),
    };
    setData((prev) => (prev ? { ...prev, workouts: [newW, ...prev.workouts] } : null));
    showToast(`Workout "${w.title}" logged (${w.durationMinutes}m)`, 'success');
  };

  const deleteWorkout = (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            workouts: prev.workouts.filter((w) => w.id !== id),
          }
        : null
    );
    showToast('Workout entry removed', 'info');
  };

  // Goals & Habits Handlers
  const addGoal = (g: Omit<Goal, 'id'>) => {
    const newG: Goal = {
      ...g,
      id: newId(),
    };
    setData((prev) => (prev ? { ...prev, goals: [...prev.goals, newG] } : null));
    showToast(`Goal "${g.title}" created`, 'success');
  };

  const incrementGoal = (id: string, delta: number = 1) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        goals: prev.goals.map((g) => {
          if (g.id === id) {
            const nextCurrent = Math.min(g.target, g.current + delta);
            return {
              ...g,
              current: nextCurrent,
              completed: nextCurrent >= g.target,
            };
          }
          return g;
        }),
      };
    });
    showToast('Goal progress incremented', 'success');
  };

  const deleteGoal = (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            goals: prev.goals.filter((g) => g.id !== id),
          }
        : null
    );
    showToast('Goal deleted', 'info');
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        goals: prev.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      };
    });
    showToast('Goal updated', 'success');
  };

  const toggleHabitCheckin = (habitId: string, date: string) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        habits: prev.habits.map((h) => {
          if (h.id === habitId) {
            const currentVal = !!h.checkins[date];
            const nextCheckins = { ...h.checkins, [date]: !currentVal };
            const streakCount = computeStreak(nextCheckins);          // consecutive days, same rule as when loading
            return {
              ...h,
              checkins: nextCheckins,
              streak: streakCount,
            };
          }
          return h;
        }),
      };
    });
  };

  const addHabit = (h: Omit<Habit, 'id' | 'streak' | 'checkins'>) => {
    const newH: Habit = {
      ...h,
      id: newId(),
      streak: 0,
      checkins: {},
    };
    setData((prev) => (prev ? { ...prev, habits: [...prev.habits, newH] } : null));
    showToast(`Habit "${h.name}" added`, 'success');
  };

  const updateHabit = (id: string, updates: Partial<Habit>) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        habits: prev.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
      };
    });
    showToast('Habit updated', 'success');
  };

  const deleteHabit = (id: string) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        habits: prev.habits.filter((h) => h.id !== id),
      };
    });
    showToast('Habit removed', 'info');
  };

  // Tracker Handlers
  const addTrackerEntry = (trackerId: string, value: number, date?: string, notes?: string) => {
    const entryDate = date || todayKey();
    const newEntry = {
      id: newId(),
      date: entryDate,
      value,
      notes,
    };
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        trackers: prev.trackers.map((t) => {
          if (t.id === trackerId) {
            return {
              ...t,
              entries: [newEntry, ...t.entries],
            };
          }
          return t;
        }),
      };
    });
    showToast(`Logged ${value} for tracker`, 'success');
  };

  const deleteTrackerEntry = (trackerId: string, entryId: string) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        trackers: prev.trackers.map((t) => {
          if (t.id === trackerId) {
            return {
              ...t,
              entries: t.entries.filter((e) => e.id !== entryId),
            };
          }
          return t;
        }),
      };
    });
    showToast('Entry deleted', 'info');
  };

  const addCustomTracker = (tracker: Omit<CustomTracker, 'id' | 'entries'>) => {
    const newTrk: CustomTracker = {
      ...tracker,
      id: newId(),
      entries: [],
    };
    setData((prev) => (prev ? { ...prev, trackers: [...prev.trackers, newTrk] } : null));
    setSelectedTrackerId(newTrk.id);
    showToast(`Tracker "${tracker.name}" created`, 'success');
  };

  const updateCustomTracker = (id: string, updates: Partial<CustomTracker>) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        trackers: prev.trackers.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      };
    });
    showToast('Tracker updated', 'success');
  };

  const deleteCustomTracker = (id: string) => {
    setData((prev) => {
      if (!prev) return null;
      const nextList = prev.trackers.filter((t) => t.id !== id);
      if (selectedTrackerId === id) {
        setSelectedTrackerId(nextList.length > 0 ? nextList[0].id : '');
      }
      return { ...prev, trackers: nextList };
    });
    showToast('Tracker deleted', 'info');
  };

  const exportBackup = () => {
    if (data) {
      exportCosmosBackup(data, { theme: themePreference });
      showToast('Cosmos OS JSON backup exported', 'success');
    }
  };

  const mergeRecords = (d: CosmosAppData) => setData((prev) => {
    if (!prev) return prev;
    const have = (arr: { id: string }[]) => new Set(arr.map((x) => x.id));
    const add = <T extends { id: string }>(cur: T[], inc: T[]) => { const h = have(cur); return [...cur, ...inc.filter((x) => !h.has(x.id))]; };
    return {
      tasks: add(prev.tasks, d.tasks), events: add(prev.events, d.events), notes: add(prev.notes, d.notes),
      tables: add(prev.tables, d.tables), transactions: add(prev.transactions, d.transactions),
      subscriptions: add(prev.subscriptions, d.subscriptions), workouts: add(prev.workouts, d.workouts),
      goals: add(prev.goals, d.goals), habits: add(prev.habits, d.habits), trackers: add(prev.trackers, d.trackers),
    };
  });
  /** Replace everything with a validated backup. Callers must have confirmed AND saved a safety copy first. */
  const replaceAllData = (d: CosmosAppData) => {
    setData({ ...d });
    setSelectedNoteId(d.notes[0]?.id ?? null); setSelectedTableId(d.tables[0]?.id ?? ''); setSelectedTrackerId(d.trackers[0]?.id ?? '');
  };
  const getCosmosData = (): CosmosAppData => dataRef.current ?? EMPTY_DATA;

  // Additive restore: validates, remaps legacy ids to UUIDs, skips records already present.
  const importBackup = (jsonContent: string) => {
    const res = parseBackup(jsonContent);
    if (!res.ok) {
      showToast(`Restore failed: ${res.error}`, 'error');
      return { success: false, error: res.error };
    }
    mergeRecords(res.data);
    showToast(`Restored ${res.counts.total} records (${res.counts.remapped} had legacy IDs and were re-keyed).`, 'success');
    return { success: true };
  };

  // Deletes the signed-in user's own records (through the normal save path, so RLS applies).
  const resetAllData = () => {
    setData({ ...EMPTY_DATA });
    setSelectedNoteId(null); setSelectedTableId(''); setSelectedTrackerId('');
    showToast('All of your Cosmos OS records are being deleted.', 'info');
  };

  const tasks = data?.tasks ?? [];
  const events = data?.events ?? [];
  const notes = data?.notes ?? [];
  const tables = data?.tables ?? [];
  const transactions = data?.transactions ?? [];
  const subscriptions = data?.subscriptions ?? [];
  const workouts = data?.workouts ?? [];
  const goals = data?.goals ?? [];
  const habits = data?.habits ?? [];
  const trackers = data?.trackers ?? [];

  return (
    <AppContext.Provider
      value={{
        activeModule,
        setActiveModule,
        themePreference,
        setThemePreference,
        effectiveTheme,
        isSidebarOpen,
        setSidebarOpen,
        userProfile,
        updateUserProfile,
        isProfileOpen,
        setProfileOpen,
        tasks,
        events,
        notes,
        tables,
        transactions,
        subscriptions,
        workouts,
        goals,
        habits,
        trackers,
        addTask,
        updateTask,
        deleteTask,
        toggleTaskStatus,
        bulkUpdateTasks,
        bulkDeleteTasks,
        renameTaskList,
        deleteTaskList,
        addEvent,
        updateEvent,
        deleteEvent,
        selectedNoteId,
        setSelectedNoteId,
        addNote,
        addDateNote,
        updateNote,
        deleteNote,
        toggleStarNote,
        selectedTableId,
        setSelectedTableId,
        addTableRow,
        addTableRows,
        updateTableRow,
        deleteTableRow,
        duplicateTableRow,
        addTableCollection,
        updateTableCollection,
        deleteTableCollection,
        duplicateTableCollection,
        archiveTableCollection,
        restoreTableCollection,
        addTransaction,
        addTransactions,
        updateTransaction,
        duplicateTransaction,
        deleteTransaction,
        reassignCategory,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        recordSubscriptionPayment,
        addWorkout,
        deleteWorkout,
        addGoal,
        updateGoal,
        incrementGoal,
        deleteGoal,
        toggleHabitCheckin,
        addHabit,
        updateHabit,
        deleteHabit,
        selectedTrackerId,
        setSelectedTrackerId,
        addTrackerEntry,
        deleteTrackerEntry,
        addCustomTracker,
        updateCustomTracker,
        deleteCustomTracker,
        importCalendarEvents,
        refreshImportedWorkouts,
        musicHub,
        toggleMusicHub,
        openMusicHub,
        closeMusicHub,
        setMusicMinimized,
        focusRecord,
        setFocusRecord,
        loadState,
        loadError,
        retryLoad: () => setLoadNonce((n) => n + 1),
        saveStatus,
        saveError,
        retrySave,
        signOutUser: signOut,
        exportBackup,
        getCosmosData,
        mergeRecords,
        replaceAllData,
        importBackup,
        resetAllData,
        isSearchOpen,
        setSearchOpen,
        isQuickCaptureOpen,
        setQuickCaptureOpen,
        quickCaptureTab,
        openQuickCapture,
        focusDurationMins,
        setFocusDurationMins,
        focusTaskTitle,
        setFocusTaskTitle,
        isFocusRunning,
        focusSecondsLeft,
        toggleFocusTimer,
        resetFocusTimer,
        toasts,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
