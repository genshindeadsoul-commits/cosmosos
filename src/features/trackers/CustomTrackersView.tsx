import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { todayKey } from '../../lib/dates';

const STARTER_TEMPLATES = [
  { name: 'Water Intake', unit: 'Liters', targetPerDay: 3.0 },
  { name: 'Screen Time', unit: 'Hours', targetPerDay: 4.0 },
  { name: 'Reading', unit: 'Pages', targetPerDay: 25 },
  { name: 'Daily Steps', unit: 'Steps', targetPerDay: 8000 },
  { name: 'Deep Work', unit: 'Hours', targetPerDay: 4.0 },
];

export const CustomTrackersView: React.FC = () => {
  const {
    trackers,
    selectedTrackerId,
    setSelectedTrackerId,
    addTrackerEntry,
    deleteTrackerEntry,
    addCustomTracker,
    updateCustomTracker,
    deleteCustomTracker,
  } = useApp();

  const [isLogEntryOpen, setIsLogEntryOpen] = useState(false);
  const [isNewTrackerOpen, setIsNewTrackerOpen] = useState(false);
  const [isEditTrackerOpen, setIsEditTrackerOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // New Entry form
  const [entryValue, setEntryValue] = useState('');
  const [entryDate, setEntryDate] = useState(todayKey());
  const [entryNotes, setEntryNotes] = useState('');

  // New Tracker form
  const [trackerName, setTrackerName] = useState('');
  const [trackerUnit, setTrackerUnit] = useState('Liters');
  const [trackerTarget, setTrackerTarget] = useState('3.0');

  // Edit Tracker form
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editTarget, setEditTarget] = useState('');

  const activeTracker = trackers.find((t) => t.id === selectedTrackerId) || trackers[0];
  const latestEntry = activeTracker?.entries[0];

  const handleAddEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(entryValue);
    if (isNaN(val) || !activeTracker) return;

    addTrackerEntry(activeTracker.id, val, entryDate, entryNotes);
    setEntryValue('');
    setEntryNotes('');
    setIsLogEntryOpen(false);
  };

  const handleCreateTrackerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackerName.trim()) return;

    addCustomTracker({
      name: trackerName.trim(),
      unit: trackerUnit.trim() || 'Units',
      targetPerDay: parseFloat(trackerTarget) || 1,
    });

    setTrackerName('');
    setIsNewTrackerOpen(false);
  };

  const handleApplyTemplate = (tpl: typeof STARTER_TEMPLATES[0]) => {
    setTrackerName(tpl.name);
    setTrackerUnit(tpl.unit);
    setTrackerTarget(String(tpl.targetPerDay));
  };

  const handleEditTrackerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTracker || !editName.trim()) return;

    updateCustomTracker(activeTracker.id, {
      name: editName.trim(),
      unit: editUnit.trim() || activeTracker.unit,
      targetPerDay: parseFloat(editTarget) || activeTracker.targetPerDay,
    });

    setIsEditTrackerOpen(false);
  };

  const openEditModal = () => {
    if (!activeTracker) return;
    setEditName(activeTracker.name);
    setEditUnit(activeTracker.unit);
    setEditTarget(String(activeTracker.targetPerDay));
    setIsEditTrackerOpen(true);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {trackers.map((trk) => {
          const isActive = trk.id === activeTracker?.id;
          return (
            <button
              key={trk.id}
              onClick={() => setSelectedTrackerId(trk.id)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-[#3D5240] text-white shadow-xs dark:bg-[#526B55]'
                  : 'border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB]'
              }`}
            >
              {trk.name}
            </button>
          );
        })}

        <button
          onClick={() => setIsNewTrackerOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-dashed border-[#DFE1D9] dark:border-[#383D35] px-3 py-2 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:border-[#526B55] hover:text-[#252821] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Tracker</span>
        </button>
      </div>

      {activeTracker ? (
        <>
          {/* Responsive 3-Column Metric Cards (eliminates vertical stacking) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Target per Day */}
            <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-[#8A8E85]">
                Target per Day
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#252821] dark:text-[#ECEDE6]">
                {activeTracker.targetPerDay} {activeTracker.unit}
              </div>
            </div>

            {/* Total Logged Entries */}
            <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-[#8A8E85]">
                Total Logged Entries
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#252821] dark:text-[#ECEDE6]">
                {activeTracker.entries.length} entries
              </div>
            </div>

            {/* Latest Value */}
            <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
              <span className="text-xs font-semibold text-[#8A8E85]">
                Latest Value
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#252821] dark:text-[#ECEDE6]">
                {latestEntry ? `${latestEntry.value} ${activeTracker.unit}` : '—'}
              </div>
            </div>
          </div>

          {/* Logged Records Table Card */}
          <div className="rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Logged Records for {activeTracker.name}
                </h2>
                <button
                  onClick={() => setIsLogEntryOpen(true)}
                  className="rounded-md bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-2.5 py-1 text-xs font-bold text-white shadow-xs transition-colors"
                >
                  + Log Entry
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openEditModal}
                  aria-label="Edit tracker"
                  className="flex items-center gap-1 text-xs text-[#8A8E85] hover:text-[#526B55] dark:hover:text-[#A8BDA1] transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>

                {isConfirmDeleteOpen ? (
                  <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900 text-xs">
                    <span className="font-semibold text-rose-700 dark:text-rose-300">Delete tracker?</span>
                    <button
                      onClick={() => {
                        deleteCustomTracker(activeTracker.id);
                        setIsConfirmDeleteOpen(false);
                      }}
                      className="font-bold text-rose-600 hover:underline"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setIsConfirmDeleteOpen(false)}
                      className="text-[#8A8E85] hover:underline"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsConfirmDeleteOpen(true)}
                    className="flex items-center gap-1 text-xs text-[#8A8E85] hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Tracker</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DFE1D9] dark:border-[#383D35] text-[#8A8E85] font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Recorded Value</th>
                    <th className="py-2.5 px-3">Target Delta</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFE1D9] dark:divide-[#383D35] font-mono">
                  {activeTracker.entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-[#8A8E85] font-sans">
                        No entries recorded yet. Click <span className="font-semibold text-[#526B55] dark:text-[#A8BDA1]">+ Log Entry</span> above to record your first entry.
                      </td>
                    </tr>
                  ) : (
                    activeTracker.entries.map((entry) => {
                      const delta = Number((entry.value - activeTracker.targetPerDay).toFixed(2));
                      const isPositive = delta >= 0;
                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors"
                        >
                          <td className="py-3 px-3 text-[#252821] dark:text-[#ECEDE6]">
                            {entry.date}
                          </td>
                          <td className="py-3 px-3 font-bold text-[#252821] dark:text-[#ECEDE6]">
                            {entry.value} {activeTracker.unit}
                          </td>
                          <td
                            className={`py-3 px-3 font-bold ${
                              isPositive
                                ? 'text-[#477653] dark:text-[#91B594]'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isPositive ? `+${delta}` : delta} {activeTracker.unit}
                          </td>
                          <td className="py-3 px-3 text-[#6B7067] dark:text-[#A6AB9F] font-sans">
                            {entry.notes || '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => deleteTrackerEntry(activeTracker.id, entry.id)}
                              aria-label={`Delete entry ${entry.id}`}
                              className="p-1 text-[#8A8E85] hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#DFE1D9] dark:border-[#383D35] p-8 sm:p-12 text-center text-xs text-[#8A8E85] space-y-4">
          <p>No custom trackers defined yet. Choose a starter template or create your own:</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {STARTER_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => {
                  addCustomTracker({
                    name: t.name,
                    unit: t.unit,
                    targetPerDay: t.targetPerDay,
                  });
                }}
                className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F0F1EB] transition-colors"
              >
                + {t.name} ({t.targetPerDay} {t.unit})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Log Entry Modal */}
      {isLogEntryOpen && activeTracker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Log Tracker Value"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Log Entry: {activeTracker.name}
              </h3>
              <button
                onClick={() => setIsLogEntryOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddEntrySubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Value ({activeTracker.unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 3.2"
                    value={entryValue}
                    onChange={(e) => setEntryValue(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="Optional context..."
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Record Value
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Tracker Modal */}
      {isNewTrackerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New Custom Tracker"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Create Custom Tracker
              </h3>
              <button
                onClick={() => setIsNewTrackerOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[#8A8E85]">
                Quick templates:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {STARTER_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-[11px] font-medium text-[#252821] dark:text-[#ECEDE6] hover:border-[#526B55]"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateTrackerSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Tracker Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily Coffee Cups, Sleep Hours"
                  value={trackerName}
                  onChange={(e) => setTrackerName(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hours, Cups, Miles"
                    value={trackerUnit}
                    onChange={(e) => setTrackerUnit(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Daily Target
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={trackerTarget}
                    onChange={(e) => setTrackerTarget(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Create Tracker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tracker Modal */}
      {isEditTrackerOpen && activeTracker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit Tracker"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Edit Tracker: {activeTracker.name}
              </h3>
              <button
                onClick={() => setIsEditTrackerOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleEditTrackerSubmit} className="space-y-3">
              <div>
                <label htmlFor="edit-tracker-name-input" className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Tracker Name
                </label>
                <input
                  id="edit-tracker-name-input"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-tracker-unit-input" className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Unit
                  </label>
                  <input
                    id="edit-tracker-unit-input"
                    type="text"
                    required
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="edit-tracker-target-input" className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Daily Target
                  </label>
                  <input
                    id="edit-tracker-target-input"
                    type="number"
                    step="0.1"
                    required
                    value={editTarget}
                    onChange={(e) => setEditTarget(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditTrackerOpen(false)}
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
