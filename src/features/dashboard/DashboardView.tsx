import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Send,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CreditCard,
  Dumbbell,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Minus,
  SlidersHorizontal,
  Clock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  usePrefs,
  DEFAULT_DASHBOARD_GRID,
  CalendarTab,
  DashboardWidgetId,
  DashboardGridMode,
} from '../../context/PrefsContext';
import {
  dayKey,
  daysInMonth,
  leadingBlanks,
  monthLabel,
  shiftMonth,
  todayKey,
  currentMonthKey,
  formatReadableDate,
} from '../../lib/dates';
import { TaskListType, TASK_LISTS } from '../../types';
import { DayDetailsModal } from '../../components/calendar/DayDetailsModal';
import { Modal } from '../../components/common/Modal';

const ALL_WIDGETS: { id: DashboardWidgetId; label: string; desc: string }[] = [
  { id: 'agenda', label: "Today's Agenda", desc: 'Upcoming commitments & scheduled events' },
  { id: 'tasks', label: "Today's Tasks", desc: 'Active tasks due today with quick capture' },
  { id: 'calendar', label: 'Calendar Overview', desc: 'Compact month view & date activity' },
  { id: 'focus', label: 'Focus Timer', desc: 'Distraction-free focus timer' },
  { id: 'notes', label: 'Recent Notes', desc: 'Quick access to recent notes' },
  { id: 'finance', label: 'Ledger Pulse', desc: 'Monthly cash flow, inflow and outflow' },
  { id: 'fitness', label: 'Fitness & Lifts', desc: 'Monthly workouts & latest training session' },
  { id: 'habits', label: 'Daily Habits', desc: 'One-tap streak check-ins' },
];

export const DashboardView: React.FC = () => {
  const {
    userProfile,
    tasks,
    events,
    notes,
    transactions,
    workouts,
    habits,
    toggleTaskStatus,
    addTask,
    addDateNote,
    setFocusRecord,
    setActiveModule,
    setSelectedNoteId,
    toggleHabitCheckin,
    focusDurationMins,
    setFocusDurationMins,
    focusTaskTitle,
    setFocusTaskTitle,
    isFocusRunning,
    focusSecondsLeft,
    toggleFocusTimer,
    resetFocusTimer,
  } = useApp();

  const { prefs, setDashboardGrid } = usePrefs();
  const gridPrefs = prefs.dashboardGrid ?? DEFAULT_DASHBOARD_GRID;
  const mode: DashboardGridMode = gridPrefs.mode ?? 'auto';
  const hiddenWidgets: DashboardWidgetId[] = gridPrefs.hiddenWidgets ?? [];

  const isWidgetVisible = (id: DashboardWidgetId) => !hiddenWidgets.includes(id);

  const toggleWidgetVisibility = (id: DashboardWidgetId) => {
    const isCurrentlyHidden = hiddenWidgets.includes(id);
    const updated = isCurrentlyHidden
      ? hiddenWidgets.filter((w) => w !== id)
      : [...hiddenWidgets, id];
    setDashboardGrid({ hiddenWidgets: updated });
  };

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isFocusCollapsed, setIsFocusCollapsed] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const todayStr = todayKey();
  const activeMonth = currentMonthKey();

  // Tasks
  const [quickTitle, setQuickTitle] = useState('');
  const [selectedQuickList, setSelectedQuickList] = useState<TaskListType>('Work');
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const todayActiveTasks = pendingTasks;

  const handleQuickAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickTitle.trim()) return;
    addTask({
      title: quickTitle.trim(),
      list: selectedQuickList,
      priority: 'MEDIUM',
      status: 'todo',
      dueDate: todayStr,
    });
    setQuickTitle('');
  };

  // Calendar
  const [view, setView] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(new Date().getDate());
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);
  const [modalDateKey, setModalDateKey] = useState<string>(() => prefs.lastSelectedDate ?? todayStr);
  const [modalInitialTab, setModalInitialTab] = useState<CalendarTab | undefined>(undefined);

  const selectedDayKey = dayKey(view.y, view.m, selectedCalendarDay);
  const dayNotes = notes.filter((n) => n.noteDate === selectedDayKey);

  const busyDays = useMemo(() => {
    return new Set<string>([
      ...tasks.filter((t) => t.status !== 'completed' && t.dueDate).map((t) => t.dueDate),
      ...events.map((e) => e.date),
      ...notes.filter((n) => n.noteDate).map((n) => n.noteDate!),
      ...workouts.map((w) => w.date),
      ...transactions.map((t) => t.date),
    ]);
  }, [tasks, events, notes, workouts, transactions]);

  // Events / Agenda
  const todayEvents = useMemo(() => {
    return events
      .filter((e) => e.date === todayStr)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [events, todayStr]);

  const nextEvent = useMemo(() => {
    if (todayEvents.length > 0) return todayEvents[0];
    const upcoming = events
      .filter((e) => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
    return upcoming[0] || null;
  }, [todayEvents, events, todayStr]);

  // Finance calculations (strictly scoped to active month)
  const monthlyInflow = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'income' && t.date.startsWith(activeMonth))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, activeMonth]);

  const totalMonthlyOutflow = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(activeMonth))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, activeMonth]);

  const netCashFlow = monthlyInflow - totalMonthlyOutflow;
  const activeMonthlyBudget = prefs.monthlyBudgets?.[activeMonth];
  const budgetRemaining = activeMonthlyBudget !== undefined ? activeMonthlyBudget - totalMonthlyOutflow : null;

  // Fitness
  const monthlyWorkoutsCount = useMemo(() => {
    return workouts.filter((w) => w.date.startsWith(activeMonth)).length;
  }, [workouts, activeMonth]);
  const latestWorkout = workouts[0] || null;

  // Habits
  const primaryHabit = habits[0] || null;

  // Format focus timer display
  const formatTimerTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Layout Grid Classes
  const containerClass = useMemo(() => {
    if (mode === '1-col') return 'flex flex-col space-y-5 w-full';
    if (mode === '2-col') return 'grid grid-cols-1 md:grid-cols-2 gap-5 w-full items-start';
    // Auto / Adaptive: 1 column on small/mobile, 2 balanced columns on desktop
    return 'grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start';
  }, [mode]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 px-2 sm:px-4">
      {/* 1. Daily Orientation Command Header */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#526B55] dark:text-[#A8BDA1]">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1E3022] dark:text-[#ECEDE6]">
              {greeting}, {userProfile?.name?.trim() || 'there'}
            </h1>
            <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
              {pendingTasks.length === 0 ? (
                'You are completely caught up for today.'
              ) : (
                <>
                  You have{' '}
                  <button
                    onClick={() => setActiveModule('tasks')}
                    className="font-bold underline decoration-[#526B55] dark:decoration-[#A8BDA1] hover:text-[#18291B] dark:hover:text-white"
                  >
                    {pendingTasks.length} tasks
                  </button>{' '}
                  remaining for today.
                </>
              )}
            </p>
          </div>

          {/* Daily Quick Context Pills + Customize Button */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveModule('tasks')}
              className="flex items-center gap-2 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 px-3 py-1.5 text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#E8EEE6] dark:hover:bg-[#292D27] transition-colors"
            >
              <span className="flex h-2 w-2 rounded-full bg-[#526B55] dark:bg-[#A8BDA1]" />
              <span>{todayActiveTasks.length} Active Tasks</span>
            </button>

            <button
              onClick={() => setActiveModule('tasks')}
              className="flex items-center gap-2 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 px-3 py-1.5 text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#E8EEE6] dark:hover:bg-[#292D27] transition-colors"
            >
              <CalendarIcon className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
              <span>{todayEvents.length} Scheduled</span>
            </button>

            <button
              onClick={() => setActiveModule('expenses')}
              className="flex items-center gap-2 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 px-3 py-1.5 text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#E8EEE6] dark:hover:bg-[#292D27] transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
              <span>₹{totalMonthlyOutflow.toLocaleString()} Outflow</span>
            </button>

            <button
              onClick={() => setIsCustomizing(true)}
              aria-label="Customize dashboard"
              className="flex items-center gap-1.5 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821] dark:hover:text-[#ECEDE6] hover:border-[#526B55] transition-colors shadow-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
              <span className="hidden sm:inline">Customize</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className={containerClass}>
        {/* Column 1: Action & Daily Commitments */}
        <div className="space-y-5 w-full min-w-0">
          {/* 2. Today's Agenda (Combined with Up Next) */}
          {isWidgetVisible('agenda') && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                    Today's Agenda
                  </h2>
                  <span className="rounded-full bg-[#F0F1EB] dark:bg-[#292D27] px-2 py-0.5 text-[10px] font-bold text-[#6B7067] dark:text-[#A6AB9F]">
                    {todayEvents.length}
                  </span>
                </div>
                <button
                  onClick={() => setActiveModule('tasks')}
                  className="flex items-center gap-1 text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  <span>Full Schedule</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Prominent Next Commitment Banner if available */}
              {nextEvent && (
                <div className="border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F8F4] dark:bg-[#1D2B1F]/60 p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-[#38543D] dark:text-[#A8BDA1] flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      <span>Next Commitment</span>
                    </span>
                    <span className="rounded-md bg-white dark:bg-[#20231F] px-2 py-0.5 font-mono text-[11px] font-bold text-[#252821] dark:text-[#ECEDE6] shadow-xs border border-[#DFE1D9] dark:border-[#383D35]">
                      {nextEvent.startTime}
                      {nextEvent.endTime ? ` – ${nextEvent.endTime}` : ''}
                    </span>
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-[#1E3022] dark:text-[#ECEDE6] truncate">
                    {nextEvent.title}
                  </div>
                  {nextEvent.description && (
                    <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] line-clamp-1 mt-0.5">
                      {nextEvent.description}
                    </div>
                  )}
                </div>
              )}

              {/* Today's Chronological Activities */}
              <div className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
                {todayEvents.length === 0 ? (
                  <div className="py-6 px-4 text-center">
                    <Clock className="h-5 w-5 text-[#8A8E85] mx-auto mb-1.5 opacity-60" />
                    <p className="text-xs font-semibold text-[#252821] dark:text-[#ECEDE6]">
                      Your schedule is clear today
                    </p>
                    <p className="text-[11px] text-[#8A8E85] mt-0.5">
                      No events scheduled. Enjoy the open focus time.
                    </p>
                  </div>
                ) : (
                  todayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                          {ev.title}
                        </div>
                        <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{ev.startTime} - {ev.endTime}</span>
                          {ev.description && (
                            <span className="truncate max-w-[160px]">• {ev.description}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setModalDateKey(todayStr);
                          setModalInitialTab('overview');
                          setIsDayDetailsOpen(true);
                        }}
                        className="shrink-0 text-xs text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                      >
                        Details
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 3. Today's Tasks & Streamlined Quick Add */}
          {isWidgetVisible('tasks') && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                    Today's task
                  </h2>
                  <span className="rounded-full bg-[#F0F1EB] dark:bg-[#292D27] px-2 py-0.5 text-[10px] font-bold text-[#6B7067] dark:text-[#A6AB9F]">
                    {todayActiveTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setActiveModule('tasks')}
                  className="flex items-center gap-1 text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  <span>View all tasks</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Integrated Streamlined Task Capture */}
              <div className="border-b border-[#DFE1D9] dark:border-[#383D35] p-3 bg-[#F9FAF8] dark:bg-[#1A1D19]">
                <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="+ Add task for today..."
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    className="flex-1 text-xs sm:text-sm text-[#252821] dark:text-[#ECEDE6] placeholder-[#8A8E85] bg-transparent focus:outline-none px-2 py-1"
                  />
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <select
                      value={selectedQuickList}
                      onChange={(e) => setSelectedQuickList(e.target.value as TaskListType)}
                      className="text-[11px] font-semibold bg-[#E8EEE6] dark:bg-[#303B2E] text-[#3D5240] dark:text-[#A8BDA1] rounded-lg px-2 py-1 border-0 focus:ring-1 focus:ring-[#526B55]"
                    >
                      {TASK_LISTS.map((lst) => (
                        <option key={lst} value={lst}>
                          {lst}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      aria-label="Send task"
                      disabled={!quickTitle.trim()}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] text-white disabled:opacity-40 transition-colors"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Today's Tasks List */}
              <div className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
                {todayActiveTasks.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <CheckCircle2 className="h-6 w-6 text-[#477653] dark:text-[#91B594] mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                      All caught up for today!
                    </p>
                    <p className="text-[11px] text-[#8A8E85] mt-0.5">
                      Completed tasks are safely archived in Tasks & Calendar.
                    </p>
                  </div>
                ) : (
                  todayActiveTasks.slice(0, 8).map((t) => {
                    const isDone = t.status === 'completed';
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => toggleTaskStatus(t.id)}
                            aria-label={`Mark task ${t.title} ${isDone ? 'incomplete' : 'complete'}`}
                            className="shrink-0 text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#526B55]"
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-[#477653] dark:text-[#91B594]" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div
                              className={`truncate text-xs font-semibold ${
                                isDone
                                  ? 'line-through text-[#8A8E85] dark:text-[#858B7E]'
                                  : 'text-[#252821] dark:text-[#ECEDE6]'
                              }`}
                            >
                              {t.title}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-[#8A8E85]">
                              <span>• {t.list}</span>
                              {t.dueTime && <span>• {t.dueTime}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Priority Badge */}
                        <div className="shrink-0 ml-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              t.priority === 'HIGH'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'bg-[#F0F1EB] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F]'
                            }`}
                          >
                            {t.priority === 'HIGH' ? 'HIGH' : 'Focus'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 4. Daily Habits Summary */}
          {isWidgetVisible('habits') && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#DFE1D9] dark:border-[#383D35]">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                    Daily Habits
                  </h2>
                </div>
                <button
                  onClick={() => setActiveModule('goals')}
                  className="flex items-center gap-1 text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  <span>Habits</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {habits.length === 0 ? (
                <div className="py-4 text-center text-xs text-[#8A8E85]">
                  No habits set yet. Start tracking daily routines in Goals & Habits.
                </div>
              ) : (
                <div className="pt-2 divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
                  {habits.slice(0, 3).map((h) => {
                    const isChecked = !!h.checkins[todayStr];
                    return (
                      <div
                        key={h.id}
                        className="flex items-center justify-between py-2.5 first:pt-1 last:pb-1"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                            {h.name}
                          </div>
                          <div className="text-[11px] text-[#8A8E85]">
                            {h.streak > 0 ? `${h.streak}-day streak` : 'Ready to start streak'}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleHabitCheckin(h.id, todayStr)}
                          aria-label="Toggle habit completion"
                          className={`rounded p-1 transition-colors ${
                            isChecked
                              ? 'text-[#477653] dark:text-[#91B594]'
                              : 'text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
                          }`}
                        >
                          {isChecked ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Context, Reflection & Metrics */}
        <div className="space-y-5 w-full min-w-0">
          {/* 5. Compact Monthly Calendar */}
          {isWidgetVisible('calendar') && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3">
                <span className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                  {monthLabel(view.y, view.m)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    aria-label="Previous month"
                    onClick={() => setView((v) => shiftMonth(v.y, v.m, -1))}
                    className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Next month"
                    onClick={() => setView((v) => shiftMonth(v.y, v.m, 1))}
                    className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Days of week */}
              <div className="grid grid-cols-7 text-center text-[10px] sm:text-[11px] font-semibold text-[#8A8E85] pb-2">
                <span className="truncate min-w-0"><span className="hidden sm:inline">Mon</span><span className="sm:hidden">M</span></span>
                <span className="truncate min-w-0"><span className="hidden sm:inline">Tue</span><span className="sm:hidden">T</span></span>
                <span className="truncate min-w-0"><span className="hidden sm:inline">Wed</span><span className="sm:hidden">W</span></span>
                <span className="truncate min-w-0"><span className="hidden sm:inline">Thu</span><span className="sm:hidden">T</span></span>
                <span className="truncate min-w-0"><span className="hidden sm:inline">Fri</span><span className="sm:hidden">F</span></span>
                <span className="truncate min-w-0"><span className="hidden sm:inline">Sat</span><span className="sm:hidden">S</span></span>
                <span className="truncate min-w-0"><span className="hidden sm:inline">Sun</span><span className="sm:hidden">S</span></span>
              </div>

              {/* Real calendar grid for the viewed month */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-xs w-full">
                {Array.from({ length: leadingBlanks(view.y, view.m, 1) }, (_, i) => {
                  const prev = shiftMonth(view.y, view.m, -1);
                  const n = daysInMonth(prev.y, prev.m) - leadingBlanks(view.y, view.m, 1) + i + 1;
                  return (
                    <span
                      key={`p${i}`}
                      className="flex items-center justify-center p-1 sm:p-1.5 text-xs text-[#C9CDC2] dark:text-[#4A5046] min-w-0 w-full aspect-square"
                    >
                      {n}
                    </span>
                  );
                })}
                {Array.from({ length: daysInMonth(view.y, view.m) }, (_, i) => i + 1).map((day) => {
                  const key = dayKey(view.y, view.m, day);
                  const isSelected = day === selectedCalendarDay;
                  const isToday = key === todayStr;
                  const hasDot = busyDays.has(key);
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        setSelectedCalendarDay(day);
                        setModalDateKey(key);
                        setModalInitialTab('overview');
                        setIsDayDetailsOpen(true);
                      }}
                      aria-label={`${key}${hasDot ? ', has items' : ''}`}
                      aria-current={isToday ? 'date' : undefined}
                      className={`relative flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg text-xs font-semibold transition-colors min-w-0 w-full aspect-square ${
                        isSelected
                          ? 'bg-[#3D5240] dark:bg-[#526B55] text-white shadow-xs'
                          : isToday
                          ? 'ring-1 ring-[#252821] dark:ring-[#ECEDE6] text-[#252821] dark:text-[#ECEDE6]'
                          : 'text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]'
                      }`}
                    >
                      <span>{day}</span>
                      {hasDot && (
                        <span
                          className={`h-1 w-1 rounded-full ${
                            isSelected ? 'bg-white' : 'bg-[#526B55] dark:bg-[#A8BDA1]'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Details & Notes Region */}
              <div className="mt-3 border-t border-[#DFE1D9] dark:border-[#383D35] pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setModalDateKey(selectedDayKey);
                      setModalInitialTab('overview');
                      setIsDayDetailsOpen(true);
                    }}
                    className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:underline flex items-center gap-1"
                  >
                    <span>Day Details ({selectedDayKey})</span>
                    <ArrowUpRight className="h-3 w-3 text-[#526B55] dark:text-[#A8BDA1]" />
                  </button>
                  <button
                    onClick={() => {
                      const n = addDateNote(selectedDayKey);
                      setFocusRecord({ kind: 'note', id: n.id });
                      setActiveModule('notes');
                    }}
                    className="inline-flex items-center gap-1 rounded bg-[#3D5240] dark:bg-[#526B55] px-2 py-1 text-[11px] font-bold text-white hover:bg-[#2E3F31]"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{dayNotes.length === 0 ? 'Add note for this date' : 'Add another note'}</span>
                  </button>
                </div>

                {dayNotes.length === 0 ? (
                  <p className="text-[11px] text-[#8A8E85]">
                    No notes for this date. Click to view day schedule & notes.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {dayNotes.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[#252821] dark:text-[#ECEDE6]">
                            {n.title || 'Untitled'}
                          </p>
                          <p className="truncate text-[10px] text-[#6B7067] dark:text-[#A6AB9F]">
                            {n.excerpt || 'No content'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setFocusRecord({ kind: 'note', id: n.id });
                            setActiveModule('notes');
                          }}
                          className="rounded border border-[#DFE1D9] dark:border-[#383D35] px-2 py-0.5 text-[11px] font-semibold hover:bg-white dark:hover:bg-[#20231F]"
                        >
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. Sleek & Compact Focus Timer */}
          {isWidgetVisible('focus') && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs transition-all">
              <div className="flex items-center justify-between pb-2 border-b border-[#DFE1D9] dark:border-[#383D35]">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#38543D] dark:text-[#A8BDA1]">
                    Focus Timer
                  </span>
                </div>
                <button
                  onClick={() => setIsFocusCollapsed(!isFocusCollapsed)}
                  className="rounded p-1 text-[#8A8E85] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
                  title={isFocusCollapsed ? 'Expand timer' : 'Minimize timer'}
                >
                  {isFocusCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              </div>

              {isFocusCollapsed ? (
                /* Compact Minimized View */
                <div className="flex items-center justify-between pt-3">
                  <div className="min-w-0 pr-2">
                    <div className="font-mono text-base font-extrabold text-[#1E3022] dark:text-[#ECEDE6]">
                      {isFocusRunning ? formatTimerTime(focusSecondsLeft) : `${focusDurationMins} mins`}
                    </div>
                    <div className="text-[11px] text-[#8A8E85] truncate">
                      {focusTaskTitle || 'Focus session'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={toggleFocusTimer}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] text-white shadow-xs"
                    >
                      {isFocusRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    {isFocusRunning && (
                      <button
                        onClick={resetFocusTimer}
                        title="Reset timer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DFE1D9] dark:border-[#383D35] text-[#3D5240] dark:text-[#A8BDA1]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Expanded Sleek View */
                <div className="pt-3 space-y-3">
                  <input
                    type="text"
                    value={focusTaskTitle}
                    onChange={(e) => setFocusTaskTitle(e.target.value)}
                    placeholder="What are you focusing on?"
                    className="w-full text-xs font-semibold text-[#1E3022] dark:text-[#ECEDE6] bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 rounded-lg px-2.5 py-1.5 border border-transparent focus:border-[#526B55] focus:outline-none"
                  />

                  {/* Timer Display with Quick Adjusters */}
                  <div className="flex items-center justify-center gap-3 py-1">
                    <button
                      onClick={() => {
                        if (focusDurationMins > 5) setFocusDurationMins(focusDurationMins - 5);
                      }}
                      disabled={isFocusRunning}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#292D27] text-[#1E3022] dark:text-[#ECEDE6] hover:bg-white disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>

                    <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#1E3022] dark:text-[#ECEDE6] whitespace-nowrap min-w-[120px] text-center">
                      {isFocusRunning ? formatTimerTime(focusSecondsLeft) : `${focusDurationMins} mins`}
                    </div>

                    <button
                      onClick={() => {
                        if (focusDurationMins < 120) setFocusDurationMins(focusDurationMins + 5);
                      }}
                      disabled={isFocusRunning}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#292D27] text-[#1E3022] dark:text-[#ECEDE6] hover:bg-white disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Play & Reset controls */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={toggleFocusTimer}
                      className="flex items-center gap-2 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
                    >
                      {isFocusRunning ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          <span>Start</span>
                        </>
                      )}
                    </button>
                    {isFocusRunning && (
                      <button
                        onClick={resetFocusTimer}
                        title="Reset timer"
                        className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] p-1.5 text-[#3D5240] dark:text-[#A8BDA1] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Ledger Pulse (Monthly Cash Flow) */}
          {isWidgetVisible('finance') && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#DFE1D9] dark:border-[#383D35]">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#38543D] dark:text-[#A8BDA1]">
                    Ledger Pulse
                  </span>
                </div>
                <button
                  onClick={() => setActiveModule('expenses')}
                  className="flex items-center gap-1 text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  <span>Ledger</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="pt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 p-2.5">
                  <div className="flex items-center gap-1 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                    <TrendingDown className="h-3 w-3 text-rose-500" />
                    <span>Monthly Outflow</span>
                  </div>
                  <div className="text-base font-extrabold text-[#252821] dark:text-[#ECEDE6] mt-0.5">
                    ₹{totalMonthlyOutflow.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 p-2.5">
                  <div className="flex items-center gap-1 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span>Monthly Inflow</span>
                  </div>
                  <div className="text-base font-extrabold text-[#252821] dark:text-[#ECEDE6] mt-0.5">
                    ₹{monthlyInflow.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Net Cash Flow & Budget Bar */}
              <div className="mt-3 pt-2.5 border-t border-[#DFE1D9] dark:border-[#383D35] flex items-center justify-between text-xs">
                <span className="text-[#6B7067] dark:text-[#A6AB9F]">Net Cash Flow:</span>
                <span
                  className={`font-mono font-bold ${
                    netCashFlow >= 0
                      ? 'text-[#477653] dark:text-[#91B594]'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {netCashFlow >= 0 ? '+' : ''}₹{netCashFlow.toLocaleString()}
                </span>
              </div>

              {activeMonthlyBudget !== undefined && (
                <div className="mt-2 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                  <div className="flex justify-between">
                    <span>Budget ({activeMonth}):</span>
                    <span className="font-semibold text-[#252821] dark:text-[#ECEDE6]">
                      ₹{activeMonthlyBudget.toLocaleString()}
                    </span>
                  </div>
                  {budgetRemaining !== null && (
                    <div className="text-right text-[10px] font-medium text-[#8A8E85] mt-0.5">
                      {budgetRemaining >= 0
                        ? `₹${budgetRemaining.toLocaleString()} remaining`
                        : `₹${Math.abs(budgetRemaining).toLocaleString()} over budget`}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 8. Fitness & Lifts Summary */}
          {isWidgetVisible('fitness') && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#DFE1D9] dark:border-[#383D35]">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#38543D] dark:text-[#A8BDA1]">
                    Fitness & Lifts
                  </span>
                </div>
                <button
                  onClick={() => setActiveModule('fitness')}
                  className="flex items-center gap-1 text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  <span>Training</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">Workouts Logged</span>
                  <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                    {workouts.length} sessions ({monthlyWorkoutsCount} this month)
                  </span>
                </div>

                {latestWorkout ? (
                  <div className="rounded-lg bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 p-2.5 text-xs">
                    <div className="font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                      Latest: {latestWorkout.title}
                    </div>
                    <div className="text-[11px] text-[#8A8E85] mt-0.5 flex items-center gap-2">
                      <span>{formatReadableDate(latestWorkout.date)}</span>
                      {latestWorkout.exercises.length > 0 && (
                        <span>• {latestWorkout.exercises.length} exercise{latestWorkout.exercises.length === 1 ? '' : 's'}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-[#8A8E85] py-1">
                    No workouts logged yet. Start tracking sets & sessions in Fitness.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 9. Recent Notes */}
          {isWidgetVisible('notes') && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#DFE1D9] dark:border-[#383D35]">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#38543D] dark:text-[#A8BDA1]">
                    Recent Notes
                  </span>
                </div>
                <button
                  onClick={() => setActiveModule('notes')}
                  className="flex items-center gap-1 text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  <span>All Notes</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {notes.length === 0 ? (
                <div className="py-4 text-center text-xs text-[#8A8E85]">
                  No notes recorded yet. Quick capture thoughts and agendas.
                </div>
              ) : (
                <div className="pt-2 divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
                  {notes.slice(0, 3).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setSelectedNoteId(n.id);
                        setFocusRecord({ kind: 'note', id: n.id });
                        setActiveModule('notes');
                      }}
                      className="group cursor-pointer py-2.5 first:pt-1 last:pb-1 hover:bg-[#F5F5F0]/40 dark:hover:bg-[#292D27]/40 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-[#252821] dark:text-[#ECEDE6] truncate group-hover:text-[#3D5240] dark:group-hover:text-[#A8BDA1]">
                          {n.title || 'Untitled note'}
                        </div>
                        {n.noteDate && (
                          <span className="text-[10px] font-mono text-[#8A8E85] shrink-0 ml-2">
                            {n.noteDate}
                          </span>
                        )}
                      </div>
                      {n.excerpt && (
                        <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] line-clamp-1 mt-0.5">
                          {n.excerpt}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 10. Dashboard Customizer Modal */}
      {isCustomizing && (
        <Modal
          isOpen={isCustomizing}
          onClose={() => setIsCustomizing(false)}
          title="Customize Dashboard"
        >
          <div className="space-y-5">
            {/* Grid Layout Preference */}
            <div>
              <label className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] block mb-2">
                Grid Layout
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: '1-col' as DashboardGridMode, label: 'One Column', desc: 'Spacious single column' },
                  { id: '2-col' as DashboardGridMode, label: 'Two Columns', desc: 'Side-by-side' },
                  { id: 'auto' as DashboardGridMode, label: 'Auto / Adaptive', desc: 'Adaptive for screen' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setDashboardGrid({ mode: opt.id })}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      mode === opt.id
                        ? 'border-[#3D5240] dark:border-[#526B55] bg-[#E8EEE6] dark:bg-[#303B2E]/70 ring-1 ring-[#3D5240] dark:ring-[#526B55]'
                        : 'border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-[#6B7067] dark:text-[#A6AB9F] mt-0.5">
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Widget Visibility Toggles */}
            <div>
              <label className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] block mb-2">
                Visible Widgets
              </label>
              <div className="divide-y divide-[#DFE1D9] dark:divide-[#383D35] border border-[#DFE1D9] dark:border-[#383D35] rounded-xl overflow-hidden">
                {ALL_WIDGETS.map((w) => {
                  const visible = isWidgetVisible(w.id);
                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-[#20231F]"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                          {w.label}
                        </div>
                        <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                          {w.desc}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleWidgetVisibility(w.id)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          visible ? 'bg-[#3D5240] dark:bg-[#526B55]' : 'bg-[#DFE1D9] dark:bg-[#383D35]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            visible ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reset to Default Button */}
            <div className="pt-2 flex justify-between items-center">
              <button
                type="button"
                onClick={() =>
                  setDashboardGrid({
                    mode: 'auto',
                    hiddenWidgets: [],
                  })
                }
                className="text-xs text-[#6B7067] dark:text-[#A6AB9F] hover:underline"
              >
                Reset layout to default
              </button>
              <button
                type="button"
                onClick={() => setIsCustomizing(false)}
                className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 11. Universal Calendar Day Details Modal */}
      {isDayDetailsOpen && (
        <DayDetailsModal
          dateKey={modalDateKey}
          initialTab={modalInitialTab}
          onDateChange={(d) => {
            setModalDateKey(d);
            const [y, m, day] = d.split('-').map(Number);
            setView({ y, m: m - 1 });
            setSelectedCalendarDay(day);
          }}
          onClose={() => setIsDayDetailsOpen(false)}
        />
      )}
    </div>
  );
};
