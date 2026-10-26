import React, { useState } from 'react';
import {
  X,
  CheckSquare,
  FileText,
  Wallet,
  Dumbbell,
  Target,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { todayKey } from '../../lib/dates';
import { ExpenseCategory, TaskListType, TaskPriority } from '../../types';

export const QuickCaptureModal: React.FC = () => {
  const {
    isQuickCaptureOpen,
    setQuickCaptureOpen,
    quickCaptureTab,
    openQuickCapture,
    addTask,
    addNote,
    addTransaction,
    addWorkout,
    addHabit,
    showToast,
  } = useApp();

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskList, setTaskList] = useState<TaskListType>('Inbox');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [taskDueDate, setTaskDueDate] = useState(todayKey());
  const [taskDueTime, setTaskDueTime] = useState('02:30 PM');

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Expense form state
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txCategory, setTxCategory] = useState<ExpenseCategory>('Groceries');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');

  // Workout form state
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [workoutDuration, setWorkoutDuration] = useState('45');
  const [workoutCalories, setWorkoutCalories] = useState('350');
  const [workoutExercises, setWorkoutExercises] = useState('Bench Press: 3x8 @ 175lbs');

  // Habit form state
  const [habitName, setHabitName] = useState('');
  const [habitCategory, setHabitCategory] = useState('Mindfulness');

  if (!isQuickCaptureOpen) return null;

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      showToast('Please enter a task title', 'warning');
      return;
    }
    addTask({
      title: taskTitle.trim(),
      list: taskList,
      priority: taskPriority,
      status: 'todo',
      dueDate: taskDueDate,
      dueTime: taskDueTime || undefined,
    });
    setTaskTitle('');
    setQuickCaptureOpen(false);
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) {
      showToast('Please enter a note title', 'warning');
      return;
    }
    addNote({
      title: noteTitle.trim(),
      content: noteContent,
      excerpt: noteContent.slice(0, 100),
      tags: ['Quick Capture'],
    });
    setNoteTitle('');
    setNoteContent('');
    setQuickCaptureOpen(false);
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(txAmount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid amount', 'warning');
      return;
    }
    if (!txDescription.trim()) {
      showToast('Please enter a description', 'warning');
      return;
    }
    addTransaction({
      type: txType,
      category: txCategory,
      description: txDescription.trim(),
      amount: num,
      date: new Date().toISOString().slice(0, 10),
      time: '12:00 PM',
    });
    setTxAmount('');
    setTxDescription('');
    setQuickCaptureOpen(false);
  };

  const handleWorkoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutTitle.trim()) {
      showToast('Please enter a workout title', 'warning');
      return;
    }
    addWorkout({
      title: workoutTitle.trim(),
      date: new Date().toISOString().slice(0, 10),
      durationMinutes: parseInt(workoutDuration) || 45,
      calories: parseInt(workoutCalories) || 300,
      exercises: workoutExercises
        .split('\n')
        .filter(Boolean)
        .map((line) => ({ name: line, setsReps: '' })),
    });
    setWorkoutTitle('');
    setQuickCaptureOpen(false);
  };

  const handleHabitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) {
      showToast('Please enter a habit name', 'warning');
      return;
    }
    addHabit({
      name: habitName.trim(),
      category: habitCategory,
    });
    setHabitName('');
    setQuickCaptureOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick Capture"
        className="w-full max-w-lg rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-4 py-3">
          <span className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
            Quick Capture
          </span>
          <button
            onClick={() => setQuickCaptureOpen(false)}
            aria-label="Close"
            className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/50 dark:bg-[#181A17]/50 p-1 text-xs font-semibold">
          <button
            onClick={() => openQuickCapture('task')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
              quickCaptureTab === 'task'
                ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F]'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Task</span>
          </button>
          <button
            onClick={() => openQuickCapture('note')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
              quickCaptureTab === 'note'
                ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F]'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Note</span>
          </button>
          <button
            onClick={() => openQuickCapture('expense')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
              quickCaptureTab === 'expense'
                ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F]'
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Expense</span>
          </button>
          <button
            onClick={() => openQuickCapture('workout')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
              quickCaptureTab === 'workout'
                ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F]'
            }`}
          >
            <Dumbbell className="h-3.5 w-3.5" />
            <span>Workout</span>
          </button>
          <button
            onClick={() => openQuickCapture('habit')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
              quickCaptureTab === 'habit'
                ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                : 'text-[#6B7067] dark:text-[#A6AB9F]'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            <span>Habit</span>
          </button>
        </div>

        {/* Tab content bodies */}
        <div className="p-4">
          {quickCaptureTab === 'task' && (
            <form onSubmit={handleTaskSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Finish quarterly financial summary"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:border-[#526B55] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Target List
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
                  >
                  </input>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Due Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 02:30 PM"
                    value={taskDueTime}
                    onChange={(e) => setTaskDueTime(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Create Task
                </button>
              </div>
            </form>
          )}

          {quickCaptureTab === 'note' && (
            <form onSubmit={handleNoteSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cognitive Systems Architecture"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Content (Markdown supported)
                </label>
                <textarea
                  rows={4}
                  placeholder="Capture ideas, notes, references..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Save Note
                </button>
              </div>
            </form>
          )}

          {quickCaptureTab === 'expense' && (
            <form onSubmit={handleExpenseSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Type
                  </label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as any)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  >
                    <option value="expense">Expense (Outflow)</option>
                    <option value="income">Income (Inflow)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Amount (₹ INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1500"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Category
                </label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value as ExpenseCategory)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                >
                  <option value="Groceries">Groceries</option>
                  <option value="Dining">Dining</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Savings">Savings</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Salary">Salary</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Affiliate">Affiliate</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Supermarket grocery refill"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Record Transaction
                </button>
              </div>
            </form>
          )}

          {quickCaptureTab === 'workout' && (
            <form onSubmit={handleWorkoutSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Workout Session Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Upper Body Hypertrophy"
                  value={workoutTitle}
                  onChange={(e) => setWorkoutTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={workoutDuration}
                    onChange={(e) => setWorkoutDuration(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Estimated Calories
                  </label>
                  <input
                    type="number"
                    value={workoutCalories}
                    onChange={(e) => setWorkoutCalories(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Key Exercises (One per line)
                </label>
                <textarea
                  rows={2}
                  placeholder="Bench Press: 4x6 @ 185lbs&#10;Overhead Press: 3x8 @ 115lbs"
                  value={workoutExercises}
                  onChange={(e) => setWorkoutExercises(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Log Workout
                </button>
              </div>
            </form>
          )}

          {quickCaptureTab === 'habit' && (
            <form onSubmit={handleHabitSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Habit Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Evening Cold Shower"
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
                  value={habitCategory}
                  onChange={(e) => setHabitCategory(e.target.value)}
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
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Create Habit
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
