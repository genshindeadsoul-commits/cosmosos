import React, { useState } from 'react';
import {
  Dumbbell,
  Plus,
  Trash2,
  Calendar,
  Flame,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dayKey, daysInMonth, leadingBlanks, monthLabel, todayKey } from '../../lib/dates';

export const FitnessView: React.FC = () => {
  const { workouts, addWorkout, deleteWorkout } = useApp();

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [view, setView] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(new Date().getDate());

  // Form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [duration, setDuration] = useState('50');
  const [calories, setCalories] = useState('450');
  const [exerciseList, setExerciseList] = useState([
    { name: 'Incline Bench Press', setsReps: '4x8', weightLbs: 165 },
    { name: 'Cable Lateral Raises', setsReps: '3x15', weightLbs: 25 },
  ]);

  const handleAddWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addWorkout({
      title: title.trim(),
      date,
      durationMinutes: parseInt(duration) || 45,
      calories: parseInt(calories) || 300,
      exercises: exerciseList.filter((ex) => ex.name.trim()),
    });

    setTitle('');
    setIsLogModalOpen(false);
  };

  const handleAddExerciseRow = () => {
    setExerciseList([...exerciseList, { name: '', setsReps: '3x10', weightLbs: 0 }]);
  };

  // Workout dates map for calendar
  const workoutDays = new Set(workouts.map((w) => w.date));

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
            Fitness & Training
          </h1>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Workout logs, lifting milestones, and training calendar
          </p>
        </div>
        <button
          onClick={() => setIsLogModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Log Workout</span>
        </button>
      </div>

      {/* Workout Calendar Card matching Screenshot 2 */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#252821] dark:text-[#ECEDE6]">
              Workout Calendar
            </h2>
            <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
              Track workout consistency
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#8A8E85]">{monthLabel(view.y, view.m)}</span>
            <div className="flex items-center">
              <button
                aria-label="Previous month"
                className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                aria-label="Next month"
                className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#8A8E85]">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Grid matching Screenshot 2 */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {Array.from({ length: leadingBlanks(view.y, view.m, 0) }, (_, i) => (
            <div key={`b${i}`} className="h-14 sm:h-16 rounded-xl border border-dashed border-[#DFE1D9]/40 dark:border-[#383D35]/40" />
          ))}

          {Array.from({ length: daysInMonth(view.y, view.m) }, (_, i) => i + 1).map((day) => {
            const hasWorkout = workoutDays.has(dayKey(view.y, view.m, day));
            const isToday = dayKey(view.y, view.m, day) === todayKey();
            const isSelected = day === selectedCalendarDay;

            return (
              <button
                key={day}
                onClick={() => setSelectedCalendarDay(day)}
                className={`relative flex flex-col items-center justify-between p-1.5 sm:p-2 h-14 sm:h-16 rounded-xl border transition-colors ${
                  isToday
                    ? 'border-[#252821] dark:border-[#ECEDE6] ring-1 ring-[#252821]'
                    : isSelected
                    ? 'border-[#526B55] bg-[#E8EEE6]/50 dark:bg-[#303B2E]/50'
                    : 'border-[#DFE1D9] dark:border-[#383D35] hover:bg-[#F5F5F0]/60 dark:hover:bg-[#292D27]/60'
                }`}
              >
                <span className="text-[11px] font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                  {day}
                </span>

                {hasWorkout && (
                  <div className="flex flex-col items-center">
                    <Dumbbell className="h-3.5 w-3.5 text-[#3D5240] dark:text-[#A8BDA1]" />
                    <span className="text-[9px] font-mono text-[#526B55] dark:text-[#A8BDA1] font-bold">
                      1
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 pt-2 text-xs text-[#6B7067] dark:text-[#A6AB9F]">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-[#252821] dark:border-[#ECEDE6]" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Dumbbell className="h-3.5 w-3.5 text-[#3D5240] dark:text-[#A8BDA1]" />
            <span>Workout logged</span>
          </div>
        </div>
      </div>

      {/* RECENT LOGS Section matching Screenshot 2 */}
      <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B7067] dark:text-[#A6AB9F]">
          Recent Logs
        </h2>

        <div className="space-y-3">
          {workouts.map((w) => (
            <div
              key={w.id}
              className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/40 dark:bg-[#181A17]/40 p-4 space-y-2.5 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                    {w.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#6B7067] dark:text-[#A6AB9F] pt-0.5">
                    <span>{w.date}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {w.durationMinutes} mins
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-500" />
                      {w.calories} kcal
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => deleteWorkout(w.id)}
                  aria-label="Delete workout log"
                  className="p-1 text-[#8A8E85] hover:text-rose-500 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Exercise Badges / Chips matching Screenshot 2 */}
              <div className="flex flex-wrap gap-2 pt-1">
                {w.exercises.map((ex, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1 text-xs font-mono font-semibold text-[#252821] dark:text-[#ECEDE6]"
                  >
                    {ex.name}: {ex.setsReps}
                    {ex.weightLbs !== undefined ? ` @ ${ex.weightLbs}lbs` : ''}
                  </span>
                ))}
              </div>

              {w.notes && (
                <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F] italic pt-1">
                  "{w.notes}"
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Log Workout Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Log Workout Session"
            className="w-full max-w-lg rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Log Training Session
              </h3>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddWorkout} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Session Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Upper Body Hypertrophy"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              {/* Exercises sub-list */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#6B7067] dark:text-[#A6AB9F]">
                    Exercises Logged
                  </span>
                  <button
                    type="button"
                    onClick={handleAddExerciseRow}
                    className="text-xs text-[#526B55] dark:text-[#A8BDA1] font-semibold hover:underline"
                  >
                    + Add Exercise
                  </button>
                </div>

                {exerciseList.map((ex, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Exercise name"
                      value={ex.name}
                      onChange={(e) => {
                        const copy = [...exerciseList];
                        copy[idx].name = e.target.value;
                        setExerciseList(copy);
                      }}
                      className="col-span-6 rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Sets/reps (e.g. 4x8)"
                      value={ex.setsReps}
                      onChange={(e) => {
                        const copy = [...exerciseList];
                        copy[idx].setsReps = e.target.value;
                        setExerciseList(copy);
                      }}
                      className="col-span-3 rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Weight (lbs)"
                      value={ex.weightLbs || ''}
                      onChange={(e) => {
                        const copy = [...exerciseList];
                        copy[idx].weightLbs = parseFloat(e.target.value) || 0;
                        setExerciseList(copy);
                      }}
                      className="col-span-3 rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-xs"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Save Workout Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
