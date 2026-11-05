import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Repeat,
  FileText,
  Trash2,
  Calendar,
  MoreVertical,
  ChevronDown,
} from 'lucide-react';
import { Task, TaskPriority, TASK_LIST_METADATA, DefaultTaskListType } from '../../types';
import { todayKey, shiftDayKey, formatReadableDate } from '../../lib/dates';
import { useApp } from '../../context/AppContext';

interface TaskRowProps {
  task: Task;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectable?: boolean;
  isFocused?: boolean;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  isSelected = false,
  onToggleSelect,
  selectable = false,
  isFocused = false,
}) => {
  const {
    toggleTaskStatus,
    updateTask,
    deleteTask,
    notes,
    setSelectedNoteId,
    setActiveModule,
  } = useApp();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [showReschedule, setShowReschedule] = useState(false);

  const isDone = task.status === 'completed';
  const today = todayKey();
  const isOverdue = !isDone && Boolean(task.dueDate) && task.dueDate < today;
  const isDueToday = Boolean(task.dueDate) && task.dueDate === today;
  const isDueTomorrow = Boolean(task.dueDate) && task.dueDate === shiftDayKey(today, 1);

  const handleTitleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== task.title) {
      updateTask({ ...task, title: trimmed });
    } else {
      setEditedTitle(task.title);
    }
    setIsEditingTitle(false);
  };

  const cyclePriority = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cycleMap: Record<TaskPriority, TaskPriority> = {
      LOW: 'MEDIUM',
      MEDIUM: 'HIGH',
      HIGH: 'LOW',
    };
    updateTask({ ...task, priority: cycleMap[task.priority] });
  };

  const handleReschedule = (newDate: string) => {
    updateTask({ ...task, dueDate: newDate });
    setShowReschedule(false);
  };

  const listMeta = TASK_LIST_METADATA[task.list as DefaultTaskListType] || {
    label: task.list,
    dotColor: 'bg-emerald-500',
  };

  return (
    <div
      data-record-id={task.id}
      className={`group relative flex items-start sm:items-center justify-between gap-3 py-2.5 px-3 rounded-xl transition-all border ${
        isFocused
          ? 'ring-2 ring-[#526B55] bg-[#F5F5F0] dark:bg-[#292D27] border-transparent'
          : isSelected
          ? 'bg-[#E8EEE6]/60 dark:bg-[#303B2E]/60 border-[#526B55]'
          : 'bg-[#FFFFFF] dark:bg-[#20231F] border-[#DFE1D9]/70 dark:border-[#383D35]/70 hover:bg-[#F9FAF8] dark:hover:bg-[#262A24]'
      }`}
    >
      {/* Left: Checkbox, Completion toggle & Info */}
      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* Bulk select checkbox */}
        {selectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect?.(task.id)}
            aria-label={`Select task ${task.title}`}
            className="mt-1 sm:mt-0 h-4 w-4 rounded border-[#DFE1D9] text-[#3D5240] focus:ring-[#526B55] cursor-pointer"
          />
        )}

        {/* Completion Toggle */}
        <button
          type="button"
          onClick={() => toggleTaskStatus(task.id)}
          aria-label={`Toggle task ${task.title}`}
          className="mt-0.5 sm:mt-0 shrink-0 text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#526B55] dark:hover:text-[#A8BDA1] transition-transform active:scale-95"
        >
          {isDone ? (
            <CheckCircle2 className="h-4 sm:h-5 w-4 sm:w-5 text-[#477653] dark:text-[#91B594]" />
          ) : (
            <Circle className="h-4 sm:h-5 w-4 sm:w-5" />
          )}
        </button>

        {/* Content details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {isEditingTitle ? (
              <form onSubmit={handleTitleSubmit} className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={() => handleTitleSubmit()}
                  autoFocus
                  className="w-full text-xs font-bold rounded border border-[#526B55] bg-white dark:bg-[#181A17] px-2 py-0.5 text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </form>
            ) : (
              <span
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
                className={`text-xs sm:text-sm font-semibold truncate cursor-pointer hover:underline ${
                  isDone
                    ? 'line-through text-[#8A8E85] dark:text-[#858B7E]'
                    : 'text-[#252821] dark:text-[#ECEDE6]'
                }`}
              >
                {task.title}
              </span>
            )}

            {/* Linked note badge */}
            {task.linkedNoteId && notes.some((n) => n.id === task.linkedNoteId) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNoteId(task.linkedNoteId!);
                  setActiveModule('notes');
                }}
                className="inline-flex items-center gap-1 rounded bg-[#E8EEE6] dark:bg-[#2A3428] px-1.5 py-0.5 text-[10px] font-semibold text-[#3D5240] dark:text-[#A8BDA1] hover:underline"
                aria-label={`Open linked note ${notes.find((n) => n.id === task.linkedNoteId)?.title}`}
              >
                <FileText className="h-3 w-3" />
                <span className="max-w-[120px] truncate">
                  {notes.find((n) => n.id === task.linkedNoteId)?.title}
                </span>
              </button>
            )}
          </div>

          {/* Description preview if present */}
          {task.description && !isEditingTitle && (
            <p className="text-[11px] text-[#8A8E85] line-clamp-1 mt-0.5">
              {task.description}
            </p>
          )}

          {/* Metadata badges row */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-[#8A8E85]">
            {/* List indicator */}
            <div className="flex items-center gap-1 font-medium text-[#6B7067] dark:text-[#A6AB9F]">
              <span className={`h-1.5 w-1.5 rounded-full ${listMeta.dotColor}`} />
              <span>{task.list}</span>
            </div>

            {/* Due date badge with Overdue warning */}
            {task.dueDate && (
              <div
                className={`flex items-center gap-1 font-medium ${
                  isOverdue
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : isDueToday
                    ? 'text-[#3D5240] dark:text-[#A8BDA1] font-bold'
                    : 'text-[#8A8E85]'
                }`}
              >
                <Calendar className="h-3 w-3" />
                <span>
                  {isOverdue
                    ? `Overdue (${task.dueDate})`
                    : isDueToday
                    ? 'Today'
                    : isDueTomorrow
                    ? 'Tomorrow'
                    : task.dueDate}
                </span>
                {isOverdue && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReschedule(today);
                    }}
                    className="ml-1 text-[10px] text-rose-700 dark:text-rose-300 underline hover:text-rose-900"
                    title="Reschedule to Today"
                  >
                    → Today
                  </button>
                )}
              </div>
            )}

            {/* Due time */}
            {task.dueTime && (
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <Clock className="h-3 w-3" />
                <span>{task.dueTime}</span>
              </div>
            )}

            {/* Recurrence */}
            {task.recurrence && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#526B55] dark:text-[#A8BDA1] bg-[#E8EEE6]/60 dark:bg-[#303B2E]/60 px-1.5 py-0.2 rounded">
                <Repeat className="h-2.5 w-2.5" />
                <span className="capitalize">{task.recurrence}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Quick Priority, Reschedule & Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-start sm:self-center">
        {/* Priority chip (Clickable to cycle) */}
        <button
          type="button"
          onClick={cyclePriority}
          title="Click to cycle priority (Low → Medium → High)"
          className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase transition-colors ${
            task.priority === 'HIGH'
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-200'
              : task.priority === 'MEDIUM'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-200'
              : 'bg-[#F0F1EB] text-[#6B7067] dark:bg-[#292D27] dark:text-[#A6AB9F] hover:bg-[#E5E6DF]'
          }`}
        >
          {task.priority}
        </button>

        {/* Quick Reschedule dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReschedule(!showReschedule)}
            title="Reschedule task"
            aria-label={`Reschedule task ${task.title}`}
            className="p-1 rounded-lg text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" />
          </button>

          {showReschedule && (
            <div className="absolute right-0 top-7 z-30 w-36 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] shadow-lg p-1 text-xs space-y-0.5 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => handleReschedule(today)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] font-medium"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleReschedule(shiftDayKey(today, 1))}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] font-medium"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => handleReschedule(shiftDayKey(today, 7))}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] font-medium"
              >
                Next Week (+7d)
              </button>
              <button
                type="button"
                onClick={() => handleReschedule('')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium"
              >
                No Due Date
              </button>
            </div>
          )}
        </div>

        {/* Delete task */}
        <button
          type="button"
          onClick={() => deleteTask(task.id)}
          aria-label="Delete task"
          title="Delete task"
          className="p-1 rounded-lg text-[#8A8E85] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors opacity-80 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
