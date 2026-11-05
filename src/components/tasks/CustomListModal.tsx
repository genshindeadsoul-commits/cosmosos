import React, { useState } from 'react';
import { X, Palette, AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';
import { CustomTaskListMeta, TASK_LISTS } from '../../types';
import { useApp } from '../../context/AppContext';
import { usePrefs } from '../../context/PrefsContext';

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#64748B', // Slate
];

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingList?: CustomTaskListMeta;
}

export const CreateListModal: React.FC<CreateListModalProps> = ({
  isOpen,
  onClose,
  existingList,
}) => {
  const { prefs, createCustomTaskList, renameCustomTaskList, updateCustomTaskList } = usePrefs();
  const { renameTaskList } = useApp();

  const [name, setName] = useState(existingList ? existingList.name : '');
  const [color, setColor] = useState(existingList?.color || '#3B82F6');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('List name cannot be blank.');
      return;
    }

    if (existingList) {
      if (existingList.name !== trimmed) {
        renameCustomTaskList(existingList.name, trimmed);
        renameTaskList(existingList.name, trimmed);
      }
      if (existingList.color !== color) {
        updateCustomTaskList(trimmed, { color });
      }
    } else {
      createCustomTaskList(trimmed, color);
    }

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={existingList ? 'Edit List' : 'Create Custom List'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
          <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
            {existingList ? 'Edit List' : 'Create Custom List'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8A8E85] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
              List Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Project Apollo, Gardening, Startup"
              className="w-full rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:ring-2 focus:ring-[#526B55]"
              autoFocus
            />
            {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1.5">
              Accent Color
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-[#252821] dark:ring-white scale-110' : 'hover:scale-105'
                  }`}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white shadow-xs"
            >
              {existingList ? 'Save Changes' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteListModalProps {
  isOpen: boolean;
  onClose: () => void;
  listName: string;
}

export const DeleteListModal: React.FC<DeleteListModalProps> = ({
  isOpen,
  onClose,
  listName,
}) => {
  const { tasks, deleteTaskList } = useApp();
  const { prefs, deleteCustomTaskList } = usePrefs();

  const tasksInList = tasks.filter((t) => t.list === listName);
  const taskCount = tasksInList.length;

  const otherLists = [
    ...TASK_LISTS.filter((l) => l !== listName),
    ...(prefs.customTaskLists?.filter((l) => l.name !== listName && !l.archived).map((l) => l.name) ?? []),
  ];

  const [destination, setDestination] = useState<string>('Inbox');
  const [deleteTasksExplicitly, setDeleteTasksExplicitly] = useState(false);

  if (!isOpen) return null;

  const handleConfirmDelete = () => {
    if (taskCount > 0 && !deleteTasksExplicitly) {
      // Move tasks to destination
      deleteTaskList(listName, destination);
    } else {
      // Delete tasks in list
      deleteTaskList(listName, '__DELETE__');
    }
    deleteCustomTaskList(listName);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete List ${listName}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4">
        <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/60">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
              Delete "{listName}"?
            </h3>
            <p className="text-xs text-[#8A8E85]">
              This action cannot be undone.
            </p>
          </div>
        </div>

        {taskCount > 0 ? (
          <div className="space-y-3 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F9FAF8] dark:bg-[#181A17] p-3 text-xs">
            <p className="font-semibold text-[#252821] dark:text-[#ECEDE6]">
              This list currently contains <span className="font-bold text-rose-600">{taskCount} tasks</span>.
            </p>
            <p className="text-[#8A8E85]">
              To protect your records, choose where to move these tasks before deleting the list:
            </p>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="task-action"
                  checked={!deleteTasksExplicitly}
                  onChange={() => setDeleteTasksExplicitly(false)}
                  className="text-[#3D5240] focus:ring-[#526B55]"
                />
                <span className="font-medium text-[#252821] dark:text-[#ECEDE6]">
                  Move tasks to:
                </span>
                <select
                  value={destination}
                  disabled={deleteTasksExplicitly}
                  onChange={(e) => setDestination(e.target.value)}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2 py-1 text-xs font-semibold focus:outline-none"
                >
                  {otherLists.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400 pt-1">
                <input
                  type="radio"
                  name="task-action"
                  checked={deleteTasksExplicitly}
                  onChange={() => setDeleteTasksExplicitly(true)}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>Delete all {taskCount} tasks permanently</span>
              </label>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#8A8E85]">
            This list is empty. Deleting it will remove it from your workspace and sidebar.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs"
          >
            Delete List
          </button>
        </div>
      </div>
    </div>
  );
};
