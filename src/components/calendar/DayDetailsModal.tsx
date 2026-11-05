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
  BookOpen,
  Dumbbell,
  CreditCard,
  Clock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  MapPin,
  Tag,
  ArrowRight,
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
  CalendarEvent,
  ExpenseCategory,
  TaskListType,
  TaskPriority,
  TransactionType,
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
  onDateChange,
}) => {
  const {
    tasks,
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    addTask,
    deleteTask,
    toggleTaskStatus,
    notes,
    addDateNote,
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

  const { setLastSelectedDate } = usePrefs();
  const [currentDateKey, setCurrentDateKey] = useState(propDateKey);

  // Sync if propDateKey changes
  useEffect(() => {
    setCurrentDateKey(propDateKey);
  }, [propDateKey]);

  // Persist selected date
  useEffect(() => {
    setLastSelectedDate(currentDateKey);
  }, [currentDateKey, setLastSelectedDate]);

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

  // Filter actual entities matching currentDateKey
  const dayEvents = useMemo(() => {
    return events.filter((e) => {
      const start = e.date;
      const end = e.endDate && e.endDate >= e.date ? e.endDate : e.date;
      return start <= currentDateKey && currentDateKey <= end;
    });
  }, [events, currentDateKey]);

  const dayTasks = useMemo(() => {
    return tasks.filter((t) => t.dueDate === currentDateKey || (t.completedAt && t.completedAt.startsWith(currentDateKey)));
  }, [tasks, currentDateKey]);

  const dayNotes = useMemo(() => {
    return notes.filter((n) => n.noteDate === currentDateKey);
  }, [notes, currentDateKey]);

  const dayWorkouts = useMemo(() => {
    return workouts.filter((w) => w.date === currentDateKey);
  }, [workouts, currentDateKey]);

  const dayTransactions = useMemo(() => {
    return transactions.filter((t) => t.date === currentDateKey);
  }, [transactions, currentDateKey]);

  const dayHabits = useMemo(() => {
    return habits.filter((h) => !!h.checkins[currentDateKey]);
  }, [habits, currentDateKey]);

  // Net cash flow for the day
  const dayIncome = useMemo(
    () => dayTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    [dayTransactions]
  );
  const dayExpense = useMemo(
    () => dayTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    [dayTransactions]
  );
  const dayNet = dayIncome - dayExpense;

  const totalRecordCount =
    dayEvents.length +
    dayTasks.length +
    dayNotes.length +
    dayWorkouts.length +
    dayTransactions.length +
    dayHabits.length;

  const isCurrentDayToday = currentDateKey === todayKey();

  // Quick Inline Creation States
  const [activeCreator, setActiveCreator] = useState<
    'none' | 'task' | 'event' | 'note' | 'expense' | 'workout'
  >('none');

  // Task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskList, setNewTaskList] = useState<TaskListType>('Work');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('MEDIUM');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    addTask({
      title: newTaskTitle.trim(),
      list: newTaskList,
      priority: newTaskPriority,
      status: 'todo',
      dueDate: currentDateKey,
    });
    setNewTaskTitle('');
    setActiveCreator('none');
  };

  // Event form
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState(currentDateKey);
  const [newEventStartTime, setNewEventStartTime] = useState('');
  const [newEventEndTime, setNewEventEndTime] = useState('');
  const [newEventAllDay, setNewEventAllDay] = useState(false);
  const [newEventColor, setNewEventColor] = useState('#3D5240');
  const [newEventDesc, setNewEventDesc] = useState('');

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    addEvent({
      title: newEventTitle.trim(),
      date: currentDateKey,
      endDate: newEventEndDate >= currentDateKey ? newEventEndDate : currentDateKey,
      startTime: newEventAllDay ? '' : newEventStartTime,
      endTime: newEventAllDay ? '' : newEventEndTime,
      allDay: newEventAllDay,
      color: newEventColor,
      category: 'General',
      description: newEventDesc.trim() || undefined,
      source: 'local',
    });
    setNewEventTitle('');
    setNewEventDesc('');
    setActiveCreator('none');
  };

  // Expense form
  const [newTxTitle, setNewTxTitle] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxType, setNewTxType] = useState<TransactionType>('expense');
  const [newTxCat, setNewTxCat] = useState<ExpenseCategory>('Groceries');

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newTxAmount);
    if (!amt || amt <= 0) return;
    addTransaction({
      title: newTxTitle.trim() || newTxCat,
      description: newTxTitle.trim() || newTxCat,
      amount: amt,
      type: newTxType,
      category: newTxCat,
      date: currentDateKey,
    });
    setNewTxTitle('');
    setNewTxAmount('');
    setActiveCreator('none');
  };

  // Workout form
  const [newWorkoutTitle, setNewWorkoutTitle] = useState('');
  const [newWorkoutMins, setNewWorkoutMins] = useState('');

  const handleCreateWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkoutTitle.trim()) return;
    addWorkout({
      title: newWorkoutTitle.trim(),
      date: currentDateKey,
      durationMinutes: newWorkoutMins ? parseInt(newWorkoutMins, 10) : null,
      calories: null,
      exercises: [],
    });
    setNewWorkoutTitle('');
    setNewWorkoutMins('');
    setActiveCreator('none');
  };

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
      <div className="w-full sm:max-w-2xl h-[94vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl flex flex-col bg-[#FFFFFF] dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] shadow-2xl overflow-hidden transition-all">
        {/* Header Bar */}
        <div className="shrink-0 border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
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

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Prev / Next Steppers */}
              <div className="flex items-center rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] p-0.5">
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
        </div>

        {/* Scrollable Records Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Universal Rule: If zero records exist, show minimal empty state with Add actions */}
          {totalRecordCount === 0 && (
            <div className="rounded-2xl border border-dashed border-[#DFE1D9] dark:border-[#383D35] p-6 sm:p-8 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F5F0] dark:bg-[#292D27] text-[#8A8E85] mx-auto">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                  No records for {formatReadableDate(currentDateKey)}
                </h3>
                <p className="text-xs text-[#8A8E85] max-w-sm mx-auto">
                  No tasks, scheduled events, notes, expenses, or workouts logged on this date.
                </p>
              </div>

              {/* Add Action Buttons */}
              <div className="pt-2 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCreator('task')}
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white shadow-xs"
                >
                  + Add Task
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreator('event')}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0]"
                >
                  + Schedule Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const n = addDateNote(currentDateKey);
                    setFocusRecord({ kind: 'note', id: n.id });
                    onClose();
                    setActiveModule('notes');
                  }}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0]"
                >
                  Add note for this date
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreator('expense')}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0]"
                >
                  + Log Expense
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreator('workout')}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0]"
                >
                  + Log Workout
                </button>
              </div>
            </div>
          )}

          {/* DYNAMIC RECORD SECTIONS: ONLY RENDER IF RECORDS EXIST! */}

          {/* 1. Scheduled Events Section */}
          {dayEvents.length > 0 && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                    Scheduled Events ({dayEvents.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCreator('event')}
                  className="text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  + Add Event
                </button>
              </div>

              <div className="space-y-2">
                {dayEvents.map((ev) => {
                  const isMultiDay = ev.endDate && ev.endDate !== ev.date;
                  return (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: ev.color || '#3D5240' }}
                          />
                          <span className="font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                            {ev.title}
                          </span>
                          {isMultiDay && (
                            <span className="rounded bg-[#E8EEE6] dark:bg-[#303B2E] px-1.5 py-0.2 text-[10px] font-bold text-[#3D5240] dark:text-[#A8BDA1]">
                              {ev.date} → {ev.endDate}
                            </span>
                          )}
                          {ev.allDay && (
                            <span className="rounded bg-[#F0F1EB] dark:bg-[#292D27] px-1.5 py-0.2 text-[10px] font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                              All Day
                            </span>
                          )}
                        </div>

                        {(!ev.allDay && (ev.startTime || ev.endTime)) && (
                          <div className="text-[11px] font-mono text-[#6B7067] dark:text-[#A6AB9F] pl-4">
                            {ev.startTime} {ev.endTime ? `– ${ev.endTime}` : ''}
                          </div>
                        )}

                        {ev.location && (
                          <div className="flex items-center gap-1 text-[11px] text-[#6B7067] dark:text-[#A6AB9F] pl-4">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{ev.location}</span>
                          </div>
                        )}

                        {ev.description && (
                          <p className="text-[11px] text-[#8A8E85] pl-4 leading-relaxed line-clamp-2">
                            {ev.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteEvent(ev.id)}
                        aria-label={`Remove event ${ev.title}`}
                        className="p-1 text-[#8A8E85] hover:text-rose-600 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Tasks Section */}
          {dayTasks.length > 0 && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                    Tasks ({dayTasks.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCreator('task')}
                  className="text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  + Add Task
                </button>
              </div>

              <div className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
                {dayTasks.map((t) => {
                  const isDone = t.status === 'completed';
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between py-2.5 hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <button
                          type="button"
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
                            className={`text-xs font-bold truncate ${
                              isDone
                                ? 'line-through text-[#8A8E85] dark:text-[#858B7E]'
                                : 'text-[#252821] dark:text-[#ECEDE6]'
                            }`}
                          >
                            {t.title}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#8A8E85]">
                            <span>• {t.list}</span>
                            {t.dueTime && <span>• {t.dueTime}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                            t.priority === 'HIGH'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-[#F0F1EB] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F]'
                          }`}
                        >
                          {t.priority}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteTask(t.id)}
                          aria-label={`Delete task ${t.title}`}
                          className="p-1 text-[#8A8E85] hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Notes Section */}
          {dayNotes.length > 0 && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                    Notes ({dayNotes.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const n = addDateNote(currentDateKey);
                    setFocusRecord({ kind: 'note', id: n.id });
                    onClose();
                    setActiveModule('notes');
                  }}
                  className="text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  Add note for this date
                </button>
              </div>

              <div className="space-y-2">
                {dayNotes.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-3 text-xs"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                        {n.title || 'Untitled Note'}
                      </div>
                      {n.excerpt && (
                        <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] line-clamp-1 mt-0.5">
                          {n.excerpt}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNoteId(n.id);
                          setFocusRecord({ kind: 'note', id: n.id });
                          onClose();
                          setActiveModule('notes');
                        }}
                        className="rounded border border-[#DFE1D9] dark:border-[#383D35] px-2.5 py-1 text-[11px] font-bold text-[#526B55] dark:text-[#A8BDA1] hover:bg-white dark:hover:bg-[#20231F]"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(n.id)}
                        aria-label="Delete note"
                        className="p-1 text-[#8A8E85] hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Expenses & Income Section */}
          {dayTransactions.length > 0 && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                    Expenses & Income ({dayTransactions.length})
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono text-xs font-bold ${
                      dayNet >= 0
                        ? 'text-[#477653] dark:text-[#91B594]'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {dayNet >= 0 ? '+' : ''}₹{dayNet.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveCreator('expense')}
                    className="text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                  >
                    + Log
                  </button>
                </div>
              </div>

              <div className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
                {dayTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2 text-xs hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 px-2 rounded-lg"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                        {tx.title || tx.category}
                      </div>
                      <div className="text-[11px] text-[#8A8E85]">
                        {tx.category} {tx.time ? `• ${tx.time}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono font-bold ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[#252821] dark:text-[#ECEDE6]'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteTransaction(tx.id)}
                        aria-label="Delete transaction"
                        className="p-1 text-[#8A8E85] hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Fitness & Workouts Section */}
          {dayWorkouts.length > 0 && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                    Fitness & Workouts ({dayWorkouts.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCreator('workout')}
                  className="text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  + Log Workout
                </button>
              </div>

              <div className="space-y-2">
                {dayWorkouts.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-3 text-xs"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                        {w.title}
                      </div>
                      <div className="text-[11px] text-[#8A8E85] flex items-center gap-2 mt-0.5">
                        {w.durationMinutes ? <span>{w.durationMinutes} mins</span> : <span>—</span>}
                        {w.calories ? <span>• {w.calories} kcal</span> : null}
                        {w.exercises?.length > 0 && (
                          <span>• {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteWorkout(w.id)}
                      aria-label="Delete workout"
                      className="p-1 text-[#8A8E85] hover:text-rose-600 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Completed Habits Section */}
          {dayHabits.length > 0 && (
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                    Completed Habits ({dayHabits.length})
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dayHabits.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-lg bg-[#E8EEE6]/60 dark:bg-[#303B2E]/40 border border-[#D5DFD3] dark:border-[#384A36] p-2.5 text-xs"
                  >
                    <span className="font-bold text-[#1E3022] dark:text-[#ECEDE6] truncate pr-2">
                      {h.name}
                    </span>
                    <span className="text-[11px] font-bold text-[#526B55] dark:text-[#A8BDA1] shrink-0">
                      {h.streak > 0 ? `${h.streak}d streak` : 'Completed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inline Quick Creation Panels */}
          {activeCreator === 'task' && (
            <div className="rounded-xl border border-[#526B55] bg-[#F5F8F4] dark:bg-[#1D2B1F] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E3022] dark:text-[#ECEDE6]">
                  Add Task for {currentDateKey}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveCreator('none')}
                  className="text-xs text-[#8A8E85] hover:text-[#252821]"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleCreateTask} className="space-y-3">
                <input
                  type="text"
                  placeholder="Task title..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <select
                    value={newTaskList}
                    onChange={(e) => setNewTaskList(e.target.value as TaskListType)}
                    className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6]"
                  >
                    {TASK_LISTS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                    className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6]"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p} Priority
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="ml-auto rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] text-white px-3 py-1 text-xs font-bold shadow-xs"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeCreator === 'event' && (
            <div className="rounded-xl border border-[#526B55] bg-[#F5F8F4] dark:bg-[#1D2B1F] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E3022] dark:text-[#ECEDE6]">
                  Schedule Event ({currentDateKey})
                </span>
                <button
                  type="button"
                  onClick={() => setActiveCreator('none')}
                  className="text-xs text-[#8A8E85] hover:text-[#252821]"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleCreateEvent} className="space-y-3">
                <input
                  type="text"
                  placeholder="Event title (e.g. Mysuru Holiday)..."
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#6B7067] dark:text-[#A6AB9F] block mb-0.5">
                      End Date (for Multi-Day)
                    </label>
                    <input
                      type="date"
                      value={newEventEndDate}
                      min={currentDateKey}
                      onChange={(e) => setNewEventEndDate(e.target.value)}
                      className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#6B7067] dark:text-[#A6AB9F] block mb-0.5">
                      Color
                    </label>
                    <div className="flex items-center gap-1.5 pt-1">
                      {['#3D5240', '#2563EB', '#D97706', '#E11D48', '#7C3AED', '#0D9488'].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewEventColor(col)}
                          className={`h-5 w-5 rounded-full transition-transform ${
                            newEventColor === col ? 'ring-2 ring-offset-1 ring-black dark:ring-white scale-110' : ''
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEventAllDay}
                      onChange={(e) => setNewEventAllDay(e.target.checked)}
                      className="rounded"
                    />
                    <span>All-Day Event</span>
                  </label>
                </div>

                {!newEventAllDay && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Start (e.g. 10:00 AM)"
                      value={newEventStartTime}
                      onChange={(e) => setNewEventStartTime(e.target.value)}
                      className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6]"
                    />
                    <input
                      type="text"
                      placeholder="End (e.g. 11:30 AM)"
                      value={newEventEndTime}
                      onChange={(e) => setNewEventEndTime(e.target.value)}
                      className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6]"
                    />
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] text-white px-4 py-1.5 text-xs font-bold shadow-xs"
                  >
                    Schedule Event
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeCreator === 'expense' && (
            <div className="rounded-xl border border-[#526B55] bg-[#F5F8F4] dark:bg-[#1D2B1F] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E3022] dark:text-[#ECEDE6]">
                  Log Expense / Income
                </span>
                <button
                  type="button"
                  onClick={() => setActiveCreator('none')}
                  className="text-xs text-[#8A8E85] hover:text-[#252821]"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleCreateTx} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Description / title..."
                    value={newTxTitle}
                    onChange={(e) => setNewTxTitle(e.target.value)}
                    className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6]"
                    autoFocus
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount (₹)..."
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={newTxType}
                    onChange={(e) => setNewTxType(e.target.value as TransactionType)}
                    className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6]"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <select
                    value={newTxCat}
                    onChange={(e) => setNewTxCat(e.target.value as ExpenseCategory)}
                    className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6]"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="ml-auto rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] text-white px-3 py-1 text-xs font-bold shadow-xs"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeCreator === 'workout' && (
            <div className="rounded-xl border border-[#526B55] bg-[#F5F8F4] dark:bg-[#1D2B1F] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1E3022] dark:text-[#ECEDE6]">
                  Log Workout Session
                </span>
                <button
                  type="button"
                  onClick={() => setActiveCreator('none')}
                  className="text-xs text-[#8A8E85] hover:text-[#252821]"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleCreateWorkout} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Workout title (e.g. Upper Body)..."
                    value={newWorkoutTitle}
                    onChange={(e) => setNewWorkoutTitle(e.target.value)}
                    className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6]"
                    autoFocus
                  />
                  <input
                    type="number"
                    placeholder="Duration (minutes)..."
                    value={newWorkoutMins}
                    onChange={(e) => setNewWorkoutMins(e.target.value)}
                    className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6]"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] text-white px-3 py-1 text-xs font-bold shadow-xs"
                  >
                    Save Workout
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Bottom Add Menu Bar if records already exist */}
          {totalRecordCount > 0 && activeCreator === 'none' && (
            <div className="pt-2 border-t border-[#DFE1D9] dark:border-[#383D35] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#8A8E85]">Add to this date:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveCreator('task')}
                  className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-[11px] font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-white"
                >
                  + Task
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreator('event')}
                  className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-[11px] font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-white"
                >
                  + Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const n = addDateNote(currentDateKey);
                    setFocusRecord({ kind: 'note', id: n.id });
                    onClose();
                    setActiveModule('notes');
                  }}
                  className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-[11px] font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-white"
                >
                  + Note
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreator('expense')}
                  className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-[11px] font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-white"
                >
                  + Expense
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreator('workout')}
                  className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-[11px] font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-white"
                >
                  + Workout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
