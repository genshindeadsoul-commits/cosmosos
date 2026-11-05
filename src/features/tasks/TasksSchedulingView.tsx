import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpRight,
  MapPin,
  Sparkles,
  CalendarDays,
  ListTodo,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePrefs, CalendarTab } from '../../context/PrefsContext';
import { TaskListType, TaskPriority, TASK_LISTS, TASK_PRIORITIES } from '../../types';
import {
  dayKey,
  daysInMonth,
  leadingBlanks,
  monthLabel,
  shiftMonth,
  todayKey,
  formatReadableDate,
  isDateInRange,
  getWeekDaysForDate,
  shiftDayKey,
} from '../../lib/dates';
import { CalendarDateCell, MultiDaySpan } from '../../components/calendar/CalendarDateCell';
import { DayDetailsModal } from '../../components/calendar/DayDetailsModal';

export const TasksSchedulingView: React.FC = () => {
  const {
    tasks,
    events,
    toggleTaskStatus,
    deleteTask,
    addTask,
    addEvent,
    deleteEvent,
    focusRecord,
    setFocusRecord,
    notes,
    addDateNote,
    setSelectedNoteId,
    setActiveModule,
    workouts,
    transactions,
  } = useApp();

  const { prefs, setLastSelectedDate } = usePrefs();

  // Scroll the record chosen in Search/Calendar into view, highlight it briefly, then clear.
  useEffect(() => {
    if (!focusRecord) return;
    document.querySelector(`[data-record-id="${focusRecord.id}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => setFocusRecord(null), 3000);
    return () => clearTimeout(t);
  }, [focusRecord, setFocusRecord]);

  // Calendar View Mode: 'month' | 'week' | 'day'
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week' | 'day'>('month');

  // Active viewing month & year for navigation
  const [viewDate, setViewDate] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  // Selected date (defaults to lastSelectedDate or today)
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => prefs.lastSelectedDate ?? todayKey());

  // Day Details Modal state
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);
  const [modalDateKey, setModalDateKey] = useState<string>(selectedDateKey);

  // Sync selected date with Prefs
  const handleSelectDate = (key: string) => {
    setSelectedDateKey(key);
    setLastSelectedDate(key);
    const [y, m] = key.split('-').map(Number);
    // If selecting a date outside current view, update view
    if (y !== viewDate.y || m - 1 !== viewDate.m) {
      setViewDate({ y, m: m - 1 });
    }
  };

  const handleOpenDayDetails = (key: string) => {
    setSelectedDateKey(key);
    setModalDateKey(key);
    setLastSelectedDate(key);
    setIsDayDetailsOpen(true);
  };

  // Quick navigation helpers
  const handlePrev = () => {
    if (calendarViewMode === 'month') {
      setViewDate((v) => shiftMonth(v.y, v.m, -1));
    } else if (calendarViewMode === 'week') {
      const prevWeek = shiftDayKey(selectedDateKey, -7);
      handleSelectDate(prevWeek);
    } else {
      const prevDay = shiftDayKey(selectedDateKey, -1);
      handleSelectDate(prevDay);
    }
  };

  const handleNext = () => {
    if (calendarViewMode === 'month') {
      setViewDate((v) => shiftMonth(v.y, v.m, 1));
    } else if (calendarViewMode === 'week') {
      const nextWeek = shiftDayKey(selectedDateKey, 7);
      handleSelectDate(nextWeek);
    } else {
      const nextDay = shiftDayKey(selectedDateKey, 1);
      handleSelectDate(nextDay);
    }
  };

  const handleGoToday = () => {
    const today = todayKey();
    const [y, m] = today.split('-').map(Number);
    setViewDate({ y, m: m - 1 });
    handleSelectDate(today);
  };

  // Historical date jumpers
  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 15 }, (_, i) => currentYear - 7 + i);
  }, []);

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Cross-module activity tracker for subtle dots
  const busyDays = useMemo(() => {
    return new Set<string>([
      ...tasks.filter((t) => t.status !== 'completed' && t.dueDate).map((t) => t.dueDate!),
      ...events.map((e) => e.date),
      ...notes.filter((n) => n.noteDate).map((n) => n.noteDate!),
      ...workouts.map((w) => w.date),
      ...transactions.map((t) => t.date),
    ]);
  }, [tasks, events, notes, workouts, transactions]);

  // Records for currently selected date
  const selectedDateEvents = useMemo(() => {
    return events.filter((e) => {
      const start = e.date;
      const end = e.endDate && e.endDate >= e.date ? e.endDate : e.date;
      return isDateInRange(selectedDateKey, start, end);
    });
  }, [events, selectedDateKey]);

  const selectedDateTasks = useMemo(() => {
    return tasks.filter((t) => t.dueDate === selectedDateKey);
  }, [tasks, selectedDateKey]);

  const selectedDateNotes = useMemo(() => {
    return notes.filter((n) => n.noteDate === selectedDateKey);
  }, [notes, selectedDateKey]);

  // Tasks Filter state
  const [listFilter, setListFilter] = useState<string>('All Lists');
  const [statusFilter, setStatusFilter] = useState<string>('All Status');

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesList = listFilter === 'All Lists' || t.list === listFilter;
      const matchesStatus =
        statusFilter === 'All Status' ||
        (statusFilter === 'Completed' && t.status === 'completed') ||
        (statusFilter === 'Active' && t.status !== 'completed');
      return matchesList && matchesStatus;
    });
  }, [tasks, listFilter, statusFilter]);

  // Modals state
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isScheduleEventOpen, setIsScheduleEventOpen] = useState(false);

  // Add Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskList, setTaskList] = useState<TaskListType>('Work');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('HIGH');
  const [taskDueDate, setTaskDueDate] = useState(todayKey());
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskRecurrence, setTaskRecurrence] = useState<'' | 'daily' | 'weekly' | 'monthly'>('');

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    addTask({
      title: taskTitle.trim(),
      description: taskDesc.trim() || undefined,
      list: taskList,
      priority: taskPriority,
      status: 'todo',
      dueDate: taskDueDate,
      dueTime: taskDueTime || undefined,
      recurrence: taskRecurrence || undefined,
    });
    setTaskRecurrence('');
    setTaskTitle('');
    setTaskDesc('');
    setIsAddTaskOpen(false);
  };

  // Schedule Event form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState(todayKey());
  const [eventEndDate, setEventEndDate] = useState(todayKey());
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventColor, setEventColor] = useState('#3D5240');
  const [eventLocation, setEventLocation] = useState('');

  const handleScheduleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    addEvent({
      title: eventTitle.trim(),
      description: eventDesc.trim() || undefined,
      date: eventDate,
      endDate: eventEndDate >= eventDate ? eventEndDate : eventDate,
      startTime: eventAllDay ? '' : eventStart,
      endTime: eventAllDay ? '' : eventEnd,
      allDay: eventAllDay,
      color: eventColor,
      category: 'Work',
      location: eventLocation || undefined,
      source: 'local',
    });
    setEventTitle('');
    setEventDesc('');
    setEventStart('');
    setEventEnd('');
    setEventLocation('');
    setIsScheduleEventOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-2 sm:px-4">
      {/* 1. Workspace Header and Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DFE1D9] dark:border-[#383D35] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
            Tasks & Scheduling
          </h1>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Universal calendar timeline, multi-day scheduling, and task queues
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEventDate(selectedDateKey);
              setEventEndDate(selectedDateKey);
              setIsScheduleEventOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3.5 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] transition-colors shadow-xs"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>Schedule Event</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTaskDueDate(selectedDateKey);
              setIsAddTaskOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* 2. Full Universal Calendar Workspace Card */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-6 shadow-xs space-y-4">
        {/* Calendar Controls & Navigation Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-4">
          {/* Navigation Controls: Prev, Today, Next, Month Year */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7067] dark:text-[#A6AB9F] hover:bg-white dark:hover:bg-[#20231F] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleGoToday}
                className="px-2.5 py-1 text-xs font-bold text-[#3D5240] dark:text-[#A8BDA1] hover:underline"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7067] dark:text-[#A6AB9F] hover:bg-white dark:hover:bg-[#20231F] transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <span className="text-sm sm:text-base font-extrabold text-[#252821] dark:text-[#ECEDE6] px-1">
              {monthLabel(viewDate.y, viewDate.m)}
            </span>

            {/* Historical Jump Selectors */}
            <div className="flex items-center gap-1.5 pl-2">
              <select
                aria-label="Select month"
                value={viewDate.m}
                onChange={(e) => setViewDate({ y: viewDate.y, m: parseInt(e.target.value, 10) })}
                className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 px-2 py-1 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
              >
                {monthsList.map((mon, idx) => (
                  <option key={mon} value={idx}>
                    {mon}
                  </option>
                ))}
              </select>

              <select
                aria-label="Select year"
                value={viewDate.y}
                onChange={(e) => setViewDate({ y: parseInt(e.target.value, 10), m: viewDate.m })}
                className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 px-2 py-1 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none font-mono"
              >
                {yearsList.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View Mode Switcher: Month | Week | Day */}
          <div className="flex items-center rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] p-1 self-start lg:self-auto">
            {(['month', 'week', 'day'] as const).map((vMode) => (
              <button
                key={vMode}
                type="button"
                onClick={() => setCalendarViewMode(vMode)}
                className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition-colors ${
                  calendarViewMode === vMode
                    ? 'bg-white dark:bg-[#20231F] text-[#3D5240] dark:text-[#A8BDA1] shadow-xs'
                    : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
                }`}
              >
                {vMode}
              </button>
            ))}
          </div>
        </div>

        {/* 2A. Month View */}
        {calendarViewMode === 'month' && (
          <div className="space-y-2">
            {/* Weekday Labels Header */}
            <div className="grid grid-cols-7 text-center text-xs font-bold text-[#8A8E85] pb-1">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Grid of Days */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Previous Month Leading Blanks */}
              {Array.from({ length: leadingBlanks(viewDate.y, viewDate.m, 1) }, (_, i) => {
                const prev = shiftMonth(viewDate.y, viewDate.m, -1);
                const prevDaysCount = daysInMonth(prev.y, prev.m);
                const dayNum = prevDaysCount - leadingBlanks(viewDate.y, viewDate.m, 1) + i + 1;
                const k = dayKey(prev.y, prev.m, dayNum);
                return (
                  <CalendarDateCell
                    key={`p-${k}`}
                    dateKey={k}
                    dayNum={dayNum}
                    isToday={k === todayKey()}
                    isSelected={k === selectedDateKey}
                    hasItems={busyDays.has(k)}
                    isCurrentMonth={false}
                    dayOfWeekIndex={i}
                    onSelectDate={handleSelectDate}
                    onOpenDetails={handleOpenDayDetails}
                  />
                );
              })}

              {/* Current Month Days */}
              {Array.from({ length: daysInMonth(viewDate.y, viewDate.m) }, (_, i) => i + 1).map((dayNum) => {
                const k = dayKey(viewDate.y, viewDate.m, dayNum);
                const dayIndex = (leadingBlanks(viewDate.y, viewDate.m, 1) + dayNum - 1) % 7;

                // Calculate multi-day event spans across this date
                const dayEventsList = events.filter((e) => {
                  const start = e.date;
                  const end = e.endDate && e.endDate >= e.date ? e.endDate : e.date;
                  return isDateInRange(k, start, end);
                });

                const multiDaySpans: MultiDaySpan[] = dayEventsList
                  .filter((e) => e.endDate && e.endDate !== e.date)
                  .map((e) => ({
                    id: e.id,
                    title: e.title,
                    color: e.color || '#3D5240',
                    isStart: e.date === k,
                    isEnd: e.endDate === k,
                    isMiddle: e.date < k && k < e.endDate!,
                    allDay: e.allDay,
                  }));

                return (
                  <CalendarDateCell
                    key={k}
                    dateKey={k}
                    dayNum={dayNum}
                    isToday={k === todayKey()}
                    isSelected={k === selectedDateKey}
                    hasItems={busyDays.has(k)}
                    isCurrentMonth={true}
                    dayOfWeekIndex={dayIndex}
                    multiDaySpans={multiDaySpans}
                    onSelectDate={handleSelectDate}
                    onOpenDetails={handleOpenDayDetails}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* 2B. Week View */}
        {calendarViewMode === 'week' && (
          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-2">
              {getWeekDaysForDate(selectedDateKey).map((d, idx) => {
                const isSelected = d.dateKey === selectedDateKey;
                const isToday = d.dateKey === todayKey();
                const dayEvs = events.filter((e) => isDateInRange(d.dateKey, e.date, e.endDate));
                const dayTsks = tasks.filter((t) => t.dueDate === d.dateKey);

                return (
                  <div
                    key={d.dateKey}
                    onClick={() => handleSelectDate(d.dateKey)}
                    onDoubleClick={() => handleOpenDayDetails(d.dateKey)}
                    className={`rounded-xl border p-2 sm:p-3 min-h-[160px] flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#3D5240] dark:border-[#526B55] bg-[#E8EEE6]/40 dark:bg-[#303B2E]/40 ring-2 ring-[#3D5240]'
                        : isToday
                        ? 'border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F8F4] dark:bg-[#1D2B1F]'
                        : 'border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] hover:bg-[#F5F5F0]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-1 border-b border-[#DFE1D9]/70 dark:border-[#383D35]/70">
                        <span className="text-xs font-bold text-[#8A8E85]">{d.dayName}</span>
                        <span className={`text-xs font-bold ${isToday ? 'text-[#3D5240] dark:text-[#A8BDA1]' : ''}`}>
                          {d.dateNum}
                        </span>
                      </div>

                      <div className="space-y-1 pt-2">
                        {dayEvs.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white truncate shadow-2xs"
                            style={{ backgroundColor: ev.color || '#3D5240' }}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayTsks.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            className="text-[10px] text-[#6B7067] dark:text-[#A6AB9F] truncate flex items-center gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-[#526B55]" />
                            <span className="truncate">{t.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDayDetails(d.dateKey);
                      }}
                      className="text-[10px] font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline pt-2 mt-auto"
                    >
                      Details →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2C. Day View */}
        {calendarViewMode === 'day' && (
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F9FAF8] dark:bg-[#181A17] p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#252821] dark:text-[#ECEDE6]">
                  {formatReadableDate(selectedDateKey)}
                </h3>
                <p className="text-xs text-[#8A8E85]">
                  {selectedDateEvents.length} events · {selectedDateTasks.length} tasks · {selectedDateNotes.length} notes
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenDayDetails(selectedDateKey)}
                className="rounded-xl bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] text-white px-4 py-2 text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <span>Open Full Day Details</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day's Agenda items */}
            <div className="space-y-2">
              {selectedDateEvents.length === 0 && selectedDateTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8A8E85]">
                  No scheduled events or tasks for this day. Click "Schedule Event" or "Add Task" to plan.
                </div>
              ) : (
                <>
                  {selectedDateEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 flex items-start justify-between text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="h-3 w-1 rounded-full mt-1" style={{ backgroundColor: ev.color || '#3D5240' }} />
                        <div>
                          <div className="font-bold text-[#252821] dark:text-[#ECEDE6]">{ev.title}</div>
                          <div className="text-[11px] text-[#8A8E85] font-mono">
                            {ev.allDay ? 'All Day' : `${ev.startTime} – ${ev.endTime}`}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteEvent(ev.id)}
                        className="text-[#8A8E85] hover:text-rose-600 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {selectedDateTasks.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <button onClick={() => toggleTaskStatus(t.id)}>
                          {t.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-[#477653]" />
                          ) : (
                            <Circle className="h-4 w-4 text-[#8A8E85]" />
                          )}
                        </button>
                        <span className={t.status === 'completed' ? 'line-through text-[#8A8E85]' : 'font-bold'}>
                          {t.title}
                        </span>
                      </div>
                      <span className="text-[10px] rounded bg-[#F0F1EB] px-1.5 py-0.5 font-bold">
                        {t.priority}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* 2D. Selected Date Interactive Action Banner */}
        <div className="pt-3 border-t border-[#DFE1D9] dark:border-[#383D35] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F9FAF8] dark:bg-[#1A1D19] -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#252821] dark:text-[#ECEDE6]">
              Selected: {formatReadableDate(selectedDateKey)}
            </span>
            <span className="text-[#8A8E85]">
              ({selectedDateEvents.length} events · {selectedDateTasks.length} tasks · {selectedDateNotes.length} notes)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const n = addDateNote(selectedDateKey);
                setFocusRecord({ kind: 'note', id: n.id });
                setActiveModule('notes');
              }}
              className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] transition-colors shadow-2xs"
            >
              Add note for this date
            </button>
            <button
              type="button"
              onClick={() => handleOpenDayDetails(selectedDateKey)}
              aria-label={`Open Day Details for ${selectedDateKey}`}
              className="rounded-xl bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors flex items-center gap-1"
            >
              <span>Open Day Details</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Scheduled Events Card (Preserves existing tests) */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
            <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
              Scheduled Events
            </h2>
          </div>
          <span className="text-xs font-mono text-[#8A8E85]">
            {events.length} events
          </span>
        </div>

        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#8A8E85]">
              No scheduled events yet. Click "Schedule Event" above to create one.
            </div>
          ) : (
            [...events]
              .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''))
              .map((ev) => {
                const isMultiDay = ev.endDate && ev.endDate !== ev.date;
                return (
                  <div
                    key={ev.id}
                    data-record-id={ev.id}
                    className={`${
                      focusRecord?.id === ev.id ? 'ring-2 ring-[#526B55] ' : ''
                    }rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/40 dark:bg-[#181A17]/40 p-4 space-y-2 group`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: ev.color || '#3D5240' }}
                          />
                          <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                            {ev.title}
                          </h3>
                          {isMultiDay && (
                            <span className="rounded bg-[#E8EEE6] dark:bg-[#303B2E] px-1.5 py-0.5 text-[10px] font-bold text-[#3D5240] dark:text-[#A8BDA1]">
                              {ev.date} → {ev.endDate}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6B7067] dark:text-[#A6AB9F] pt-1 font-mono">
                          {ev.allDay ? 'All Day' : `${ev.startTime} - ${ev.endTime}`} · {ev.date}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteEvent(ev.id)}
                        aria-label="Remove scheduled event"
                        className="p-1 text-[#8A8E85] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {ev.description && (
                      <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F] leading-relaxed">
                        {ev.description}
                      </p>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* 4. Task Queues Card (Preserves existing tests) */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
          <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
            Task Queues
          </h2>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2">
            <select
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
            >
              <option value="All Lists">All Lists</option>
              {TASK_LISTS.map((list) => (
                <option key={list} value={list}>
                  {list}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
            >
              <option value="All Status">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Completed">Completed Only</option>
            </select>
          </div>
        </div>

        {/* Task rows */}
        <div className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
          {filteredTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8A8E85]">
              No tasks found in this view. Click "Add Task" to create one.
            </div>
          ) : (
            filteredTasks.map((t) => {
              const isDone = t.status === 'completed';
              return (
                <div
                  key={t.id}
                  data-record-id={t.id}
                  className={`${
                    focusRecord?.id === t.id ? 'ring-2 ring-[#526B55] ' : ''
                  }py-3 flex items-center justify-between hover:bg-[#F5F5F0]/40 dark:hover:bg-[#292D27]/40 px-2 rounded-lg transition-colors group`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => toggleTaskStatus(t.id)}
                      aria-label={`Toggle task ${t.title}`}
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
                        {t.linkedNoteId && notes.some((n) => n.id === t.linkedNoteId) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNoteId(t.linkedNoteId!);
                              setActiveModule('notes');
                            }}
                            className="ml-2 rounded bg-[#ECEDE7] dark:bg-[#292D27] px-1.5 py-0.5 text-[10px] font-semibold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                            aria-label={`Open linked note ${notes.find((n) => n.id === t.linkedNoteId)?.title}`}
                          >
                            Note: {notes.find((n) => n.id === t.linkedNoteId)?.title}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#8A8E85]">
                        <span>{t.list}</span>
                        <span>·</span>
                        <span>{t.dueDate}</span>
                        {t.dueTime && (
                          <>
                            <span>·</span>
                            <span>{t.dueTime}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        t.priority === 'HIGH'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'bg-[#F0F1EB] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F]'
                      }`}
                    >
                      {t.priority}
                    </span>

                    <button
                      onClick={() => deleteTask(t.id)}
                      aria-label="Delete task"
                      className="p-1 text-[#8A8E85] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Add Task Modal */}
      {isAddTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add Task"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                New Task
              </h3>
              <button
                onClick={() => setIsAddTaskOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddTaskSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Task title..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Queue List
                  </label>
                  <select
                    value={taskList}
                    onChange={(e) => setTaskList(e.target.value as TaskListType)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  >
                    {TASK_LISTS.map((list) => (
                      <option key={list} value={list}>
                        {list}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p === 'LOW' ? 'Low' : p === 'MEDIUM' ? 'Medium' : 'High'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">Repeats</label>
                  <select
                    value={taskRecurrence}
                    onChange={(e) => setTaskRecurrence(e.target.value as typeof taskRecurrence)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  >
                    <option value="">Never</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Due Time
                  </label>
                  <input
                    type="text"
                    value={taskDueTime}
                    onChange={(e) => setTaskDueTime(e.target.value)}
                    placeholder="02:30 PM"
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Schedule Event Modal (With Multi-day & Color support) */}
      {isScheduleEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Schedule Event"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Schedule Agenda Event
              </h3>
              <button
                onClick={() => setIsScheduleEventOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleScheduleEventSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mysuru Holiday, Design Team Meeting..."
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Start & End Dates for Multi-day support */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => {
                      setEventDate(e.target.value);
                      if (eventEndDate < e.target.value) setEventEndDate(e.target.value);
                    }}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    End Date (Multi-Day)
                  </label>
                  <input
                    type="date"
                    value={eventEndDate}
                    min={eventDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              {/* All day checkbox and time fields */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventAllDay}
                    onChange={(e) => setEventAllDay(e.target.checked)}
                    className="rounded text-[#3D5240]"
                  />
                  <span>All-Day Event</span>
                </label>
              </div>

              {!eventAllDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                      Start Time
                    </label>
                    <input
                      type="text"
                      placeholder="09:00 AM"
                      value={eventStart}
                      onChange={(e) => setEventStart(e.target.value)}
                      className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                      End Time
                    </label>
                    <input
                      type="text"
                      placeholder="05:00 PM"
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                      className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Event Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Event Color
                </label>
                <div className="flex items-center gap-2">
                  {['#3D5240', '#2563EB', '#D97706', '#E11D48', '#7C3AED', '#0D9488'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEventColor(c)}
                      className={`h-6 w-6 rounded-full transition-transform ${
                        eventColor === c ? 'ring-2 ring-offset-2 ring-black dark:ring-white scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Location / Call Link
                </label>
                <input
                  type="text"
                  placeholder="e.g. Google Meet, Zoom, Mysore Palace Hotel"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Agenda Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes, discussion points, deliverables..."
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors shadow-xs"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Universal Day Details Modal */}
      {isDayDetailsOpen && (
        <DayDetailsModal
          dateKey={modalDateKey}
          onDateChange={(d) => {
            setModalDateKey(d);
            setSelectedDateKey(d);
            const [y, m] = d.split('-').map(Number);
            setViewDate({ y, m: m - 1 });
          }}
          onClose={() => setIsDayDetailsOpen(false)}
        />
      )}
    </div>
  );
};
