import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { requireSupabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { PlaylistItem } from '../lib/playlists';
import type { Account, CustomTaskListMeta, FinanceCategoryMeta, RecurringTransaction } from '../types';
import { DEFAULT_ACCOUNTS, DEFAULT_FINANCE_CATEGORIES } from '../types';

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
  categoryBudgets?: Record<string, Record<string, number>>;
  dashboardGrid?: DashboardGridPrefs;
  preferredCalendarTab?: CalendarTab;
  lastSelectedDate?: string;
  customTaskLists?: CustomTaskListMeta[];
  activeTaskWorkspaceView?: TaskWorkspaceView;
  selectedTaskList?: string;
  accounts?: Account[];
  customFinanceCategories?: FinanceCategoryMeta[];
  recurringTransactions?: RecurringTransaction[];
  preferredFinanceTab?: 'transactions' | 'accounts' | 'budgets' | 'recurring' | 'reports';
}

interface PrefsContextType {
  prefs: Prefs;
  loaded: boolean;
  update: (patch: Prefs) => void;
  setMonthlyBudget: (monthKey: string, amount: number) => void;
  setCategoryBudget: (monthKey: string, category: string, amount: number) => void;
  setDashboardGrid: (grid: Partial<DashboardGridPrefs>) => void;
  setPreferredCalendarTab: (tab: CalendarTab) => void;
  setLastSelectedDate: (date: string) => void;
  createCustomTaskList: (name: string, color?: string) => void;
  renameCustomTaskList: (oldName: string, newName: string) => void;
  updateCustomTaskList: (name: string, patch: Partial<CustomTaskListMeta>) => void;
  deleteCustomTaskList: (name: string) => void;
  setActiveTaskWorkspaceView: (view: TaskWorkspaceView) => void;
  setSelectedTaskList: (listName: string) => void;

  // Accounts
  accounts: Account[];
  createAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  archiveAccount: (id: string) => void;
  deleteAccount: (id: string) => void;

  // Finance Categories
  financeCategories: FinanceCategoryMeta[];
  createFinanceCategory: (cat: Omit<FinanceCategoryMeta, 'id'>) => void;
  updateFinanceCategory: (id: string, patch: Partial<FinanceCategoryMeta>) => void;
  deleteFinanceCategory: (id: string) => void;

  // Recurring Transactions
  recurringTransactions: RecurringTransaction[];
  createRecurringTransaction: (rec: Omit<RecurringTransaction, 'id'>) => void;
  updateRecurringTransaction: (id: string, patch: Partial<RecurringTransaction>) => void;
  deleteRecurringTransaction: (id: string) => void;
  toggleRecurringStatus: (id: string) => void;

  setPreferredFinanceTab: (tab: 'transactions' | 'accounts' | 'budgets' | 'recurring' | 'reports') => void;
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

  // Accounts
  const accounts = useMemo(() => {
    return prefs.accounts && prefs.accounts.length > 0 ? prefs.accounts : DEFAULT_ACCOUNTS;
  }, [prefs.accounts]);

  const createAccount = useCallback((acc: Omit<Account, 'id'>) => {
    const trimmed = acc.name.trim();
    if (!trimmed) return;
    const current = latest.current.accounts && latest.current.accounts.length > 0 ? latest.current.accounts : DEFAULT_ACCOUNTS;
    const newAcc: Account = {
      ...acc,
      id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      openingBalance: Math.max(0, acc.openingBalance || 0),
      createdAt: new Date().toISOString(),
    };
    update({ accounts: [...current, newAcc] });
  }, [update]);

  const updateAccount = useCallback((id: string, patch: Partial<Account>) => {
    const current = latest.current.accounts && latest.current.accounts.length > 0 ? latest.current.accounts : DEFAULT_ACCOUNTS;
    update({
      accounts: current.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }, [update]);

  const archiveAccount = useCallback((id: string) => {
    const current = latest.current.accounts && latest.current.accounts.length > 0 ? latest.current.accounts : DEFAULT_ACCOUNTS;
    update({
      accounts: current.map((a) => (a.id === id ? { ...a, isArchived: !a.isArchived } : a)),
    });
  }, [update]);

  const deleteAccount = useCallback((id: string) => {
    const current = latest.current.accounts && latest.current.accounts.length > 0 ? latest.current.accounts : DEFAULT_ACCOUNTS;
    update({
      accounts: current.filter((a) => a.id !== id),
    });
  }, [update]);

  // Finance Categories
  const financeCategories = useMemo(() => {
    return prefs.customFinanceCategories && prefs.customFinanceCategories.length > 0
      ? prefs.customFinanceCategories
      : DEFAULT_FINANCE_CATEGORIES;
  }, [prefs.customFinanceCategories]);

  const createFinanceCategory = useCallback((cat: Omit<FinanceCategoryMeta, 'id'>) => {
    const trimmed = cat.name.trim();
    if (!trimmed) return;
    const current = latest.current.customFinanceCategories && latest.current.customFinanceCategories.length > 0
      ? latest.current.customFinanceCategories
      : DEFAULT_FINANCE_CATEGORIES;
    const newCat: FinanceCategoryMeta = {
      ...cat,
      id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
    };
    update({ customFinanceCategories: [...current, newCat] });
  }, [update]);

  const updateFinanceCategory = useCallback((id: string, patch: Partial<FinanceCategoryMeta>) => {
    const current = latest.current.customFinanceCategories && latest.current.customFinanceCategories.length > 0
      ? latest.current.customFinanceCategories
      : DEFAULT_FINANCE_CATEGORIES;
    update({
      customFinanceCategories: current.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }, [update]);

  const deleteFinanceCategory = useCallback((id: string) => {
    const current = latest.current.customFinanceCategories && latest.current.customFinanceCategories.length > 0
      ? latest.current.customFinanceCategories
      : DEFAULT_FINANCE_CATEGORIES;
    update({
      customFinanceCategories: current.filter((c) => c.id !== id),
    });
  }, [update]);

  // Category Budgets
  const setCategoryBudget = useCallback((monthKey: string, category: string, amount: number) => {
    const currentMap = latest.current.categoryBudgets ?? {};
    const monthMap = currentMap[monthKey] ?? {};
    const safeAmount = Math.max(0, amount);
    update({
      categoryBudgets: {
        ...currentMap,
        [monthKey]: {
          ...monthMap,
          [category]: safeAmount,
        },
      },
    });
  }, [update]);

  // Recurring Transactions
  const recurringTransactions = useMemo(() => {
    return prefs.recurringTransactions || [];
  }, [prefs.recurringTransactions]);

  const createRecurringTransaction = useCallback((rec: Omit<RecurringTransaction, 'id'>) => {
    const current = latest.current.recurringTransactions || [];
    const newRec: RecurringTransaction = {
      ...rec,
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: rec.status || 'active',
    };
    update({ recurringTransactions: [...current, newRec] });
  }, [update]);

  const updateRecurringTransaction = useCallback((id: string, patch: Partial<RecurringTransaction>) => {
    const current = latest.current.recurringTransactions || [];
    update({
      recurringTransactions: current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }, [update]);

  const deleteRecurringTransaction = useCallback((id: string) => {
    const current = latest.current.recurringTransactions || [];
    update({
      recurringTransactions: current.filter((r) => r.id !== id),
    });
  }, [update]);

  const toggleRecurringStatus = useCallback((id: string) => {
    const current = latest.current.recurringTransactions || [];
    update({
      recurringTransactions: current.map((r) => {
        if (r.id !== id) return r;
        const nextStatus = r.status === 'active' ? 'paused' : 'active';
        return { ...r, status: nextStatus };
      }),
    });
  }, [update]);

  const setPreferredFinanceTab = useCallback((tab: 'transactions' | 'accounts' | 'budgets' | 'recurring' | 'reports') => {
    update({ preferredFinanceTab: tab });
  }, [update]);

  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void save(); } }, [save]);   // flush on unmount

  return (
    <Ctx.Provider
      value={{
        prefs,
        loaded,
        update,
        setMonthlyBudget,
        setCategoryBudget,
        setDashboardGrid,
        setPreferredCalendarTab,
        setLastSelectedDate,
        createCustomTaskList,
        renameCustomTaskList,
        updateCustomTaskList,
        deleteCustomTaskList,
        setActiveTaskWorkspaceView,
        setSelectedTaskList,
        accounts,
        createAccount,
        updateAccount,
        archiveAccount,
        deleteAccount,
        financeCategories,
        createFinanceCategory,
        updateFinanceCategory,
        deleteFinanceCategory,
        recurringTransactions,
        createRecurringTransaction,
        updateRecurringTransaction,
        deleteRecurringTransaction,
        toggleRecurringStatus,
        setPreferredFinanceTab,
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
