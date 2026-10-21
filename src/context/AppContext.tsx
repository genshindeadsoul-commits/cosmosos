import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from 'react';
import {
  ModuleType,
  Task,
  CalendarEvent,
  Note,
  TableCollection,
  Transaction,
  Subscription,
  WorkoutLog,
  Goal,
  Habit,
  CustomTracker,
  IntegrationAccount,
  MusicPlayerState,
  ThemePreference,
  UserProfile,
  GmailMessage,
} from '../types';
import { CosmosAppData, EMPTY_DATA, newId } from '../data/cloudData';
import { loadUserData, applyChanges, planChanges, toRows } from '../data/cloudStore';
import type { RowSet } from '../data/cloudData';
import { exportCosmosBackup, parseBackup } from '../data/backup';
import { useAuth } from './AuthContext';
import { nextOccurrence } from '../lib/recurrence';
import type { ImportedEvent } from '../lib/integrationsApi';
import * as spotify from '../lib/spotifyPlayer';
import * as apple from '../lib/appleMusic';
import { supabase } from '../lib/supabase';
import { ambientAudio } from '../lib/ambientAudio';
import { musicRegistry } from '../lib/musicAdapters';

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
  
  // Events
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  deleteEvent: (id: string) => void;
  
  // Notes
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  toggleStarNote: (id: string) => void;
  
  // Tables
  selectedTableId: string;
  setSelectedTableId: (id: string) => void;
  addTableRow: (tableId: string, row: Record<string, any>) => void;
  updateTableRow: (tableId: string, rowId: string, row: Record<string, any>) => void;
  deleteTableRow: (tableId: string, rowId: string) => void;
  addTableCollection: (table: Omit<TableCollection, 'id' | 'updatedAt'>) => void;
  
  // Transactions & Subscriptions
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  addSubscription: (sub: Omit<Subscription, 'id'>) => void;
  deleteSubscription: (id: string) => void;
  
  // Fitness
  addWorkout: (w: Omit<WorkoutLog, 'id'>) => void;
  deleteWorkout: (id: string) => void;
  
  // Goals & Habits
  addGoal: (g: Omit<Goal, 'id'>) => void;
  incrementGoal: (id: string, delta?: number) => void;
  deleteGoal: (id: string) => void;
  toggleHabitCheckin: (habitId: string, date: string) => void;
  addHabit: (h: Omit<Habit, 'id' | 'streak' | 'checkins'>) => void;
  
  // Trackers
  selectedTrackerId: string;
  setSelectedTrackerId: (id: string) => void;
  addTrackerEntry: (trackerId: string, value: number, date?: string, notes?: string) => void;
  addCustomTracker: (tracker: Omit<CustomTracker, 'id' | 'entries'>) => void;
  deleteCustomTracker: (id: string) => void;
  
  // Integrations & Diagnostics
  
  // Gmail & WhatsApp Modals
  isGmailOpen: boolean;
  setGmailOpen: (open: boolean) => void;
  gmailMessages: GmailMessage[];
  sendGmailMessage: (to: string, subject: string, body: string) => void;
  convertEmailToTask: (msgId: string) => void;
  isWhatsAppOpen: boolean;
  setWhatsAppOpen: (open: boolean) => void;
  whatsAppPrefill: { phone: string; text: string };
  openWhatsApp: (phone?: string, text?: string) => void;
  
  importCalendarEvents: (incoming: ImportedEvent[]) => { added: number; updated: number };
  authorizeAppleMusic: () => Promise<void>;
  focusRecord: { kind: string; id: string } | null;
  setFocusRecord: (r: { kind: string; id: string } | null) => void;
  signOutUser: () => Promise<void>;

  // Persistence status (Supabase is the source of truth)
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;

  // Backup / Restore
  exportBackup: () => void;
  importBackup: (jsonContent: string) => { success: boolean; error?: string };
  resetAllData: () => void;
  
  // Global Modals
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  isQuickCaptureOpen: boolean;
  setQuickCaptureOpen: (open: boolean) => void;
  quickCaptureTab: 'task' | 'note' | 'expense' | 'workout' | 'habit';
  openQuickCapture: (tab?: 'task' | 'note' | 'expense' | 'workout' | 'habit') => void;
  
  // Provider-Aware Music Player
  musicState: MusicPlayerState;
  setMusicState: React.Dispatch<React.SetStateAction<MusicPlayerState>>;
  toggleMusicPlayer: () => void;
  toggleMusicPlayback: () => void;
  setMusicVolume: (vol: number) => void;
  setMusicPreset: (preset: 'forest' | 'rain' | 'alpha' | 'celestial') => void;
  switchMusicProvider: (provider: 'ambient' | 'spotify' | 'apple_music') => void;
  nextMusicTrack: () => void;
  prevMusicTrack: () => void;
  openExternalMusicApp: () => void;
  
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  
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
  const { user, isAdmin, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string>(
    () => (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User') as string
  );
  const userProfile: UserProfile = useMemo(() => ({
    name: displayName,
    email: user?.email ?? '',
    workspaceName: `${displayName}'s Workspace`,
    avatarInitials: (displayName.trim()[0] ?? 'U').toUpperCase(),
    role: isAdmin ? 'Administrator' : 'Member',
    accountType: 'Cloud Synchronized',
  }), [displayName, user?.email, isAdmin]);

  const [isProfileOpen, setProfileOpen] = useState(false);

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    // Only display name is editable; email comes from the auth provider and role from the database.
    const nextName = updates.name?.trim();
    if (!nextName || !supabase || !user) return;
    supabase.from('profiles').update({ display_name: nextName }).eq('id', user.id).then(({ error }) => {
      if (error) { showToast(`Profile not saved: ${error.message}`, 'error'); return; }
      setDisplayName(nextName);
      showToast('Profile updated', 'success');
    });
  };

  // App Data
  const [data, setData] = useState<CosmosAppData | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedTrackerId, setSelectedTrackerId] = useState<string>('');
  
  // Modals
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isQuickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [quickCaptureTab, setQuickCaptureTab] = useState<'task' | 'note' | 'expense' | 'workout' | 'habit'>('task');
  
  // Gmail & WhatsApp
  const [isGmailOpen, setGmailOpen] = useState(false);
  const [gmailMessages] = useState<GmailMessage[]>([]); // populated only by a real Gmail API connection
  const [isWhatsAppOpen, setWhatsAppOpen] = useState(false);
  const [whatsAppPrefill, setWhatsAppPrefill] = useState({ phone: '', text: '' });

  // Music Player
  const [musicState, setMusicState] = useState<MusicPlayerState>(() => {
    const activeProvider = musicRegistry.getActiveProvider();
    const initialState = musicRegistry.getCurrentPlaybackState('forest');
    return {
      isOpen: false,
      isMinimized: false,
      provider: activeProvider,
      isPlaying: false,
      currentTrack: initialState.currentTrack,
      artist: initialState.artist,
      progressSeconds: initialState.progressSeconds,
      durationSeconds: initialState.durationSeconds,
      volume: 0.6,
      ambientPreset: 'forest',
      externalStatus: 'unknown',
    };
  });

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
      if (profile.data?.display_name) setDisplayName(profile.data.display_name);
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

  const flush = async () => {
    if (saving.current || !syncedRows.current || !dataRef.current) return;
    const target = dataRef.current;
    const nextRows = toRows(target);
    const plan = planChanges(syncedRows.current, nextRows);
    if (plan.isEmpty) return;
    saving.current = true;
    setSaveStatus('saving');
    try {
      await applyChanges(plan);
      syncedRows.current = nextRows;           // only advance after the server accepted it
      setSaveError(null);
      setSaveStatus('saved');
    } catch (err) {
      setSaveError((err as Error).message);
      setSaveStatus('error');
      showToast(`Not saved: ${(err as Error).message}`, 'error');
    } finally {
      saving.current = false;
      if (dataRef.current !== target && saveStatusRetry.current) flushSoon();  // changed during save
    }
  };
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

  // Provider-Aware Music Player Actions
  const toggleMusicPlayer = () => {
    setMusicState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  };

  // ---- External providers: every state shown comes from a real provider response ----
  const explainExternalError = (e: unknown): { status: MusicPlayerState['externalStatus']; message: string } => {
    const err = e as { code?: string; message?: string };
    if (err.code === 'not_connected' || err.code === 'needs_reauthorization' || err.code === 'auth') return { status: 'not_connected', message: err.message ?? 'Not connected.' };
    if (err.code === 'not_configured' || err.code === 'function_unavailable') return { status: 'error', message: err.message ?? 'Server setup incomplete.' };
    return { status: 'error', message: err.message ?? 'Something went wrong.' };
  };

  const refreshExternalPlayback = async (provider: 'spotify' | 'apple_music', quiet = false) => {
    try {
      if (provider === 'spotify') {
        const st = await spotify.getSpotifyState();
        setMusicState((prev) => prev.provider !== 'spotify' ? prev : {
          ...prev, isPlaying: st?.isPlaying ?? false, currentTrack: st?.track ?? 'Nothing playing',
          artist: st ? st.artist : 'Open Spotify on a device to start', progressSeconds: st?.progressSec ?? 0, durationSeconds: st?.durationSec ?? 0,
          spotifyActiveDevice: st?.device, externalStatus: 'ok', externalMessage: st ? undefined : 'No active device. Open Spotify and start playing.',
        });
      } else {
        if (!(await apple.appleIsAuthorized())) {
          setMusicState((prev) => prev.provider !== 'apple_music' ? prev : { ...prev, isPlaying: false, currentTrack: 'Apple Music: not authorized', artist: '', externalStatus: 'not_authorized', externalMessage: 'Authorize Apple Music to control playback.' });
          return;
        }
        const st = await apple.appleState();
        setMusicState((prev) => prev.provider !== 'apple_music' ? prev : { ...prev, isPlaying: st.isPlaying, currentTrack: st.track, artist: st.artist, externalStatus: 'ok', externalMessage: undefined });
      }
    } catch (e) {
      const x = explainExternalError(e);
      setMusicState((prev) => prev.provider !== provider ? prev : { ...prev, isPlaying: false, currentTrack: `${provider === 'spotify' ? 'Spotify' : 'Apple Music'}: ${x.status === 'not_connected' ? 'not connected' : 'unavailable'}`, artist: '', externalStatus: x.status, externalMessage: x.message });
      if (!quiet) showToast(x.message, 'warning');
    }
  };

  const authorizeAppleMusic = async () => {
    try { await apple.appleAuthorize(); await refreshExternalPlayback('apple_music'); showToast('Apple Music authorized in this browser.', 'success'); }
    catch (e) { showToast(explainExternalError(e).message, 'error'); }
  };

  const externalCommand = async (cmd: 'toggle' | 'next' | 'prev') => {
    const provider = musicState.provider as 'spotify' | 'apple_music';
    try {
      if (provider === 'spotify') {
        if (cmd === 'toggle') await (musicState.isPlaying ? spotify.spotifyPause() : spotify.spotifyPlay());
        else if (cmd === 'next') await spotify.spotifyNext(); else await spotify.spotifyPrevious();
        await new Promise((r) => setTimeout(r, 400));          // Spotify state lags the command slightly
      } else {
        if (cmd === 'toggle') await (musicState.isPlaying ? apple.applePause() : apple.applePlay());
        else if (cmd === 'next') await apple.appleNext(); else await apple.applePrevious();
      }
      await refreshExternalPlayback(provider, true);
    } catch (e) {
      const x = explainExternalError(e);
      showToast(x.message, 'warning');
      await refreshExternalPlayback(provider, true);
    }
  };

  const toggleMusicPlayback = () => {
    if (musicState.provider !== 'ambient') { void externalCommand('toggle'); return; }
    setMusicState((prev) => {
      const nextPlaying = !prev.isPlaying;
      if (nextPlaying) musicRegistry.play(prev.ambientPreset || 'forest');
      else musicRegistry.pause();
      return { ...prev, isPlaying: nextPlaying };
    });
  };

  const switchMusicProvider = (provider: 'ambient' | 'spotify' | 'apple_music') => {
    musicRegistry.setActiveProvider(provider);
    if (provider === 'ambient') {
      const playback = musicRegistry.getCurrentPlaybackState(musicState.ambientPreset || 'forest');
      setMusicState((prev) => ({ ...prev, provider, isPlaying: false, currentTrack: playback.currentTrack, artist: playback.artist,
        durationSeconds: 0, progressSeconds: 0, externalStatus: undefined, externalMessage: undefined }));
      return;
    }
    setMusicState((prev) => ({ ...prev, provider, isPlaying: false, currentTrack: 'Checking…', artist: '', durationSeconds: 0, progressSeconds: 0, externalStatus: 'unknown', externalMessage: undefined }));
    void refreshExternalPlayback(provider, true);
  };

  const nextMusicTrack = () => { if (musicState.provider !== 'ambient') void externalCommand('next'); else showToast('Ambient sounds have no tracks to skip.', 'info'); };
  const prevMusicTrack = () => { if (musicState.provider !== 'ambient') void externalCommand('prev'); else showToast('Ambient sounds have no tracks to skip.', 'info'); };

  // Spotify position/track drift: refresh while the player is open.
  useEffect(() => {
    if (musicState.provider !== 'spotify' || !musicState.isOpen) return;
    void refreshExternalPlayback('spotify', true);
    const t = setInterval(() => void refreshExternalPlayback('spotify', true), 8000);
    return () => clearInterval(t);
  }, [musicState.provider, musicState.isOpen]);

  const setMusicVolume = (vol: number) => {
    setMusicState((prev) => ({ ...prev, volume: vol }));
    ambientAudio.setVolume(vol);
  };

  const setMusicPreset = (preset: 'forest' | 'rain' | 'alpha' | 'celestial') => {
    setMusicState((prev) => {
      if (prev.isPlaying && prev.provider === 'ambient') {
        ambientAudio.play(preset);
      }
      const playback = musicRegistry.getCurrentPlaybackState(preset);
      return {
        ...prev,
        ambientPreset: preset,
        currentTrack: playback.currentTrack,
      };
    });
  };

  const openExternalMusicApp = () => {
    musicRegistry.openExternalApp();
  };

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

  // WhatsApp Helper
  const openWhatsApp = (phone: string = '', text: string = '') => {
    setWhatsAppPrefill({ phone, text });
    setWhatsAppOpen(true);
  };

  // Gmail: no messages exist until a real Gmail API connection is made.
  const sendGmailMessage = (_to: string, _subject: string, _snippet: string) => {
    showToast('Gmail is not connected. Nothing was sent.', 'error');
  };

  const convertEmailToTask = (_msgId: string) => {
    showToast('Gmail is not connected.', 'error');
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
      return { ...prev, notes: nextNotes };
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

  const addTableCollection = (tableData: Omit<TableCollection, 'id' | 'updatedAt'>) => {
    const newTbl: TableCollection = {
      ...tableData,
      id: newId(),
      updatedAt: new Date().toISOString(),
    };
    setData((prev) => (prev ? { ...prev, tables: [...prev.tables, newTbl] } : null));
    setSelectedTableId(newTbl.id);
    showToast(`Table "${newTbl.name}" created`, 'success');
  };

  // Transaction Handlers
  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...tx,
      id: newId(),
    };
    setData((prev) => (prev ? { ...prev, transactions: [newTx, ...prev.transactions] } : null));
    showToast(`${tx.type === 'income' ? 'Income' : 'Expense'} recorded: ₹${tx.amount.toLocaleString()}`, 'success');
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

  // Subscription Handlers
  const addSubscription = (sub: Omit<Subscription, 'id'>) => {
    const newSub: Subscription = {
      ...sub,
      id: newId(),
    };
    setData((prev) => (prev ? { ...prev, subscriptions: [...prev.subscriptions, newSub] } : null));
    showToast(`Subscription "${sub.name}" added`, 'success');
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

  const toggleHabitCheckin = (habitId: string, date: string) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        habits: prev.habits.map((h) => {
          if (h.id === habitId) {
            const currentVal = !!h.checkins[date];
            const nextCheckins = { ...h.checkins, [date]: !currentVal };
            const streakCount = Object.values(nextCheckins).filter(Boolean).length;
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

  // Tracker Handlers
  const addTrackerEntry = (trackerId: string, value: number, date?: string, notes?: string) => {
    const entryDate = date || new Date().toISOString().slice(0, 10);
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
      exportCosmosBackup(data);
      showToast('Cosmos OS JSON backup exported', 'success');
    }
  };

  // Additive restore: validates, remaps legacy ids to UUIDs, skips records already present.
  const importBackup = (jsonContent: string) => {
    const res = parseBackup(jsonContent);
    if (!res.ok) {
      showToast(`Restore failed: ${res.error}`, 'error');
      return { success: false, error: res.error };
    }
    setData((prev) => {
      if (!prev) return prev;
      const have = (arr: { id: string }[]) => new Set(arr.map((x) => x.id));
      const add = <T extends { id: string }>(cur: T[], inc: T[]) => { const h = have(cur); return [...cur, ...inc.filter((x) => !h.has(x.id))]; };
      const d = res.data;
      return {
        tasks: add(prev.tasks, d.tasks), events: add(prev.events, d.events), notes: add(prev.notes, d.notes),
        tables: add(prev.tables, d.tables), transactions: add(prev.transactions, d.transactions),
        subscriptions: add(prev.subscriptions, d.subscriptions), workouts: add(prev.workouts, d.workouts),
        goals: add(prev.goals, d.goals), habits: add(prev.habits, d.habits), trackers: add(prev.trackers, d.trackers),
      };
    });
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
        addEvent,
        deleteEvent,
        selectedNoteId,
        setSelectedNoteId,
        addNote,
        updateNote,
        deleteNote,
        toggleStarNote,
        selectedTableId,
        setSelectedTableId,
        addTableRow,
        updateTableRow,
        deleteTableRow,
        addTableCollection,
        addTransaction,
        deleteTransaction,
        addSubscription,
        deleteSubscription,
        addWorkout,
        deleteWorkout,
        addGoal,
        incrementGoal,
        deleteGoal,
        toggleHabitCheckin,
        addHabit,
        selectedTrackerId,
        setSelectedTrackerId,
        addTrackerEntry,
        addCustomTracker,
        deleteCustomTracker,
        isGmailOpen,
        setGmailOpen,
        gmailMessages,
        sendGmailMessage,
        convertEmailToTask,
        isWhatsAppOpen,
        setWhatsAppOpen,
        whatsAppPrefill,
        openWhatsApp,
        importCalendarEvents,
        authorizeAppleMusic,
        focusRecord,
        setFocusRecord,
        loadState,
        loadError,
        retryLoad: () => setLoadNonce((n) => n + 1),
        saveStatus,
        saveError,
        signOutUser: signOut,
        exportBackup,
        importBackup,
        resetAllData,
        isSearchOpen,
        setSearchOpen,
        isQuickCaptureOpen,
        setQuickCaptureOpen,
        quickCaptureTab,
        openQuickCapture,
        musicState,
        setMusicState,
        toggleMusicPlayer,
        toggleMusicPlayback,
        setMusicVolume,
        setMusicPreset,
        switchMusicProvider,
        nextMusicTrack,
        prevMusicTrack,
        openExternalMusicApp,
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
