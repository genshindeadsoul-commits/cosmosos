import React, { useState } from 'react';
import {
  Plus,
  Flame,
  Target,
  Check,
  Calendar,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GoalCategory } from '../../types';

export const GoalsHabitsView: React.FC = () => {
  const {
    habits,
    goals,
    toggleHabitCheckin,
    incrementGoal,
    addGoal,
    addHabit,
    deleteGoal,
  } = useApp();

  const [isNewHabitOpen, setIsNewHabitOpen] = useState(false);
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);

  // New Habit form
  const [habitName, setHabitName] = useState('');
  const [habitCat, setHabitCat] = useState('Mindfulness');

  // New Goal form
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCat, setGoalCat] = useState<GoalCategory>('FINANCE');
  const [goalCurrent, setGoalCurrent] = useState('0');
  const [goalTarget, setGoalTarget] = useState('100');
  const [goalUnit, setGoalUnit] = useState('₹');
  const [goalDate, setGoalDate] = useState('2026-12-31');

  // 7-day window dates matching screenshot (Oct 12 to Oct 18)
  const daysOfWeek = [
    { dayLetter: 'M', dateNum: '12', dateKey: '2026-10-12' },
    { dayLetter: 'T', dateNum: '13', dateKey: '2026-10-13' },
    { dayLetter: 'W', dateNum: '14', dateKey: '2026-10-14' },
    { dayLetter: 'T', dateNum: '15', dateKey: '2026-10-15' },
    { dayLetter: 'F', dateNum: '16', dateKey: '2026-10-16' },
    { dayLetter: 'S', dateNum: '17', dateKey: '2026-10-17' },
    { dayLetter: 'S', dateNum: '18', dateKey: '2026-10-18' },
  ];

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

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    addGoal({
      title: goalTitle.trim(),
      category: goalCat,
      current: parseFloat(goalCurrent) || 0,
      target: parseFloat(goalTarget) || 100,
      unit: goalUnit.trim() || 'units',
      targetDate: goalDate,
      completed: false,
    });
    setGoalTitle('');
    setIsNewGoalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Title & Action Buttons matching Screenshot 5 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
            Goals & Habit Check-ins
          </h1>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Milestones and daily practices aligned with your personal growth
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewHabitOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3.5 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Habit</span>
          </button>
          <button
            onClick={() => setIsNewGoalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Set Goal</span>
          </button>
        </div>
      </div>

      {/* 7-Day Habit Tracker Card matching Screenshot 5 */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔥</span>
            <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
              7-Day Habit Tracker
            </h2>
          </div>
          <span className="text-[11px] text-[#8A8E85]">
            Click any date node to toggle completion
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[540px]">
            <thead>
              <tr className="text-[#8A8E85] font-semibold">
                <th className="py-2 px-3 w-64">Habit</th>
                <th className="py-2 px-3 text-center w-24">Streak</th>
                {daysOfWeek.map((d) => (
                  <th key={d.dateKey} className="py-2 px-2 text-center">
                    <div className="text-[10px] uppercase font-bold text-[#6B7067] dark:text-[#A6AB9F]">
                      {d.dayLetter}
                    </div>
                    <div className="text-xs font-mono text-[#252821] dark:text-[#ECEDE6]">
                      {d.dateNum}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
              {habits.map((h) => (
                <tr key={h.id} className="hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-[#252821] dark:text-[#ECEDE6]">
                      {h.name}
                    </div>
                    <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                      {h.category}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 text-[11px] font-bold text-orange-700 dark:text-orange-300">
                      <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
                      <span>{h.streak}d</span>
                    </span>
                  </td>
                  {daysOfWeek.map((d) => {
                    const isDone = !!h.checkins[d.dateKey];
                    return (
                      <td key={d.dateKey} className="py-3 px-2 text-center">
                        <button
                          onClick={() => toggleHabitCheckin(h.id, d.dateKey)}
                          aria-label={`Toggle ${h.name} for ${d.dateKey}`}
                          className={`h-7 w-7 rounded-lg border flex items-center justify-center transition-colors mx-auto ${
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Milestone Goals Section matching Screenshot 5 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
            <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
              Active Milestone Goals
            </h2>
          </div>
          <span className="text-xs text-[#8A8E85] font-mono">
            {goals.filter((g) => !g.completed).length} in progress
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
            return (
              <div
                key={goal.id}
                className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8E85]">
                      {goal.category}
                    </span>
                    <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                      {goal.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => incrementGoal(goal.id, goal.target >= 1000 ? Math.round(goal.target / 10) : 1)}
                    className="flex items-center justify-center rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#292D27] px-2.5 py-1 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#ECEDE7] active:scale-95 transition-all shadow-xs"
                    title={goal.target >= 1000 ? `Increment by ${Math.round(goal.target / 10).toLocaleString()}` : 'Increment +1'}
                  >
                    {goal.target >= 1000 ? `+${Math.round(goal.target / 10).toLocaleString()}` : '+1'}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#252821] dark:text-[#ECEDE6]">
                    {goal.current.toLocaleString()} / {goal.target.toLocaleString()} {goal.unit}
                  </span>
                  <span className="font-bold text-[#3D5240] dark:text-[#A8BDA1]">
                    {pct}%
                  </span>
                </div>

                {/* Progress bar matching Screenshot 5 */}
                <div className="h-2 w-full rounded-full bg-[#ECEDE7] dark:bg-[#292D27] overflow-hidden">
                  <div
                    className="h-full bg-[#3D5240] dark:bg-[#526B55] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#8A8E85]">
                  <span>Target due: {goal.targetDate}</span>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    aria-label="Delete goal"
                    className="hover:text-rose-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Habit Modal */}
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
                onClick={() => setIsNewHabitOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateHabit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Habit Name
                </label>
                <input
                  type="text"
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
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Save Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Goal Modal */}
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
                Set Milestone Goal
              </h3>
              <button
                onClick={() => setIsNewGoalOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Marathon Finish Time sub-4h"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Category
                  </label>
                  <select
                    value={goalCat}
                    onChange={(e) => setGoalCat(e.target.value as GoalCategory)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  >
                    <option value="FINANCE">Finance</option>
                    <option value="LEARNING">Learning</option>
                    <option value="FITNESS">Fitness</option>
                    <option value="PROJECTS">Projects</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₹, books, lbs"
                    value={goalUnit}
                    onChange={(e) => setGoalUnit(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
