import React, { useState } from 'react';
import {
  Plus,
  Flame,
  Target,
  Check,
  Calendar,
  Trash2,
  Edit2,
  Sparkles,
  CheckCircle2,
  Circle,
  TrendingUp,
  Clock,
  Layers,
  ChevronRight,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { currentWeek, todayKey } from '../../lib/dates';
import { GoalCategory, GOAL_CATEGORIES, Goal, Habit } from '../../types';

export const GoalsHabitsView: React.FC = () => {
  const {
    habits,
    goals,
    toggleHabitCheckin,
    incrementGoal,
    addGoal,
    updateGoal,
    deleteGoal,
    addHabit,
    updateHabit,
    deleteHabit,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'habits' | 'goals'>('all');
  const [isNewHabitOpen, setIsNewHabitOpen] = useState(false);
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // New Habit form
  const [habitName, setHabitName] = useState('');
  const [habitCat, setHabitCat] = useState('Mindfulness');

  // New Goal form
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalCat, setGoalCat] = useState<GoalCategory>('FINANCE');
  const [goalCurrent, setGoalCurrent] = useState('0');
  const [goalTarget, setGoalTarget] = useState('100');
  const [goalUnit, setGoalUnit] = useState('₹');
  const [goalDate, setGoalDate] = useState(`${new Date().getFullYear()}-12-31`);

  // Current real date & 7-day week (Mon-Sun)
  const today = todayKey();
  const weekDays = currentWeek();

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;
    addHabit({
      name: habitName.trim(),
      category: habitCat,
    });
    setHabitName('');
    setIsNewHabitOpen(false);
  };

  const handleUpdateHabitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHabit || !editingHabit.name.trim()) return;
    updateHabit(editingHabit.id, {
      name: editingHabit.name.trim(),
      category: editingHabit.category,
    });
    setEditingHabit(null);
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    addGoal({
      title: goalTitle.trim(),
      description: goalDesc.trim() || undefined,
      category: goalCat,
      current: parseFloat(goalCurrent) || 0,
      target: parseFloat(goalTarget) || 100,
      unit: goalUnit.trim() || 'units',
      targetDate: goalDate,
      completed: false,
    });
    setGoalTitle('');
    setGoalDesc('');
    setIsNewGoalOpen(false);
  };

  const handleUpdateGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editingGoal.title.trim()) return;
    updateGoal(editingGoal.id, {
      title: editingGoal.title.trim(),
      description: editingGoal.description?.trim(),
      category: editingGoal.category,
      current: editingGoal.current,
      target: editingGoal.target,
      unit: editingGoal.unit,
      targetDate: editingGoal.targetDate,
      completed: editingGoal.completed,
    });
    setEditingGoal(null);
  };

  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => !!g.completed);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-3 sm:px-4">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
            Goals & Habit Check-ins
          </h1>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Daily practices and long-term milestones aligned with your personal growth
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Section view switcher */}
          <div className="flex rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                activeTab === 'all'
                  ? 'bg-[#252821] dark:bg-[#526B55] text-white shadow-xs'
                  : 'text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('habits')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                activeTab === 'habits'
                  ? 'bg-[#252821] dark:bg-[#526B55] text-white shadow-xs'
                  : 'text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
              }`}
            >
              Habits ({habits.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('goals')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                activeTab === 'goals'
                  ? 'bg-[#252821] dark:bg-[#526B55] text-white shadow-xs'
                  : 'text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
              }`}
            >
              Goals ({goals.length})
            </button>
          </div>

          {/* Action buttons */}
          <button
            type="button"
            onClick={() => setIsNewHabitOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Habit</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNewGoalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Set Goal</span>
          </button>
        </div>
      </div>

      {/* 1. HABITS SECTION */}
      {(activeTab === 'all' || activeTab === 'habits') && (
        <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔥</span>
              <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Daily Habits & 7-Day Tracker
              </h2>
            </div>
            <span className="text-[11px] text-[#8A8E85]">
              Tap any date circle to check in. Calm, non-punitive consistency.
            </span>
          </div>

          {habits.length === 0 ? (
            <div className="p-8 text-center space-y-3 rounded-xl border border-dashed border-[#DFE1D9] dark:border-[#383D35]">
              <p className="text-xs text-[#8A8E85]">No habits configured yet.</p>
              <button
                type="button"
                onClick={() => setIsNewHabitOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Your First Habit</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop 7-Day Table View (hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-[#8A8E85] font-semibold border-b border-[#DFE1D9]/60 dark:border-[#383D35]/60">
                      <th className="py-2.5 px-3 min-w-[200px]">Habit</th>
                      <th className="py-2.5 px-3 text-center w-28">Current Streak</th>
                      {weekDays.map((d) => {
                        const isDayToday = d.dateKey === today;
                        return (
                          <th
                            key={d.dateKey}
                            className={`py-2 px-2 text-center ${
                              isDayToday ? 'bg-[#526B55]/10 rounded-t-lg' : ''
                            }`}
                          >
                            <div className="text-[10px] uppercase font-bold text-[#6B7067] dark:text-[#A6AB9F]">
                              {d.dayLetter}
                            </div>
                            <div className="text-xs font-mono font-bold text-[#252821] dark:text-[#ECEDE6]">
                              {d.dateNum}
                            </div>
                          </th>
                        );
                      })}
                      <th className="py-2.5 px-3 text-right w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
                    {habits.map((h) => (
                      <tr
                        key={h.id}
                        className="hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors group"
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#252821] dark:text-[#ECEDE6]">
                            {h.name}
                          </div>
                          <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                            {h.category}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded bg-[#F5F5F0] dark:bg-[#181A17] border border-[#DFE1D9] dark:border-[#383D35] px-2 py-0.5 text-[11px] font-bold text-[#526B55] dark:text-[#A8BDA1]">
                            <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
                            <span>{h.streak}d</span>
                          </span>
                        </td>
                        {weekDays.map((d) => {
                          const isDone = !!h.checkins[d.dateKey];
                          const isDayToday = d.dateKey === today;
                          return (
                            <td
                              key={d.dateKey}
                              className={`py-3 px-2 text-center ${
                                isDayToday ? 'bg-[#526B55]/5' : ''
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleHabitCheckin(h.id, d.dateKey)}
                                aria-label={`Toggle ${h.name} for ${d.dateKey}`}
                                className={`h-7 w-7 rounded-lg border flex items-center justify-center transition-all mx-auto ${
                                  isDone
                                    ? 'bg-[#3D5240] dark:bg-[#526B55] border-[#3D5240] dark:border-[#526B55] text-white shadow-xs'
                                    : 'border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] text-transparent hover:border-[#526B55]'
                                }`}
                              >
                                <Check className="h-4 w-4 stroke-[3]" />
                              </button>
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => setEditingHabit(h)}
                              aria-label={`Edit habit ${h.name}`}
                              className="p-1 text-[#8A8E85] hover:text-[#526B55] transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteHabit(h.id)}
                              aria-label={`Delete habit ${h.name}`}
                              className="p-1 text-[#8A8E85] hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Cards (fixes horizontal overflow and disappearing columns) */}
              <div className="block md:hidden space-y-3">
                {habits.map((h) => {
                  const isDoneToday = !!h.checkins[today];
                  return (
                    <div
                      key={h.id}
                      className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F9F9F6] dark:bg-[#1A1C19] p-3.5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-[#252821] dark:text-[#ECEDE6]">
                            {h.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#6B7067] dark:text-[#A6AB9F]">
                            <span>{h.category}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5 font-bold text-[#526B55] dark:text-[#A8BDA1]">
                              <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
                              <span>{h.streak}d streak</span>
                            </span>
                          </div>
                        </div>

                        {/* Today's 1-Tap Check-in button */}
                        <button
                          type="button"
                          onClick={() => toggleHabitCheckin(h.id, today)}
                          aria-label={`Quick check-in ${h.name} for today`}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isDoneToday
                              ? 'bg-[#3D5240] dark:bg-[#526B55] text-white shadow-xs'
                              : 'bg-white dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] text-[#252821] dark:text-[#ECEDE6]'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{isDoneToday ? 'Done Today' : 'Check In'}</span>
                        </button>
                      </div>

                      {/* 7-day progress circles that fit easily on mobile width */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#DFE1D9]/60 dark:border-[#383D35]/60">
                        {weekDays.map((d) => {
                          const done = !!h.checkins[d.dateKey];
                          const isDayToday = d.dateKey === today;
                          return (
                            <button
                              key={d.dateKey}
                              type="button"
                              onClick={() => toggleHabitCheckin(h.id, d.dateKey)}
                              aria-label={`Mobile check-in ${h.name} on ${d.dateKey}`}
                              className="flex flex-col items-center gap-1"
                            >
                              <span className="text-[9px] font-bold text-[#8A8E85]">
                                {d.dayLetter}
                              </span>
                              <div
                                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  done
                                    ? 'bg-[#3D5240] dark:bg-[#526B55] text-white'
                                    : isDayToday
                                    ? 'border-2 border-[#526B55] text-[#526B55]'
                                    : 'border border-[#DFE1D9] dark:border-[#383D35] text-[#8A8E85]'
                                }`}
                              >
                                {done ? <Check className="h-3 w-3" /> : d.dateNum}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Mobile Actions: Edit / Delete */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#DFE1D9]/40 dark:border-[#383D35]/40 text-xs text-[#8A8E85]">
                        <button
                          type="button"
                          onClick={() => setEditingHabit(h)}
                          className="hover:text-[#526B55] flex items-center gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => deleteHabit(h.id)}
                          className="hover:text-rose-600 flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. GOALS SECTION */}
      {(activeTab === 'all' || activeTab === 'goals') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
              <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Milestone Goals ({activeGoals.length} In Progress)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsNewGoalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Goal</span>
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="p-8 text-center space-y-3 rounded-2xl border border-dashed border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F]">
              <Target className="h-8 w-8 text-[#8A8E85] mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                  No long-term goals set yet
                </h3>
                <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F] pt-1">
                  Define outcomes you are working towards (e.g. savings targets, reading milestones, project launches).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewGoalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] text-xs font-bold text-white shadow-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Goal</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeGoals.map((goal) => {
                const pct = Math.min(100, Math.round((goal.current / Math.max(1, goal.target)) * 100));
                return (
                  <div
                    key={goal.id}
                    className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-5 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8E85]">
                          {goal.category}
                        </span>
                        <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                          {goal.title}
                        </h3>
                        {goal.description && (
                          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F] line-clamp-2 pt-0.5">
                            {goal.description}
                          </p>
                        )}
                      </div>

                      {/* Incremental Adjusters */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => incrementGoal(goal.id, goal.target >= 1000 ? Math.round(goal.target / 10) : 1)}
                          aria-label="Increment goal progress"
                          className="flex items-center justify-center rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#292D27] px-2.5 py-1 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#ECEDE7] active:scale-95 transition-all shadow-xs"
                          title={goal.target >= 1000 ? `Increment by ${Math.round(goal.target / 10).toLocaleString()}` : 'Increment +1'}
                        >
                          {goal.target >= 1000 ? `+${Math.round(goal.target / 10).toLocaleString()}` : '+1'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-[#252821] dark:text-[#ECEDE6]">
                        {goal.current.toLocaleString()} / {goal.target.toLocaleString()} {goal.unit}
                      </span>
                      <span className="font-bold text-[#3D5240] dark:text-[#A8BDA1]">
                        {pct}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 w-full rounded-full bg-[#ECEDE7] dark:bg-[#292D27] overflow-hidden">
                      <div
                        className="h-full bg-[#3D5240] dark:bg-[#526B55] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#8A8E85] pt-1 border-t border-[#DFE1D9]/40 dark:border-[#383D35]/40">
                      <span>Target due: {goal.targetDate || 'No date set'}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateGoal(goal.id, { completed: true })}
                          aria-label="Mark goal completed"
                          className="hover:text-[#526B55] flex items-center gap-1 font-semibold text-[11px]"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Complete</span>
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => setEditingGoal(goal)}
                          aria-label={`Edit goal ${goal.title}`}
                          className="hover:text-[#526B55]"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => deleteGoal(goal.id)}
                          aria-label={`Delete goal ${goal.title}`}
                          className="hover:text-rose-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed Goals Accordion */}
          {completedGoals.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A8E85] mb-2">
                Completed Milestones ({completedGoals.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-75">
                {completedGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="p-3.5 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1] shrink-0" />
                      <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] line-through truncate">
                        {goal.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateGoal(goal.id, { completed: false })}
                      className="text-[11px] text-[#526B55] dark:text-[#A8BDA1] font-semibold hover:underline"
                    >
                      Reopen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {/* 1. New Habit Modal */}
      {isNewHabitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New Habit"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Create Daily Habit
              </h3>
              <button
                type="button"
                onClick={() => setIsNewHabitOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateHabit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Habit Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Breathwork (10m)"
                  value={habitName}
                  onChange={(e) => setHabitName(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Category
                </label>
                <select
                  value={habitCat}
                  onChange={(e) => setHabitCat(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                >
                  <option value="Mindfulness">Mindfulness</option>
                  <option value="Fitness">Fitness</option>
                  <option value="Focus">Focus</option>
                  <option value="Health">Health</option>
                  <option value="Study">Study</option>
                  <option value="Creativity">Creativity</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewHabitOpen(false)}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white transition-colors"
                >
                  Save Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Habit Modal */}
      {editingHabit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit Habit"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Edit Habit
              </h3>
              <button
                type="button"
                onClick={() => setEditingHabit(null)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleUpdateHabitSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Habit Name
                </label>
                <input
                  type="text"
                  required
                  value={editingHabit.name}
                  onChange={(e) => setEditingHabit({ ...editingHabit, name: e.target.value })}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Category
                </label>
                <select
                  value={editingHabit.category}
                  onChange={(e) => setEditingHabit({ ...editingHabit, category: e.target.value })}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                >
                  <option value="Mindfulness">Mindfulness</option>
                  <option value="Fitness">Fitness</option>
                  <option value="Focus">Focus</option>
                  <option value="Health">Health</option>
                  <option value="Study">Study</option>
                  <option value="Creativity">Creativity</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingHabit(null)}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. New Goal Modal */}
      {isNewGoalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Set Milestone Goal"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Set Long-Term Goal
              </h3>
              <button
                type="button"
                onClick={() => setIsNewGoalOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Goal Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Save Emergency Fund, Read 24 Books"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Category
                </label>
                <select
                  value={goalCat}
                  onChange={(e) => setGoalCat(e.target.value as GoalCategory)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                >
                  {GOAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Current
                  </label>
                  <input
                    type="number"
                    value={goalCurrent}
                    onChange={(e) => setGoalCurrent(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Target
                  </label>
                  <input
                    type="number"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={goalUnit}
                    onChange={(e) => setGoalUnit(e.target.value)}
                    placeholder="e.g. ₹, km, books"
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewGoalOpen(false)}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white transition-colors"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit Goal"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Edit Goal
              </h3>
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleUpdateGoalSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  required
                  value={editingGoal.title}
                  onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Current Progress
                  </label>
                  <input
                    type="number"
                    value={editingGoal.current}
                    onChange={(e) => setEditingGoal({ ...editingGoal, current: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Target
                  </label>
                  <input
                    type="number"
                    value={editingGoal.target}
                    onChange={(e) => setEditingGoal({ ...editingGoal, target: parseFloat(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={editingGoal.targetDate || ''}
                  onChange={(e) => setEditingGoal({ ...editingGoal, targetDate: e.target.value })}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
