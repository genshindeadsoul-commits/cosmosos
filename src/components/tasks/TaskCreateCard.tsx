import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronUp, Calendar, Clock, Repeat, Tag, Flag } from 'lucide-react';
import { TaskListType, TaskPriority, TASK_LISTS, TASK_PRIORITIES } from '../../types';
import { todayKey, shiftDayKey } from '../../lib/dates';
import { useApp } from '../../context/AppContext';
import { usePrefs } from '../../context/PrefsContext';

interface TaskCreateCardProps {
  defaultList?: TaskListType;
  defaultDueDate?: string;
  placeholder?: string;
  compact?: boolean;
}

export const TaskCreateCard: React.FC<TaskCreateCardProps> = ({
  defaultList = 'Inbox',
  defaultDueDate = todayKey(),
  placeholder = 'Add a new task... (Press Enter to save)',
  compact = false,
}) => {
  const { addTask } = useApp();
  const { prefs } = usePrefs();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [list, setList] = useState<TaskListType>(defaultList);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState<'' | 'daily' | 'weekly' | 'monthly'>('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setList(defaultList);
  }, [defaultList]);

  useEffect(() => {
    setDueDate(defaultDueDate);
  }, [defaultDueDate]);

  // Available lists: default + user custom lists
  const availableLists: string[] = [
    ...TASK_LISTS,
    ...(prefs.customTaskLists?.filter((l) => !l.archived).map((l) => l.name) ?? []),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    addTask({
      title: trimmed,
      description: description.trim() || undefined,
      list,
      priority,
      status: 'todo',
      dueDate: dueDate || todayKey(),
      dueTime: dueTime || undefined,
      recurrence: recurrence || undefined,
    });

    setTitle('');
    setDescription('');
    setDueTime('');
    setRecurrence('');
    if (!compact) {
      setIsExpanded(false);
    }
  };

  const today = todayKey();
  const tomorrow = shiftDayKey(today, 1);

  return (
    <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-xs p-3 transition-all focus-within:border-[#526B55] dark:focus-within:border-[#A8BDA1] focus-within:ring-1 focus-within:ring-[#526B55]">
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Main Title Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-xs sm:text-sm font-medium text-[#252821] dark:text-[#ECEDE6] placeholder-[#8A8E85] focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Fewer options' : 'More options (description, time, recurrence)'}
            className="rounded-lg p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] transition-colors"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <button
            type="submit"
            disabled={!title.trim()}
            className="flex items-center gap-1 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] dark:hover:bg-[#405541] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add</span>
          </button>
        </div>

        {/* Quick Chips Row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#DFE1D9]/50 dark:border-[#383D35]/50 text-xs">
          {/* Due date quick buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDueDate(today)}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                dueDate === today
                  ? 'bg-[#E8EEE6] dark:bg-[#303B2E] text-[#3D5240] dark:text-[#A8BDA1] font-bold'
                  : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDueDate(tomorrow)}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                dueDate === tomorrow
                  ? 'bg-[#E8EEE6] dark:bg-[#303B2E] text-[#3D5240] dark:text-[#A8BDA1] font-bold'
                  : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]'
              }`}
            >
              Tomorrow
            </button>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              title="Select custom due date"
              className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-transparent px-1.5 py-0.5 text-[10px] text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
            />
          </div>

          <span className="text-[#DFE1D9] dark:text-[#383D35]">|</span>

          {/* List Selector */}
          <select
            value={list}
            onChange={(e) => setList(e.target.value as TaskListType)}
            className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-transparent px-2 py-0.5 text-[11px] text-[#252821] dark:text-[#ECEDE6] focus:outline-none font-medium"
          >
            {availableLists.map((l) => (
              <option key={l} value={l} className="bg-white dark:bg-[#20231F]">
                {l}
              </option>
            ))}
          </select>

          {/* Priority Selector */}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className={`rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-transparent px-2 py-0.5 text-[11px] font-bold focus:outline-none ${
              priority === 'HIGH'
                ? 'text-rose-600'
                : priority === 'MEDIUM'
                ? 'text-amber-600'
                : 'text-[#6B7067] dark:text-[#A6AB9F]'
            }`}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p} className="bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6]">
                {p === 'LOW' ? 'Low Priority' : p === 'MEDIUM' ? 'Medium Priority' : 'High Priority'}
              </option>
            ))}
          </select>
        </div>

        {/* Progressive Disclosure: Advanced Options */}
        {isExpanded && (
          <div className="pt-2 border-t border-[#DFE1D9]/50 dark:border-[#383D35]/50 space-y-2 animate-in fade-in duration-150">
            <div>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add optional notes or descriptions..."
                className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 p-2 text-xs text-[#252821] dark:text-[#ECEDE6] placeholder-[#8A8E85] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[#8A8E85] uppercase mb-0.5">
                  Due Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10:00 AM"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 px-2 py-1 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8E85] uppercase mb-0.5">
                  Repeat
                </label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 px-2 py-1 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                >
                  <option value="">Never</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
