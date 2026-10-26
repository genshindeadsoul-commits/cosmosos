import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dayKey, daysInMonth, leadingBlanks, monthLabel, shiftMonth, todayKey } from '../../lib/dates';
import { TaskListType } from '../../types';

export const DashboardView: React.FC = () => {
  const {
    tasks,
    events,
    notes,
    transactions,
    workouts,
    habits,
    toggleTaskStatus,
    addTask,
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

  const [quickTitle, setQuickTitle] = useState('');
  const [selectedQuickList, setSelectedQuickList] = useState<TaskListType>('Work');
  const [view, setView] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(new Date().getDate());

  // Remaining tasks for today (active only)
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const todayActiveTasks = pendingTasks;

  // Outflow calculation from real transactions
  const totalMonthlyOutflow = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const busyDays = new Set<string>([...tasks.filter((t) => t.status !== 'completed' && t.dueDate).map((t) => t.dueDate), ...events.map((e) => e.date)]);

  const handleQuickAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickTitle.trim()) return;
    addTask({
      title: quickTitle.trim(),
      list: selectedQuickList,
      priority: 'MEDIUM',
      status: 'todo',
      dueDate: todayKey(),
    });
    setQuickTitle('');
  };

  // Format focus timer display
  const formatTimerTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const primaryHabit = habits[0];
  const primaryNote = notes[0];
  const primaryWorkout = workouts[0];

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Section: Welcome Banner + Up Next */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#E2EDE2] via-[#C9DCC8] to-[#9CB89B] dark:from-[#213526] dark:via-[#1B2B1E] dark:to-[#142017] p-5 sm:p-7 border border-[#B8CEB6] dark:border-[#2F4A34] shadow-xs">
        {/* Decorative Mountain silhouette SVG in the background */}
        <div className="absolute -bottom-2 -right-4 w-72 sm:w-96 opacity-25 dark:opacity-15 pointer-events-none">
          <svg viewBox="0 0 400 160" fill="currentColor" className="text-[#324C35] dark:text-[#526B55]">
            <polygon points="0,160 80,40 160,160" />
            <polygon points="120,160 210,20 300,160" />
            <polygon points="260,160 330,70 400,160" />
          </svg>
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-7 space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E3022] dark:text-[#ECEDE6]">
              Good Morning, John
            </h1>
            <p className="text-sm font-medium text-[#38543D] dark:text-[#A6AB9F]">
              You have{' '}
              <button
                onClick={() => setActiveModule('tasks')}
                className="font-bold underline decoration-[#38543D] dark:decoration-[#A8BDA1] hover:text-[#18291B] dark:hover:text-white"
              >
                {pendingTasks.length} tasks
              </button>{' '}
              remaining for today
            </p>
          </div>

          {/* Up Next Card */}
          <div className="lg:col-span-5 rounded-xl bg-white/90 dark:bg-[#20231F]/90 backdrop-blur-md p-4 border border-white/60 dark:border-[#383D35] shadow-sm">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#ECEDE7] dark:border-[#292D27]">
              <span className="text-[11px] font-bold tracking-wider text-[#6B7067] dark:text-[#A6AB9F] uppercase">
                Up Next
              </span>
              <CalendarIcon className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
            </div>
            <div className="space-y-2">
              {events.slice(0, 2).map((ev) => (
                <div key={ev.id} className="text-xs">
                  <div className="font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                    {ev.title}
                  </div>
                  <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                    {ev.startTime} - {ev.endTime}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Quick Capture & Today's tasks) + Right (Mini Calendar & Focus Timer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Quick Add Task Input Card */}
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs space-y-3">
            <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="+ Add task for today..."
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                className="w-full text-xs sm:text-sm text-[#252821] dark:text-[#ECEDE6] placeholder-[#8A8E85] bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Send task"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] text-white transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* List Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {(['Inbox', 'Work', 'Study', 'Health', 'Personal'] as TaskListType[]).map((lst) => (
                <button
                  key={lst}
                  type="button"
                  onClick={() => setSelectedQuickList(lst)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    selectedQuickList === lst
                      ? 'bg-[#E8EEE6] text-[#3D5240] dark:bg-[#303B2E] dark:text-[#A8BDA1] ring-1 ring-[#526B55]'
                      : 'bg-[#F5F5F0] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7]'
                  }`}
                >
                  {lst}
                </button>
              ))}
            </div>
          </div>

          {/* Today's Tasks Card */}
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-4 py-3">
              <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Today's task
              </h2>
              <button
                onClick={() => setActiveModule('tasks')}
                className="flex items-center gap-1 text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
              >
                <span>View all tasks</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

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

                      {/* Tag or Priority */}
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
        </div>

        {/* Right Column (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Mini Calendar View */}
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
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[#8A8E85] pb-2">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Real calendar for the viewed month. Dots mark days that actually have a task due or an event. */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {Array.from({ length: leadingBlanks(view.y, view.m, 1) }, (_, i) => {
                const prev = shiftMonth(view.y, view.m, -1);
                const n = daysInMonth(prev.y, prev.m) - leadingBlanks(view.y, view.m, 1) + i + 1;
                return <span key={`p${i}`} className="py-1.5 text-[#C9CDC2] dark:text-[#4A5046]">{n}</span>;
              })}
              {Array.from({ length: daysInMonth(view.y, view.m) }, (_, i) => i + 1).map((day) => {
                const key = dayKey(view.y, view.m, day);
                const isSelected = day === selectedCalendarDay;
                const isToday = key === todayKey();
                const hasDot = busyDays.has(key);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedCalendarDay(day)}
                    aria-label={`${key}${hasDot ? ', has items' : ''}`}
                    aria-current={isToday ? 'date' : undefined}
                    className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-[#3D5240] dark:bg-[#526B55] text-white shadow-xs'
                        : isToday
                        ? 'ring-1 ring-[#252821] dark:ring-[#ECEDE6] text-[#252821] dark:text-[#ECEDE6]'
                        : 'text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]'
                    }`}
                  >
                    <span>{day}</span>
                    {hasDot && (
                      <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[#526B55] dark:bg-[#A8BDA1]'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Focus Timer Card */}
          <div className="relative overflow-hidden rounded-xl border border-[#B8CEB6] dark:border-[#2F4A34] bg-gradient-to-b from-[#E2EDE2] to-[#D4E4D3] dark:from-[#213526] dark:to-[#17251B] p-5 shadow-xs">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-[#38543D] dark:text-[#A8BDA1]">
                Focus timer
              </div>
              <input
                type="text"
                value={focusTaskTitle}
                onChange={(e) => setFocusTaskTitle(e.target.value)}
                className="w-full text-xs font-semibold text-[#1E3022] dark:text-[#ECEDE6] bg-transparent border-b border-transparent hover:border-[#38543D]/30 focus:border-[#38543D] focus:outline-none"
              />
            </div>

            {/* Timer Counter */}
            <div className="flex items-center justify-center gap-4 py-4">
              <button
                onClick={() => {
                  if (focusDurationMins > 5) {
                    const next = focusDurationMins - 5;
                    setFocusDurationMins(next);
                  }
                }}
                disabled={isFocusRunning}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 dark:bg-[#20231F]/70 text-[#1E3022] dark:text-[#ECEDE6] hover:bg-white shadow-xs disabled:opacity-50"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>

              <div className="font-mono text-3xl font-extrabold text-[#1E3022] dark:text-[#ECEDE6]">
                {isFocusRunning ? formatTimerTime(focusSecondsLeft) : `${focusDurationMins} mins`}
              </div>

              <button
                onClick={() => {
                  if (focusDurationMins < 120) {
                    const next = focusDurationMins + 5;
                    setFocusDurationMins(next);
                  }
                }}
                disabled={isFocusRunning}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 dark:bg-[#20231F]/70 text-[#1E3022] dark:text-[#ECEDE6] hover:bg-white shadow-xs disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Play / Reset button */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={toggleFocusTimer}
                className="flex items-center gap-2 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-5 py-2 text-xs font-bold text-white shadow-xs transition-colors"
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
                  className="rounded-lg bg-white/60 dark:bg-[#292D27] p-2 text-[#3D5240] dark:text-[#A8BDA1] hover:bg-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Mountain SVG Artwork */}
            <div className="pt-4 flex flex-col items-center">
              <svg viewBox="0 0 240 70" className="w-56 h-16 text-[#324C35] dark:text-[#526B55]">
                <polygon points="10,70 60,20 110,70" fill="currentColor" opacity="0.6" />
                <polygon points="50,70 120,5 190,70" fill="currentColor" opacity="0.8" />
                <polygon points="150,70 190,25 230,70" fill="currentColor" opacity="0.5" />
              </svg>
              <span className="text-[10px] font-semibold text-[#38543D] dark:text-[#A8BDA1] mt-1">
                Tranquil Forest Focus
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 4 Widget Grid: Notes, Ledger, Fitness, Habits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Widget 1: Recent Notes */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 text-[11px] font-bold text-[#6B7067] dark:text-[#A6AB9F]">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                <span>Recent Notes</span>
              </div>
              <button onClick={() => setActiveModule('notes')} className="hover:underline">
                All Notes
              </button>
            </div>
            {primaryNote && (
              <div className="space-y-1 pt-1">
                <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                  {primaryNote.title}
                </div>
                <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] line-clamp-2">
                  {primaryNote.excerpt}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (primaryNote) setSelectedNoteId(primaryNote.id);
              setActiveModule('notes');
            }}
            className="flex items-center gap-1 text-[11px] font-bold text-[#526B55] dark:text-[#A8BDA1] pt-3 hover:underline"
          >
            <span>Open note</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Widget 2: Ledger Pulse */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 text-[11px] font-bold text-[#6B7067] dark:text-[#A6AB9F]">
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                <span>Ledger Pulse</span>
              </div>
              <button onClick={() => setActiveModule('expenses')} className="hover:underline">
                Ledger
              </button>
            </div>
            <div className="pt-1">
              <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                Monthly Outflow
              </div>
              <div className="text-base font-extrabold text-[#252821] dark:text-[#ECEDE6]">
                ₹{totalMonthlyOutflow.toLocaleString()}
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveModule('expenses')}
            className="flex items-center gap-1 text-[11px] font-bold text-[#526B55] dark:text-[#A8BDA1] pt-3 hover:underline"
          >
            <span>View transactions</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Widget 3: Fitness & Lifts */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 text-[11px] font-bold text-[#6B7067] dark:text-[#A6AB9F]">
              <div className="flex items-center gap-1.5">
                <Dumbbell className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                <span>Fitness & Lifts</span>
              </div>
              <button onClick={() => setActiveModule('fitness')} className="hover:underline">
                Training
              </button>
            </div>
            <div className="pt-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">Workouts Logged</span>
                <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">{workouts.length} sessions</span>
              </div>
              {primaryWorkout && (
                <div className="text-[10px] text-[#8A8E85] truncate">
                  Latest: {primaryWorkout.title}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setActiveModule('fitness')}
            className="flex items-center gap-1 text-[11px] font-bold text-[#526B55] dark:text-[#A8BDA1] pt-3 hover:underline"
          >
            <span>Track lifts</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Widget 4: Daily Habits */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 text-[11px] font-bold text-[#6B7067] dark:text-[#A6AB9F]">
              <div className="flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                <span>Daily Habits</span>
              </div>
              <button onClick={() => setActiveModule('goals')} className="hover:underline">
                Habits
              </button>
            </div>
            {primaryHabit && (
              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] truncate max-w-[120px]">
                    {primaryHabit.name}
                  </div>
                  <div className="text-[10px] text-[#8A8E85]">
                    {primaryHabit.streak}-day streak
                  </div>
                </div>
                <button
                  onClick={() => toggleHabitCheckin(primaryHabit.id, todayKey())}
                  className={`rounded p-1 transition-colors ${
                    primaryHabit.checkins[todayKey()]
                      ? 'text-[#477653] dark:text-[#91B594]'
                      : 'text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
                  }`}
                  aria-label="Toggle habit completion"
                >
                  {primaryHabit.checkins[todayKey()] ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setActiveModule('goals')}
            className="flex items-center gap-1 text-[11px] font-bold text-[#526B55] dark:text-[#A8BDA1] pt-3 hover:underline"
          >
            <span>Check-in habits</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
