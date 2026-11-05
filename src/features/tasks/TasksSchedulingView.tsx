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
  Sun,
  Layers,
  Search,
  CheckSquare,
  ArrowUpDown,
  Tag,
  AlertCircle,
  Edit2,
  Archive,
  RefreshCw,
  Repeat,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePrefs, TaskWorkspaceView } from '../../context/PrefsContext';
import {
  TaskListType,
  TaskPriority,
  TASK_LISTS,
  TASK_PRIORITIES,
  TASK_LIST_METADATA,
  DefaultTaskListType,
  Task,
  CustomTaskListMeta,
} from '../../types';
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
import { TaskRow } from '../../components/tasks/TaskRow';
import { TaskCreateCard } from '../../components/tasks/TaskCreateCard';
import { CreateListModal, DeleteListModal } from '../../components/tasks/CustomListModal';

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
    bulkUpdateTasks,
    bulkDeleteTasks,
  } = useApp();

  const {
    prefs,
    setLastSelectedDate,
    setActiveTaskWorkspaceView,
    setSelectedTaskList,
    updateCustomTaskList,
  } = usePrefs();

  // Scroll the record chosen in Search/Calendar into view, highlight it briefly, then clear.
  useEffect(() => {
    if (!focusRecord) return;
    document
      .querySelector(`[data-record-id="${focusRecord.id}"]`)
      ?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => setFocusRecord(null), 3000);
    return () => clearTimeout(t);
  }, [focusRecord, setFocusRecord]);

  // Active Workspace Navigation View
  const [activeTab, setActiveTab] = useState<TaskWorkspaceView>(
    () => prefs.activeTaskWorkspaceView || 'calendar'
  );

  useEffect(() => {
    if (prefs.activeTaskWorkspaceView && prefs.activeTaskWorkspaceView !== activeTab) {
      setActiveTab(prefs.activeTaskWorkspaceView);
    }
  }, [prefs.activeTaskWorkspaceView]);

  const handleTabSelect = (tab: TaskWorkspaceView) => {
    setActiveTab(tab);
    setActiveTaskWorkspaceView(tab);
  };

  // Calendar View Mode: 'month' | 'week' | 'day'
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week' | 'day'>('month');

  // Active viewing month & year for calendar navigation
  const [viewDate, setViewDate] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  // Selected date (defaults to lastSelectedDate or today)
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    () => prefs.lastSelectedDate ?? todayKey()
  );

  // Day Details Modal state
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);
  const [modalDateKey, setModalDateKey] = useState<string>(selectedDateKey);

  // Sync selected date with Prefs
  const handleSelectDate = (key: string) => {
    setSelectedDateKey(key);
    setLastSelectedDate(key);
    const [y, m] = key.split('-').map(Number);
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

  // Quick calendar navigation helpers
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

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 15 }, (_, i) => currentYear - 7 + i);
  }, []);

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Cross-module activity tracker for calendar dots
  const busyDays = useMemo(() => {
    return new Set<string>([
      ...tasks.filter((t) => t.status !== 'completed' && t.dueDate).map((t) => t.dueDate!),
      ...events.map((e) => e.date),
      ...notes.filter((n) => n.noteDate).map((n) => n.noteDate!),
      ...workouts.map((w) => w.date),
      ...transactions.map((t) => t.date),
    ]);
  }, [tasks, events, notes, workouts, transactions]);

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

  // Available task lists (default + custom)
  const availableLists = useMemo(() => {
    return [
      ...TASK_LISTS,
      ...(prefs.customTaskLists?.filter((l) => !l.archived).map((l) => l.name) ?? []),
    ];
  }, [prefs.customTaskLists]);

  // Today calculations
  const today = todayKey();
  const overdueTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'completed' && t.dueDate && t.dueDate < today);
  }, [tasks, today]);

  const todayTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'completed' && t.dueDate === today);
  }, [tasks, today]);

  const todayCompletedTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.status === 'completed' &&
        ((t.completedAt && t.completedAt.startsWith(today)) || t.dueDate === today)
    );
  }, [tasks, today]);

  const todayScheduledEvents = useMemo(() => {
    return events.filter((e) => isDateInRange(today, e.date, e.endDate));
  }, [events, today]);

  // Upcoming calculations
  const tomorrow = shiftDayKey(today, 1);
  const weekEnd = shiftDayKey(today, 7);

  const tomorrowTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'completed' && t.dueDate === tomorrow);
  }, [tasks, tomorrow]);

  const thisWeekTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.status !== 'completed' &&
        t.dueDate &&
        t.dueDate > tomorrow &&
        t.dueDate <= weekEnd
    );
  }, [tasks, tomorrow, weekEnd]);

  const laterTasks = useMemo(() => {
    return tasks.filter(
      (t) => t.status !== 'completed' && t.dueDate && t.dueDate > weekEnd
    );
  }, [tasks, weekEnd]);

  const unscheduledTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'completed' && !t.dueDate);
  }, [tasks]);

  // All Tasks: Search, Filters, Sorting & Bulk Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState<string>('All Lists');
  const [statusFilter, setStatusFilter] = useState<string>('All Status');
  const [priorityFilter, setPriorityFilter] = useState<string>('All Priorities');
  const [sortBy, setSortBy] = useState<'due_asc' | 'due_desc' | 'priority' | 'title' | 'created'>('due_asc');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const handleToggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = (tasksToSelect: Task[]) => {
    if (selectedTaskIds.size === tasksToSelect.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(tasksToSelect.map((t) => t.id)));
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const matchesSearch =
          !searchQuery.trim() ||
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
          t.list.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesList = listFilter === 'All Lists' || t.list === listFilter;

        const matchesStatus =
          statusFilter === 'All Status' ||
          (statusFilter === 'Completed' && t.status === 'completed') ||
          (statusFilter === 'Active' && t.status !== 'completed');

        const matchesPriority =
          priorityFilter === 'All Priorities' || t.priority === priorityFilter;

        return matchesSearch && matchesList && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (sortBy === 'due_asc') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }
        if (sortBy === 'due_desc') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return b.dueDate.localeCompare(a.dueDate);
        }
        if (sortBy === 'priority') {
          const pScore: Record<TaskPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          return pScore[b.priority] - pScore[a.priority];
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [tasks, searchQuery, listFilter, statusFilter, priorityFilter, sortBy]);

  // Bulk actions on selected tasks
  const handleBulkComplete = () => {
    const ids = Array.from(selectedTaskIds);
    bulkUpdateTasks(ids, { status: 'completed', completedAt: new Date().toISOString() });
    setSelectedTaskIds(new Set());
  };

  const handleBulkReschedule = (targetDate: string) => {
    const ids = Array.from(selectedTaskIds);
    bulkUpdateTasks(ids, { dueDate: targetDate });
    setSelectedTaskIds(new Set());
  };

  const handleBulkSetPriority = (priority: TaskPriority) => {
    const ids = Array.from(selectedTaskIds);
    bulkUpdateTasks(ids, { priority });
    setSelectedTaskIds(new Set());
  };

  const handleBulkMoveList = (targetList: TaskListType) => {
    const ids = Array.from(selectedTaskIds);
    bulkUpdateTasks(ids, { list: targetList });
    setSelectedTaskIds(new Set());
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedTaskIds);
    bulkDeleteTasks(ids);
    setSelectedTaskIds(new Set());
  };

  // Custom Lists Management
  const selectedListName = prefs.selectedTaskList || 'Inbox';
  const selectedListCustomMeta = prefs.customTaskLists?.find((l) => l.name === selectedListName);

  const selectedListActiveTasks = useMemo(() => {
    return tasks.filter((t) => t.list === selectedListName && t.status !== 'completed');
  }, [tasks, selectedListName]);

  const selectedListCompletedTasks = useMemo(() => {
    return tasks.filter((t) => t.list === selectedListName && t.status === 'completed');
  }, [tasks, selectedListName]);

  // Modals state
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isScheduleEventOpen, setIsScheduleEventOpen] = useState(false);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [isEditListModalOpen, setIsEditListModalOpen] = useState(false);
  const [isDeleteListModalOpen, setIsDeleteListModalOpen] = useState(false);

  // Add Task Modal form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskList, setTaskList] = useState<TaskListType>('Inbox');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');
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
      dueDate: taskDueDate || todayKey(),
      dueTime: taskDueTime || undefined,
      recurrence: taskRecurrence || undefined,
    });
    setTaskRecurrence('');
    setTaskTitle('');
    setTaskDesc('');
    setTaskDueTime('');
    setIsAddTaskOpen(false);
  };

  // Schedule Event form state
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
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-2 sm:px-4">
      {/* 1. Unified Workspace Header & Navigation Tabs */}
      <div className="space-y-4 border-b border-[#DFE1D9] dark:border-[#383D35] pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        {/* Workspace View Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F0F1EB] dark:bg-[#181A17] overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabSelect('calendar')}
            aria-label="Calendar workspace"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'calendar'
                ? 'bg-white dark:bg-[#20231F] text-[#3D5240] dark:text-[#A8BDA1] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSelect('today')}
            aria-label="Today workspace"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'today'
                ? 'bg-white dark:bg-[#20231F] text-[#3D5240] dark:text-[#A8BDA1] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Today</span>
            {todayTasks.length + overdueTasks.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  overdueTasks.length > 0
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'bg-[#E8EEE6] text-[#3D5240] dark:bg-[#303B2E] dark:text-[#A8BDA1]'
                }`}
              >
                {todayTasks.length + overdueTasks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabSelect('upcoming')}
            aria-label="Upcoming workspace"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'upcoming'
                ? 'bg-white dark:bg-[#20231F] text-[#3D5240] dark:text-[#A8BDA1] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Upcoming</span>
            {tomorrowTasks.length + thisWeekTasks.length > 0 && (
              <span className="rounded-full bg-[#E8EEE6] dark:bg-[#303B2E] text-[#3D5240] dark:text-[#A8BDA1] px-1.5 py-0.2 text-[10px]">
                {tomorrowTasks.length + thisWeekTasks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabSelect('all')}
            aria-label="All tasks workspace"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-white dark:bg-[#20231F] text-[#3D5240] dark:text-[#A8BDA1] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" />
            <span>All Tasks</span>
            <span className="rounded-full bg-[#E8EEE6] dark:bg-[#303B2E] text-[#3D5240] dark:text-[#A8BDA1] px-1.5 py-0.2 text-[10px]">
              {tasks.filter((t) => t.status !== 'completed').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSelect('lists')}
            aria-label="Custom lists workspace"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === 'lists'
                ? 'bg-white dark:bg-[#20231F] text-[#3D5240] dark:text-[#A8BDA1] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Custom Lists</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VIEW 1: CALENDAR & TIMELINE (Preserves Phase 3 & Test Suite)   */}
      {/* ============================================================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Calendar Workspace Card */}
          <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-6 shadow-xs space-y-4">
            {/* Calendar Controls & Navigation Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-4">
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

            {/* Month View */}
            {calendarViewMode === 'month' && (
              <div className="space-y-2">
                <div className="grid grid-cols-7 text-center text-xs font-bold text-[#8A8E85] pb-1">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {Array.from({ length: leadingBlanks(viewDate.y, viewDate.m, 1) }, (_, i) => {
                    const prev = shiftMonth(viewDate.y, viewDate.m, -1);
                    const prevDaysCount = daysInMonth(prev.y, prev.m);
                    const dayNum = prevDaysCount - leadingBlanks(viewDate.y, viewDate.m, 1) + i + 1;
                    const k = dayKey(prev.y, prev.m, dayNum);
                    return (
                      <CalendarDateCell
                        key={k}
                        dateKey={k}
                        dayNum={dayNum}
                        isToday={k === todayKey()}
                        isSelected={k === selectedDateKey}
                        hasItems={busyDays.has(k)}
                        isCurrentMonth={false}
                        dayOfWeekIndex={i % 7}
                        onSelectDate={handleSelectDate}
                        onOpenDetails={handleOpenDayDetails}
                      />
                    );
                  })}

                  {Array.from({ length: daysInMonth(viewDate.y, viewDate.m) }, (_, i) => i + 1).map((dayNum) => {
                    const k = dayKey(viewDate.y, viewDate.m, dayNum);
                    const dayIndex = (leadingBlanks(viewDate.y, viewDate.m, 1) + dayNum - 1) % 7;

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

            {/* Week View */}
            {calendarViewMode === 'week' && (
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-2">
                  {getWeekDaysForDate(selectedDateKey).map((d) => {
                    const isSelected = d.dateKey === selectedDateKey;
                    const isToday = d.dateKey === todayKey();
                    const dayEvs = events.filter((e) => isDateInRange(d.dateKey, e.date, e.endDate));
                    const dayTsks = tasks.filter((t) => t.dueDate === d.dateKey);

                    return (
                      <div
                        key={d.dateKey}
                        onClick={() => handleSelectDate(d.dateKey)}
                        className={`rounded-xl border p-2.5 min-h-[140px] flex flex-col justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#526B55] bg-[#E8EEE6]/40 dark:bg-[#303B2E]/40 ring-2 ring-[#526B55]'
                            : isToday
                            ? 'border-[#3D5240] bg-white dark:bg-[#20231F]'
                            : 'border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F]'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-[#8A8E85]">{d.dayName}</span>
                            <span className={isToday ? 'text-[#3D5240] font-extrabold' : ''}>{d.dateNum}</span>
                          </div>
                          <div className="space-y-1 pt-1">
                            {dayEvs.slice(0, 2).map((ev) => (
                              <div
                                key={ev.id}
                                className="truncate rounded px-1 py-0.5 text-[10px] font-bold text-white"
                                style={{ backgroundColor: ev.color || '#3D5240' }}
                              >
                                {ev.title}
                              </div>
                            ))}
                            {dayTsks.slice(0, 2).map((tk) => (
                              <div
                                key={tk.id}
                                className="truncate rounded bg-[#F0F1EB] dark:bg-[#292D27] px-1 py-0.5 text-[10px] text-[#252821] dark:text-[#ECEDE6]"
                              >
                                • {tk.title}
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
                          className="text-[10px] font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline pt-2 mt-auto text-left"
                        >
                          Details →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day View */}
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
                          <button onClick={() => deleteEvent(ev.id)} className="text-[#8A8E85] hover:text-rose-600 p-1">
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

            {/* Selected Date Interactive Action Banner */}
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

          {/* Scheduled Events Card (Preserves search record highlight and backwards tests) */}
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

            <div className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
              {events.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8A8E85]">
                  No scheduled events found. Click "Schedule Event" above to create one.
                </div>
              ) : (
                events.map((e) => (
                  <div
                    key={e.id}
                    data-record-id={e.id}
                    className={`${
                      focusRecord?.id === e.id ? 'ring-2 ring-[#526B55] ' : ''
                    }py-3 flex items-start justify-between hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 px-2 rounded-lg transition-colors`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-1 h-3.5 w-1 rounded-full shrink-0"
                        style={{ backgroundColor: e.color || '#3D5240' }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                            {e.title}
                          </h3>
                          {e.endDate && e.endDate !== e.date && (
                            <span className="rounded bg-[#E8EEE6] dark:bg-[#303B2E] px-1.5 py-0.2 text-[10px] font-bold text-[#3D5240] dark:text-[#A8BDA1]">
                              {e.date} → {e.endDate}
                            </span>
                          )}
                          {e.allDay && (
                            <span className="rounded bg-[#F0F1EB] dark:bg-[#292D27] px-1.5 py-0.2 text-[10px] text-[#6B7067] dark:text-[#A6AB9F]">
                              All Day
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#8A8E85] font-mono mt-0.5">
                          <span>{e.date}</span>
                          {!e.allDay && (e.startTime || e.endTime) && (
                            <>
                              <span>·</span>
                              <span>{e.startTime} - {e.endTime}</span>
                            </>
                          )}
                          {e.location && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-0.5 font-sans">
                                <MapPin className="h-3 w-3" />
                                {e.location}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteEvent(e.id)}
                      className="p-1 text-[#8A8E85] hover:text-rose-600 transition-colors"
                      aria-label={`Remove event ${e.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Task Queues Card (Preserves existing tests looking for "Task Queues" & Toggle task Weekly review) */}
          <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
              <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Task Queues
              </h2>

              <div className="flex items-center gap-2">
                <select
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                >
                  <option value="All Lists">All Lists</option>
                  {availableLists.map((list) => (
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

            <div className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
              {filteredTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8A8E85]">
                  No tasks found in this view. Click "Add Task" to create one.
                </div>
              ) : (
                filteredTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    isFocused={focusRecord?.id === t.id}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: TODAY FOCUS WORKSPACE                                  */}
      {/* ============================================================== */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          {/* Quick Task Capture for Today */}
          <TaskCreateCard
            defaultDueDate={today}
            defaultList="Inbox"
            placeholder="+ Add a task for today (Press Enter)..."
          />

          {/* Overdue Tasks Section (Highlighted with Amber/Rose) */}
          {overdueTasks.length > 0 && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-rose-200/80 dark:border-rose-900/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                    Overdue Tasks ({overdueTasks.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const ids = overdueTasks.map((t) => t.id);
                    bulkUpdateTasks(ids, { dueDate: today });
                  }}
                  className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reschedule all to Today</span>
                </button>
              </div>

              <div className="space-y-2">
                {overdueTasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </div>
          )}

          {/* Today's Scheduled Commitments (Events) */}
          {todayScheduledEvents.length > 0 && (
            <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                    Today's Schedule & Commitments ({todayScheduledEvents.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenDayDetails(today)}
                  className="text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                >
                  View Day Details →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {todayScheduledEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-2.5 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-3 text-xs"
                  >
                    <span
                      className="h-3 w-1.5 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: ev.color || '#3D5240' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                        {ev.title}
                      </div>
                      <div className="text-[11px] font-mono text-[#8A8E85]">
                        {ev.allDay ? 'All Day' : `${ev.startTime} – ${ev.endTime}`}
                      </div>
                      {ev.location && (
                        <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Active Tasks */}
          <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2.5">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                  Today's Tasks ({todayTasks.length})
                </h2>
              </div>
              <span className="text-[11px] text-[#8A8E85]">
                {todayTasks.length === 0 ? 'All caught up' : `${todayTasks.length} pending`}
              </span>
            </div>

            <div className="space-y-2">
              {todayTasks.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <div className="text-lg">🎉</div>
                  <p className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                    All caught up for today!
                  </p>
                  <p className="text-[11px] text-[#8A8E85]">
                    No pending tasks due today. Use the card above to schedule more.
                  </p>
                </div>
              ) : (
                todayTasks.map((t) => <TaskRow key={t.id} task={t} />)
              )}
            </div>
          </div>

          {/* Completed Today (Collapsible) */}
          {todayCompletedTasks.length > 0 && (
            <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2.5 text-xs">
                <span className="font-bold text-[#6B7067] dark:text-[#A6AB9F] uppercase tracking-wider">
                  Completed Today ({todayCompletedTasks.length})
                </span>
                <span className="text-[11px] text-[#8A8E85]">
                  Click checkmark to reopen
                </span>
              </div>
              <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
                {todayCompletedTasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 3: UPCOMING TIMELINE WORKSPACE                            */}
      {/* ============================================================== */}
      {activeTab === 'upcoming' && (
        <div className="space-y-6">
          <TaskCreateCard
            defaultDueDate={tomorrow}
            placeholder="+ Add an upcoming task..."
          />

          {/* Tomorrow */}
          <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                Tomorrow ({tomorrowTasks.length})
              </h2>
              <span className="text-[11px] text-[#8A8E85] font-mono">{tomorrow}</span>
            </div>
            <div className="space-y-2">
              {tomorrowTasks.length === 0 ? (
                <p className="py-3 text-xs text-[#8A8E85] text-center">No tasks scheduled for tomorrow.</p>
              ) : (
                tomorrowTasks.map((t) => <TaskRow key={t.id} task={t} />)
              )}
            </div>
          </div>

          {/* Next 7 Days */}
          <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                This Week ({thisWeekTasks.length})
              </h2>
              <span className="text-[11px] text-[#8A8E85]">Next 7 days</span>
            </div>
            <div className="space-y-2">
              {thisWeekTasks.length === 0 ? (
                <p className="py-3 text-xs text-[#8A8E85] text-center">No tasks scheduled for the rest of this week.</p>
              ) : (
                thisWeekTasks.map((t) => <TaskRow key={t.id} task={t} />)
              )}
            </div>
          </div>

          {/* Later */}
          <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                Later & Future ({laterTasks.length})
              </h2>
            </div>
            <div className="space-y-2">
              {laterTasks.length === 0 ? (
                <p className="py-3 text-xs text-[#8A8E85] text-center">No tasks scheduled further out.</p>
              ) : (
                laterTasks.map((t) => <TaskRow key={t.id} task={t} />)
              )}
            </div>
          </div>

          {/* Unscheduled */}
          {unscheduledTasks.length > 0 && (
            <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6]">
                  Unscheduled / Someday ({unscheduledTasks.length})
                </h2>
              </div>
              <div className="space-y-2">
                {unscheduledTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 4: ALL TASKS MASTER DATABASE & BULK OPERATIONS            */}
      {/* ============================================================== */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          <TaskCreateCard placeholder="+ Create and organize a task..." />

          {/* Search, Filter & Sort Controls */}
          <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8A8E85]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks by title, list, notes..."
                  className="w-full rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] pl-8 pr-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:ring-2 focus:ring-[#526B55]"
                />
              </div>

              {/* Select all toggle button */}
              <button
                type="button"
                onClick={() => handleSelectAllFiltered(filteredTasks)}
                className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] transition-colors self-start sm:self-auto shrink-0"
              >
                {selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            {/* Filter Dropdowns & Sorting Row */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#DFE1D9]/60 dark:border-[#383D35]/60 text-xs">
              {/* List filter */}
              <select
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value)}
                className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
              >
                <option value="All Lists">All Lists</option>
                {availableLists.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
              >
                <option value="All Status">All Status</option>
                <option value="Active">Active Only</option>
                <option value="Completed">Completed Only</option>
              </select>

              {/* Priority filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2.5 py-1 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
              >
                <option value="All Priorities">All Priorities</option>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              {/* Sort selector */}
              <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[#8A8E85]">
                <ArrowUpDown className="h-3 w-3" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                >
                  <option value="due_asc">Due Date (Earliest)</option>
                  <option value="due_desc">Due Date (Latest)</option>
                  <option value="priority">Priority (High to Low)</option>
                  <option value="title">Title (A-Z)</option>
                  <option value="created">Recently Created</option>
                </select>
              </div>
            </div>

            {/* Bulk Action Floating Bar */}
            {selectedTaskIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#3D5240] text-white text-xs font-semibold animate-in fade-in duration-150">
                <span>{selectedTaskIds.size} tasks selected</span>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBulkComplete}
                    className="rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 transition-colors"
                  >
                    Mark Done
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkReschedule(today)}
                    className="rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 transition-colors"
                  >
                    → Today
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBulkReschedule(tomorrow)}
                    className="rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1 transition-colors"
                  >
                    → Tomorrow
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="rounded-lg bg-rose-600 hover:bg-rose-700 px-2.5 py-1 text-white transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Task Rows */}
          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-8 text-center text-xs text-[#8A8E85]">
                No tasks match your filters. Click "Add Task" or adjust filters.
              </div>
            ) : (
              filteredTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  selectable={true}
                  isSelected={selectedTaskIds.has(t.id)}
                  onToggleSelect={handleToggleSelectTask}
                  isFocused={focusRecord?.id === t.id}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 5: CUSTOM LISTS WORKSPACE                                 */}
      {/* ============================================================== */}
      {activeTab === 'lists' && (
        <div className="space-y-6">
          {/* List Selector Pills */}
          <div className="flex items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {availableLists.map((listName) => {
                const count = tasks.filter((t) => t.list === listName && t.status !== 'completed').length;
                const isSelected = selectedListName === listName;
                const custom = prefs.customTaskLists?.find((l) => l.name === listName);
                const dotColor = custom?.color || TASK_LIST_METADATA[listName as DefaultTaskListType]?.dotColor || 'bg-emerald-500';

                return (
                  <button
                    key={listName}
                    type="button"
                    onClick={() => setSelectedTaskList(listName)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                      isSelected
                        ? 'bg-[#3D5240] text-white dark:bg-[#526B55]'
                        : 'bg-white dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0]'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${typeof dotColor === 'string' && dotColor.startsWith('bg-') ? dotColor : ''}`}
                      style={dotColor.startsWith('#') ? { backgroundColor: dotColor } : undefined}
                    />
                    <span>{listName}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[#F0F1EB] dark:bg-[#292D27] text-[#8A8E85]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsCreateListModalOpen(true)}
              className="flex items-center gap-1 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] transition-colors shrink-0 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New List</span>
            </button>
          </div>

          {/* Selected List Header Card */}
          <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="h-4 w-4 rounded-full"
                style={{
                  backgroundColor:
                    selectedListCustomMeta?.color ||
                    (TASK_LIST_METADATA[selectedListName as DefaultTaskListType] ? undefined : '#3B82F6'),
                }}
              />
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#252821] dark:text-[#ECEDE6]">
                  {selectedListName}
                </h2>
                <p className="text-xs text-[#8A8E85]">
                  {selectedListActiveTasks.length} active · {selectedListCompletedTasks.length} completed
                </p>
              </div>
            </div>

            {/* List Actions (Rename, Delete for custom lists) */}
            {selectedListCustomMeta && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditListModalOpen(true)}
                  className="flex items-center gap-1 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-2.5 py-1 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0]"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDeleteListModalOpen(true)}
                  className="flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Delete List</span>
                </button>
              </div>
            )}
          </div>

          {/* Inline task creator for this list */}
          <TaskCreateCard
            defaultList={selectedListName as TaskListType}
            placeholder={`+ Add a task to ${selectedListName}...`}
          />

          {/* Tasks in List */}
          <div className="space-y-4">
            <div className="space-y-2">
              {selectedListActiveTasks.length === 0 ? (
                <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-8 text-center text-xs text-[#8A8E85]">
                  No active tasks in {selectedListName}. Add one above.
                </div>
              ) : (
                selectedListActiveTasks.map((t) => <TaskRow key={t.id} task={t} />)
              )}
            </div>

            {selectedListCompletedTasks.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A8E85]">
                  Completed ({selectedListCompletedTasks.length})
                </h3>
                {selectedListCompletedTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODALS                                                         */}
      {/* ============================================================== */}

      {/* Add Task Modal with Progressive Disclosure */}
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
                type="button"
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
                    {availableLists.map((list) => (
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
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Repeats
                  </label>
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

      {/* Schedule Event Modal (With Multi-day & Color support) */}
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
                type="button"
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="modal-all-day"
                  checked={eventAllDay}
                  onChange={(e) => setEventAllDay(e.target.checked)}
                  className="rounded border-[#DFE1D9] text-[#3D5240] focus:ring-[#526B55]"
                />
                <label htmlFor="modal-all-day" className="text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] cursor-pointer">
                  All-day event
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
                      placeholder="10:30 AM"
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                      className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Conference Room B, Online..."
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1.5">
                  Timeline Ribbon Color
                </label>
                <div className="flex items-center gap-2">
                  {['#3D5240', '#2B4C7E', '#7E2B4C', '#B45309', '#6B21A8', '#047857'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setEventColor(col)}
                      style={{ backgroundColor: col }}
                      className={`h-6 w-6 rounded-full transition-transform ${
                        eventColor === col ? 'ring-2 ring-offset-2 ring-[#252821] dark:ring-white scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Schedule Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      {isDayDetailsOpen && (
        <DayDetailsModal
          dateKey={modalDateKey}
          onClose={() => setIsDayDetailsOpen(false)}
          onDateChange={(newKey) => {
            setModalDateKey(newKey);
            setSelectedDateKey(newKey);
            setLastSelectedDate(newKey);
            const [y, m] = newKey.split('-').map(Number);
            setViewDate({ y, m: m - 1 });
          }}
        />
      )}

      {/* Create Custom List Modal */}
      <CreateListModal
        isOpen={isCreateListModalOpen}
        onClose={() => setIsCreateListModalOpen(false)}
      />

      {/* Edit Custom List Modal */}
      {selectedListCustomMeta && (
        <CreateListModal
          isOpen={isEditListModalOpen}
          onClose={() => setIsEditListModalOpen(false)}
          existingList={selectedListCustomMeta}
        />
      )}

      {/* Safe Delete Custom List Modal */}
      <DeleteListModal
        isOpen={isDeleteListModalOpen}
        onClose={() => setIsDeleteListModalOpen(false)}
        listName={selectedListName}
      />
    </div>
  );
};
