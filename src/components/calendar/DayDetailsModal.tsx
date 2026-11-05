import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Edit2,
  BookOpen,
  Dumbbell,
  CreditCard,
  Flame,
  Clock,
  ArrowUpRight,
  Check,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePrefs, CalendarTab } from '../../context/PrefsContext';
import {
  shiftDayKey,
  formatReadableDate,
  todayKey,
  dateNoteTitle,
  dateNoteContent,
} from '../../lib/dates';
import {
  ExpenseCategory,
  TaskListType,
  TaskPriority,
  TransactionType,
  ExerciseEntry,
  TASK_LISTS,
  TASK_PRIORITIES,
  EXPENSE_CATEGORIES,
} from '../../types';

interface DayDetailsModalProps {
  dateKey: string;
  onClose: () => void;
  initialTab?: CalendarTab;
  onDateChange?: (newDateKey: string) => void;
}

export const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  dateKey: propDateKey,
  onClose,
  initialTab,
  onDateChange,
}) => {
  const {
    tasks,
    events,
    deleteEvent,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    notes,
    addNote,
    addDateNote,
    updateNote,
    deleteNote,
    setSelectedNoteId,
    setFocusRecord,
    workouts,
    addWorkout,
    deleteWorkout,
    transactions,
    addTransaction,
    deleteTransaction,
    habits,
    toggleHabitCheckin,
    setActiveModule,
  } = useApp();

  const { prefs, setPreferredCalendarTab, setLastSelectedDate } = usePrefs();

  const [currentDateKey, setCurrentDateKey] = useState(propDateKey);

  // Sync if propDateKey changes
  useEffect(() => {
    setCurrentDateKey(propDateKey);
  }, [propDateKey]);

  // Persist last selected date
  useEffect(() => {
    setLastSelectedDate(currentDateKey);
  }, [currentDateKey, setLastSelectedDate]);

  const [activeTab, setActiveTab] = useState<CalendarTab>(
    initialTab ?? prefs.preferredCalendarTab ?? 'overview'
  );

  const handleTabChange = (tab: CalendarTab) => {
    setActiveTab(tab);
    setPreferredCalendarTab(tab);
  };

  const handlePrevDay = () => {
    const prev = shiftDayKey(currentDateKey, -1);
    setCurrentDateKey(prev);
    onDateChange?.(prev);
  };

  const handleNextDay = () => {
    const next = shiftDayKey(currentDateKey, 1);
    setCurrentDateKey(next);
    onDateChange?.(next);
  };

  const handleGoToday = () => {
    const today = todayKey();
    setCurrentDateKey(today);
    onDateChange?.(today);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filter entities by currentDateKey
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === currentDateKey),
    [tasks, currentDateKey]
  );
  const dayEvents = useMemo(
    () => events.filter((e) => e.date === currentDateKey),
    [events, currentDateKey]
  );
  const completedDayTasks = useMemo(
    () => dayTasks.filter((t) => t.status === 'completed'),
    [dayTasks]
  );
  const dayNotes = useMemo(
    () => notes.filter((n) => n.noteDate === currentDateKey),
    [notes, currentDateKey]
  );
  const dayWorkouts = useMemo(
    () => workouts.filter((w) => w.date === currentDateKey),
    [workouts, currentDateKey]
  );
  const dayTransactions = useMemo(
    () => transactions.filter((t) => t.date === currentDateKey),
    [transactions, currentDateKey]
  );

  const dayIncome = useMemo(
    () =>
      dayTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0),
    [dayTransactions]
  );
  const dayExpense = useMemo(
    () =>
      dayTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
    [dayTransactions]
  );
  const dayNet = dayIncome - dayExpense;

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskList, setTaskList] = useState<TaskListType>('Work');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    addTask({
      title: taskTitle.trim(),
      list: taskList,
      priority: taskPriority,
      status: 'todo',
      dueDate: currentDateKey,
    });
    setTaskTitle('');
  };

  // Note form state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const handleCreateCustomNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) return;
    const title = noteTitle.trim() || dateNoteTitle(currentDateKey);
    const content = noteContent.trim() || dateNoteContent(currentDateKey);
    addNote({
      title,
      content,
      excerpt: content.slice(0, 100).replace(/\n/g, ' '),
      tags: ['Daily'],
      noteDate: currentDateKey,
    });
    setNoteTitle('');
    setNoteContent('');
    setIsAddingNote(false);
  };

  // Workout form state
  const [isAddingWorkout, setIsAddingWorkout] = useState(false);
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [workoutDuration, setWorkoutDuration] = useState('');
  const [workoutCalories, setWorkoutCalories] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState<ExerciseEntry[]>([]);

  const handleAddWorkoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutTitle.trim()) return;
    addWorkout({
      title: workoutTitle.trim(),
      date: currentDateKey,
      durationMinutes: workoutDuration ? parseInt(workoutDuration, 10) : null,
      calories: workoutCalories ? parseInt(workoutCalories, 10) : null,
      exercises: workoutExercises.filter((ex) => ex.name.trim()),
    });
    setWorkoutTitle('');
    setWorkoutDuration('');
    setWorkoutCalories('');
    setWorkoutExercises([]);
    setIsAddingWorkout(false);
  };

  const handleQuickAddExercise = (name: string, setsReps: string) => {
    setWorkoutExercises((prev) => [...prev, { name, setsReps }]);
  };

  // Expense form state
  const [isAddingTx, setIsAddingTx] = useState(false);
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txCategory, setTxCategory] = useState<ExpenseCategory>('Groceries');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');

  const handleAddTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(txAmount);
    if (!amt || amt <= 0) return;
    addTransaction({
      type: txType,
      category: txCategory,
      title: txTitle.trim() || txCategory,
      description: txTitle.trim() || txCategory,
      amount: amt,
      date: currentDateKey,
    });
    setTxTitle('');
    setTxAmount('');
    setIsAddingTx(false);
  };

  const isCurrentDayToday = currentDateKey === todayKey();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-details-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col bg-[#FFFFFF] dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] shadow-2xl overflow-hidden transition-all">
        {/* Fixed Header */}
        <div className="shrink-0 border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8EEE6] dark:bg-[#303B2E] text-[#3D5240] dark:text-[#A8BDA1]">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    id="day-details-title"
                    className="text-base sm:text-lg font-bold text-[#252821] dark:text-[#ECEDE6] truncate"
                  >
                    {formatReadableDate(currentDateKey)}
                  </h2>
                  {isCurrentDayToday && (
                    <span className="shrink-0 rounded bg-[#3D5240] dark:bg-[#526B55] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      Today
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-mono text-[#8A8E85]">
                  {currentDateKey}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Previous / Next Day Navigation */}
              <div className="flex items-center rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] p-0.5 mr-1">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  aria-label="Previous day"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {!isCurrentDayToday && (
                  <button
                    type="button"
                    onClick={handleGoToday}
                    className="px-2 py-1 text-[11px] font-bold text-[#3D5240] dark:text-[#A8BDA1] hover:underline"
                  >
                    Today
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNextDay}
                  aria-label="Next day"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close day details"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 -mb-1 scrollbar-none">
            {[
              { id: 'overview', label: 'Overview', icon: Sparkles, count: undefined },
              { id: 'tasks', label: 'Tasks & Schedule', icon: CheckCircle2, count: dayTasks.length + dayEvents.length },
              { id: 'notes', label: 'Notes', icon: BookOpen, count: dayNotes.length },
              { id: 'workout', label: 'Workout', icon: Dumbbell, count: dayWorkouts.length },
              { id: 'expenses', label: 'Expenses', icon: CreditCard, count: dayTransactions.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id as CalendarTab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#3D5240] dark:bg-[#526B55] text-white shadow-xs'
                      : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[#E8EEE6] dark:bg-[#292D27] text-[#3D5240] dark:text-[#A8BDA1]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Daily Pulse Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div
                  onClick={() => handleTabChange('tasks')}
                  className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-3 cursor-pointer hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                    <span>Tasks</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                  </div>
                  <div className="text-xl font-bold text-[#252821] dark:text-[#ECEDE6] mt-1">
                    {completedDayTasks.length}/{dayTasks.length}
                  </div>
                  <div className="text-[10px] text-[#8A8E85]">
                    {dayTasks.length === 0 ? 'None scheduled' : completedDayTasks.length === dayTasks.length ? 'All finished' : `${dayTasks.length - completedDayTasks.length} pending`}
                  </div>
                </div>

                <div
                  onClick={() => handleTabChange('notes')}
                  className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-3 cursor-pointer hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                    <span>Notes</span>
                    <BookOpen className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                  </div>
                  <div className="text-xl font-bold text-[#252821] dark:text-[#ECEDE6] mt-1">
                    {dayNotes.length}
                  </div>
                  <div className="text-[10px] text-[#8A8E85]">
                    {dayNotes.length === 0 ? 'No notes' : `${dayNotes.length} written`}
                  </div>
                </div>

                <div
                  onClick={() => handleTabChange('workout')}
                  className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-3 cursor-pointer hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                    <span>Workout</span>
                    <Dumbbell className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                  </div>
                  <div className="text-xl font-bold text-[#252821] dark:text-[#ECEDE6] mt-1">
                    {dayWorkouts.length > 0 ? `${dayWorkouts[0].durationMinutes ?? 0}m` : '0m'}
                  </div>
                  <div className="text-[10px] text-[#8A8E85]">
                    {dayWorkouts.length > 0 ? dayWorkouts[0].title : 'Rest day'}
                  </div>
                </div>

                <div
                  onClick={() => handleTabChange('expenses')}
                  className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-3 cursor-pointer hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                    <span>Expenses</span>
                    <CreditCard className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                  </div>
                  <div className="text-xl font-bold text-[#252821] dark:text-[#ECEDE6] mt-1">
                    ₹{dayExpense.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[#8A8E85]">
                    {dayTransactions.length} {dayTransactions.length === 1 ? 'record' : 'records'}
                  </div>
                </div>
              </div>

              {/* Tasks Preview */}
              <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                    Scheduled Tasks ({dayTasks.length})
                  </span>
                  <button
                    onClick={() => handleTabChange('tasks')}
                    className="text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline flex items-center gap-1"
                  >
                    <span>Manage tasks</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
                {dayTasks.length === 0 ? (
                  <p className="text-xs text-[#8A8E85]">No tasks scheduled for this date.</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayTasks.slice(0, 4).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#F5F5F0]/50 dark:bg-[#181A17]/50 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={() => toggleTaskStatus(t.id)}
                            className="shrink-0 text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#526B55]"
                          >
                            {t.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-[#477653] dark:text-[#91B594]" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </button>
                          <span
                            className={`truncate font-semibold ${
                              t.status === 'completed'
                                ? 'line-through text-[#8A8E85]'
                                : 'text-[#252821] dark:text-[#ECEDE6]'
                            }`}
                          >
                            {t.title}
                          </span>
                        </div>
                        <span className="shrink-0 rounded bg-[#E8EEE6] dark:bg-[#303B2E] px-1.5 py-0.5 text-[10px] font-semibold text-[#3D5240] dark:text-[#A8BDA1]">
                          {t.list}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Scheduled Events Preview (if any) */}
              {dayEvents.length > 0 && (
                <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                      Calendar Events ({dayEvents.length})
                    </span>
                    <button
                      onClick={() => handleTabChange('tasks')}
                      className="text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline flex items-center gap-1"
                    >
                      <span>View schedule</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#F5F5F0]/50 dark:bg-[#181A17]/50 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#252821] dark:text-[#ECEDE6] truncate">{ev.title}</p>
                          <p className="text-[10px] text-[#8A8E85]">
                            {ev.startTime ? `${ev.startTime}${ev.endTime ? ` - ${ev.endTime}` : ''}` : 'All day'}
                            {ev.location ? ` · ${ev.location}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 rounded bg-[#E8EEE6] dark:bg-[#303B2E] px-1.5 py-0.5 text-[10px] font-semibold text-[#3D5240] dark:text-[#A8BDA1]">
                          {ev.source === 'google_calendar' ? 'Google' : 'Local'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workout Summary Card */}
              <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                    Fitness & Training
                  </span>
                  <button
                    onClick={() => handleTabChange('workout')}
                    className="text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline flex items-center gap-1"
                  >
                    <span>{dayWorkouts.length > 0 ? 'View details' : '+ Log workout'}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
                {dayWorkouts.length === 0 ? (
                  <p className="text-xs text-[#8A8E85]">No workout session logged for this date.</p>
                ) : (
                  <div className="space-y-2">
                    {dayWorkouts.map((w) => (
                      <div
                        key={w.id}
                        className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/40 dark:bg-[#181A17]/40 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                            {w.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                            {w.durationMinutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {w.durationMinutes}m
                              </span>
                            )}
                            {w.calories && (
                              <span className="flex items-center gap-1">
                                <Flame className="h-3 w-3 text-orange-500" />
                                {w.calories} kcal
                              </span>
                            )}
                          </div>
                        </div>
                        {w.exercises?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {w.exercises.map((ex, i) => (
                              <span
                                key={i}
                                className="rounded bg-white dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] px-2 py-0.5 text-[10px] font-mono text-[#252821] dark:text-[#ECEDE6]"
                              >
                                {ex.name}: {ex.setsReps}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Habits Check-in Status */}
              <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                    Habit Check-ins for this Date
                  </span>
                  <button
                    onClick={() => {
                      onClose();
                      setActiveModule('goals');
                    }}
                    className="text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline flex items-center gap-1"
                  >
                    <span>All habits</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
                {habits.length === 0 ? (
                  <p className="text-xs text-[#8A8E85]">No habits configured yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {habits.map((h) => {
                      const isChecked = Boolean(h.checkins?.[currentDateKey]);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => toggleHabitCheckin(h.id, currentDateKey)}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${
                            isChecked
                              ? 'border-[#3D5240] dark:border-[#526B55] bg-[#E8EEE6] dark:bg-[#303B2E]/60 text-[#1E3022] dark:text-[#ECEDE6]'
                              : 'border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                isChecked
                                  ? 'border-[#3D5240] bg-[#3D5240] text-white'
                                  : 'border-[#8A8E85] bg-transparent'
                              }`}
                            >
                              {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                            </div>
                            <span className="text-xs font-semibold truncate">{h.name}</span>
                          </div>
                          <span className="text-[10px] font-mono shrink-0 ml-1">
                            {h.streak}d streak
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TASKS */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {/* Quick Add Task Form */}
              <form
                onSubmit={handleCreateTask}
                className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-3 space-y-2.5"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`+ Add task for ${formatReadableDate(currentDateKey)}...`}
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="flex-1 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-[#8A8E85]">List:</span>
                    {TASK_LISTS.map((lst) => (
                      <button
                        key={lst}
                        type="button"
                        onClick={() => setTaskList(lst)}
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                          taskList === lst
                            ? 'bg-[#3D5240] text-white dark:bg-[#526B55]'
                            : 'bg-white dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F]'
                        }`}
                      >
                        {lst}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#8A8E85]">Priority:</span>
                    {TASK_PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTaskPriority(p)}
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          taskPriority === p
                            ? p === 'HIGH'
                              ? 'bg-rose-600 text-white'
                              : 'bg-[#3D5240] text-white dark:bg-[#526B55]'
                            : 'bg-white dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              {/* Task List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#6B7067] dark:text-[#A6AB9F]">
                  <span>
                    Tasks ({completedDayTasks.length}/{dayTasks.length} done)
                  </span>
                </div>

                {dayTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#DFE1D9] dark:border-[#383D35] p-8 text-center text-xs text-[#8A8E85]">
                    No tasks scheduled for this date. Use the form above to add one.
                  </div>
                ) : (
                  dayTasks.map((t) => {
                    const isDone = t.status === 'completed';
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] hover:bg-[#F5F5F0]/40 dark:hover:bg-[#181A17]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleTaskStatus(t.id)}
                            className="shrink-0 text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#526B55]"
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-5 w-5 text-[#477653] dark:text-[#91B594]" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-semibold truncate ${
                                isDone
                                  ? 'line-through text-[#8A8E85]'
                                  : 'text-[#252821] dark:text-[#ECEDE6]'
                              }`}
                            >
                              {t.title}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-[#8A8E85] pt-0.5">
                              <span>{t.list}</span>
                              {t.dueTime && <span>• {t.dueTime}</span>}
                              <span
                                className={`rounded px-1 text-[9px] font-bold ${
                                  t.priority === 'HIGH'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                    : 'bg-[#F0F1EB] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F]'
                                }`}
                              >
                                {t.priority}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteTask(t.id)}
                          aria-label={`Delete task ${t.title}`}
                          className="shrink-0 p-1.5 text-[#8A8E85] hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Scheduled Calendar Events */}
              {dayEvents.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-[#DFE1D9] dark:border-[#383D35]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#6B7067] dark:text-[#A6AB9F]">
                    <span>Scheduled Events ({dayEvents.length})</span>
                  </div>
                  <div className="space-y-2">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F]"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] truncate">{ev.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-[#8A8E85] pt-0.5">
                            {ev.startTime && <span>{ev.startTime}{ev.endTime ? ` - ${ev.endTime}` : ''}</span>}
                            {ev.location && <span>• {ev.location}</span>}
                            <span className="rounded bg-[#E8EEE6] dark:bg-[#303B2E] text-[#3D5240] dark:text-[#A8BDA1] px-1 text-[9px] font-bold">
                              {ev.source === 'google_calendar' ? 'Google Calendar' : 'Local Event'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteEvent(ev.id)}
                          aria-label={`Delete event ${ev.title}`}
                          className="shrink-0 p-1.5 text-[#8A8E85] hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Date Notes ({dayNotes.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const n = addDateNote(currentDateKey);
                    setIsAddingNote(false);
                  }}
                  className="flex items-center gap-1 rounded bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-2.5 py-1 text-xs font-bold text-white shadow-xs"
                >
                  <Plus className="h-3 w-3" />
                  <span>{dayNotes.length === 0 ? 'Create Date Note' : 'Add Note'}</span>
                </button>
              </div>

              {dayNotes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DFE1D9] dark:border-[#383D35] p-8 text-center space-y-2">
                  <BookOpen className="h-6 w-6 text-[#8A8E85] mx-auto" />
                  <p className="text-xs font-semibold text-[#252821] dark:text-[#ECEDE6]">
                    No notes associated with {currentDateKey}
                  </p>
                  <p className="text-[11px] text-[#8A8E85]">
                    Click above to create a persistent daily note for this date.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dayNotes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                            {n.title || 'Untitled Note'}
                          </h4>
                          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F] pt-1 line-clamp-3 whitespace-pre-wrap">
                            {n.content || 'Empty note content.'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedNoteId(n.id);
                              setFocusRecord({ kind: 'note', id: n.id });
                              onClose();
                              setActiveModule('notes');
                            }}
                            title="Open in Notes editor"
                            className="flex items-center gap-1 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-2.5 py-1 text-xs font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]"
                          >
                            <span>Open</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNote(n.id)}
                            aria-label="Delete note"
                            className="p-1.5 text-[#8A8E85] hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WORKOUT */}
          {activeTab === 'workout' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Training Logs for {currentDateKey}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingWorkout(!isAddingWorkout)}
                  className="flex items-center gap-1 rounded bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-2.5 py-1 text-xs font-bold text-white shadow-xs"
                >
                  <Plus className="h-3 w-3" />
                  <span>{isAddingWorkout ? 'Cancel' : 'Log Workout'}</span>
                </button>
              </div>

              {/* Quick Add Workout Form */}
              {isAddingWorkout && (
                <form
                  onSubmit={handleAddWorkoutSubmit}
                  className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-4 space-y-3"
                >
                  <h4 className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                    Log New Workout Session
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Session Title (e.g. Upper Body)"
                      value={workoutTitle}
                      onChange={(e) => setWorkoutTitle(e.target.value)}
                      className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Duration (mins)"
                      value={workoutDuration}
                      onChange={(e) => setWorkoutDuration(e.target.value)}
                      className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Calories (kcal)"
                      value={workoutCalories}
                      onChange={(e) => setWorkoutCalories(e.target.value)}
                      className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    />
                  </div>

                  {/* Quick exercise tags */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-[#8A8E85]">Quick Add Exercise:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'Bench Press', setsReps: '3x10' },
                        { name: 'Squats', setsReps: '4x8' },
                        { name: 'Deadlifts', setsReps: '3x5' },
                        { name: 'Pull-ups', setsReps: '3x8' },
                        { name: 'Running', setsReps: '30 mins' },
                      ].map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => handleQuickAddExercise(item.name, item.setsReps)}
                          className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2 py-0.5 text-[10px] font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#E8EEE6]"
                        >
                          + {item.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exercises list */}
                  {workoutExercises.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {workoutExercises.map((ex, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded bg-[#E8EEE6] dark:bg-[#303B2E] px-2 py-0.5 text-[11px] font-mono font-semibold text-[#3D5240] dark:text-[#A8BDA1]"
                        >
                          <span>{ex.name} ({ex.setsReps})</span>
                          <button
                            type="button"
                            onClick={() =>
                              setWorkoutExercises(workoutExercises.filter((_, i) => i !== idx))
                            }
                            className="text-rose-500 hover:text-rose-700 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white shadow-xs"
                    >
                      Save Workout Log
                    </button>
                  </div>
                </form>
              )}

              {/* Workouts List */}
              {dayWorkouts.length === 0 && !isAddingWorkout ? (
                <div className="rounded-xl border border-dashed border-[#DFE1D9] dark:border-[#383D35] p-8 text-center space-y-2">
                  <Dumbbell className="h-6 w-6 text-[#8A8E85] mx-auto" />
                  <p className="text-xs font-semibold text-[#252821] dark:text-[#ECEDE6]">
                    No workouts logged on {currentDateKey}
                  </p>
                  <p className="text-[11px] text-[#8A8E85]">
                    Log a lifting or cardio session above to record it on this day.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dayWorkouts.map((w) => (
                    <div
                      key={w.id}
                      className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                            {w.title}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-[#6B7067] dark:text-[#A6AB9F] pt-0.5">
                            {w.durationMinutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {w.durationMinutes} mins
                              </span>
                            )}
                            {w.calories && (
                              <span className="flex items-center gap-1">
                                <Flame className="h-3 w-3 text-orange-500" />
                                {w.calories} kcal
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteWorkout(w.id)}
                          aria-label="Delete workout"
                          className="p-1.5 text-[#8A8E85] hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {w.exercises?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {w.exercises.map((ex, i) => (
                            <span
                              key={i}
                              className="rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 px-2 py-0.5 text-xs font-mono font-semibold text-[#252821] dark:text-[#ECEDE6]"
                            >
                              {ex.name}: {ex.setsReps}
                              {ex.weightLbs ? ` @ ${ex.weightLbs}lbs` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setActiveModule('fitness');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  <span>Open complete Fitness & Training module</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              {/* Daily Financial Summary */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 text-center">
                <div>
                  <span className="text-[10px] font-bold text-[#8A8E85] uppercase">Income</span>
                  <p className="text-sm font-bold text-[#477653] dark:text-[#91B594]">
                    +₹{dayIncome.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#8A8E85] uppercase">Expenses</span>
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    -₹{dayExpense.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#8A8E85] uppercase">Daily Net</span>
                  <p
                    className={`text-sm font-bold ${
                      dayNet >= 0
                        ? 'text-[#477653] dark:text-[#91B594]'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {dayNet >= 0 ? '+' : '-'}₹{Math.abs(dayNet).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Add Transaction Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Transactions for {currentDateKey}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingTx(!isAddingTx)}
                  className="flex items-center gap-1 rounded bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-2.5 py-1 text-xs font-bold text-white shadow-xs"
                >
                  <Plus className="h-3 w-3" />
                  <span>{isAddingTx ? 'Cancel' : 'Add Transaction'}</span>
                </button>
              </div>

              {/* Quick Add Transaction Form */}
              {isAddingTx && (
                <form
                  onSubmit={handleAddTxSubmit}
                  className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTxType('expense')}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors ${
                        txType === 'expense'
                          ? 'bg-rose-600 text-white'
                          : 'bg-white dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F]'
                      }`}
                    >
                      Expense (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType('income')}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors ${
                        txType === 'income'
                          ? 'bg-[#3D5240] text-white dark:bg-[#526B55]'
                          : 'bg-white dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F]'
                      }`}
                    >
                      Income (+)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Title / Description"
                      value={txTitle}
                      onChange={(e) => setTxTitle(e.target.value)}
                      className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Amount (₹)"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    />
                    <select
                      aria-label="Transaction category"
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value as ExpenseCategory)}
                      className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white shadow-xs"
                    >
                      Save Transaction
                    </button>
                  </div>
                </form>
              )}

              {/* Transactions List */}
              {dayTransactions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DFE1D9] dark:border-[#383D35] p-8 text-center text-xs text-[#8A8E85]">
                  No transactions recorded on {currentDateKey}.
                </div>
              ) : (
                <div className="space-y-2">
                  {dayTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                            {tx.title || tx.description || tx.category}
                          </span>
                          <span className="rounded bg-[#F0F1EB] dark:bg-[#292D27] px-2 py-0.5 text-[10px] font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                            {tx.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono font-bold text-xs ${
                            tx.type === 'income'
                              ? 'text-[#477653] dark:text-[#91B594]'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteTransaction(tx.id)}
                          aria-label="Delete transaction"
                          className="p-1.5 text-[#8A8E85] hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
