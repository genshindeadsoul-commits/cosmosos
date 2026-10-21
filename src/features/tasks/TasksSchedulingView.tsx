import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Clock,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskListType, TaskPriority, TaskStatus } from '../../types';
import { todayLocal } from '../../lib/recurrence';

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
  } = useApp();

  // Scroll the record chosen in Search/Calendar into view, highlight it briefly, then clear.
  React.useEffect(() => {
    if (!focusRecord) return;
    document.querySelector(`[data-record-id="${focusRecord.id}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => setFocusRecord(null), 3000);
    return () => clearTimeout(t);
  }, [focusRecord, setFocusRecord]);

  const [listFilter, setListFilter] = useState<string>('All Lists');
  const [statusFilter, setStatusFilter] = useState<string>('All Status');

  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isScheduleEventOpen, setIsScheduleEventOpen] = useState(false);

  // Add Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskList, setTaskList] = useState<TaskListType>('Work');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('HIGH');
  const [taskDueDate, setTaskDueDate] = useState(todayLocal());
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskRecurrence, setTaskRecurrence] = useState<'' | 'daily' | 'weekly' | 'monthly'>('');

  // Schedule Event form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState(todayLocal());
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventLocation, setEventLocation] = useState('');

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

  const handleScheduleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    addEvent({
      title: eventTitle.trim(),
      description: eventDesc.trim() || undefined,
      date: eventDate,
      startTime: eventStart,
      endTime: eventEnd,
      category: 'Work',
      location: eventLocation,
      source: 'local',
    });
    setEventTitle('');
    setEventDesc('');
    setIsScheduleEventOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header and Action Buttons matching Screenshot 3 */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
            Tasks & Scheduling
          </h1>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Complete agenda, calendar sync, and personal task queues
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsScheduleEventOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3.5 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] transition-colors"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>Schedule Event</span>
          </button>
          <button
            onClick={() => setIsAddTaskOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Scheduled Events Card matching Screenshot 3 */}
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
          {[...events].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).map((ev) => (
            <div
              key={ev.id}
              data-record-id={ev.id}
              className={`${focusRecord?.id === ev.id ? 'ring-2 ring-[#526B55] ' : ''}rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/40 dark:bg-[#181A17]/40 p-4 space-y-2 group`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                    {ev.title}
                  </h3>
                  <div className="text-xs text-[#6B7067] dark:text-[#A6AB9F] pt-0.5 font-mono">
                    {ev.startTime} - {ev.endTime} · {ev.date}
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
          ))}
        </div>
      </div>

      {/* Task Queues Card matching Screenshot 3 */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
          <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
            Task Queues
          </h2>

          {/* Filter Dropdowns matching Screenshot 3 */}
          <div className="flex items-center gap-2">
            <select
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
            >
              <option value="All Lists">All Lists</option>
              <option value="Inbox">Inbox</option>
              <option value="Work">Work</option>
              <option value="Study">Study</option>
              <option value="Health">Health</option>
              <option value="Personal">Personal</option>
              <option value="Holiday trip">Holiday trip</option>
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
                className={`${focusRecord?.id === t.id ? 'ring-2 ring-[#526B55] ' : ''}py-3 flex items-center justify-between hover:bg-[#F5F5F0]/40 dark:hover:bg-[#292D27]/40 px-2 rounded-lg transition-colors group`}
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
          }))}
        </div>
      </div>

      {/* Add Task Modal */}
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
                    <option value="Inbox">Inbox</option>
                    <option value="Work">Work</option>
                    <option value="Study">Study</option>
                    <option value="Health">Health</option>
                    <option value="Personal">Personal</option>
                    <option value="Holiday trip">Holiday trip</option>
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
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
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

      {/* Schedule Event Modal */}
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
                  placeholder="e.g. Design Team Meeting"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Start Time
                  </label>
                  <input
                    type="text"
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
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Location / Call Link
                </label>
                <input
                  type="text"
                  placeholder="e.g. Google Meet, Zoom, Office 3A"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
