import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  FileText,
  CheckSquare,
  Wallet,
  Dumbbell,
  Target,
  Sparkles,
  Table2,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModuleType } from '../../types';

interface SearchResultItem {
  id: string;
  module: ModuleType;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ElementType;
  recordId?: string;
}

export const GlobalSearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setSearchOpen,
    tasks,
    notes,
    tables,
    transactions,
    workouts,
    goals,
    habits,
    trackers,
    setActiveModule,
    setSelectedNoteId,
    setSelectedTableId,
    setSelectedTrackerId,
    setFocusRecord,
    events,
  } = useApp();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isSearchOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const items: SearchResultItem[] = [];

    // Tasks
    tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) {
        items.push({
          id: `task-${t.id}`,
          module: 'tasks',
          title: t.title,
          subtitle: `${t.list} · ${t.dueDate ? `Due ${t.dueDate}` : 'No due date'}${t.dueTime ? ` at ${t.dueTime}` : ''} · ${t.priority}`,
          badge: 'Task',
          icon: CheckSquare,
          recordId: t.id,
        });
      }
    });

    // Calendar events
    events.forEach((ev) => {
      if (ev.title.toLowerCase().includes(q) || ev.description?.toLowerCase().includes(q) || ev.location?.toLowerCase().includes(q)) {
        items.push({
          id: `event-${ev.id}`, module: 'tasks', title: ev.title,
          subtitle: `${ev.date}${ev.startTime ? ` · ${ev.startTime}` : ''}${ev.location ? ` · ${ev.location}` : ''}`,
          badge: 'Event', icon: CheckSquare, recordId: ev.id,
        });
      }
    });

    // Notes
    notes.forEach((n) => {
      if (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) {
        items.push({
          id: `note-${n.id}`,
          module: 'notes',
          title: n.title,
          subtitle: n.excerpt.slice(0, 80) + '...',
          badge: 'Note',
          icon: FileText,
          recordId: n.id,
        });
      }
    });

    // Tables
    tables.forEach((tbl) => {
      if (tbl.name.toLowerCase().includes(q) || tbl.description.toLowerCase().includes(q)) {
        items.push({
          id: `tbl-${tbl.id}`,
          module: 'tables',
          title: tbl.name,
          subtitle: `${tbl.rows.length} rows · ${tbl.description}`,
          badge: 'Table',
          icon: Table2,
          recordId: tbl.id,
        });
      }
      // Search inside rows
      tbl.rows.forEach((row) => {
        const rowValues = Object.values(row).join(' ').toLowerCase();
        if (rowValues.includes(q)) {
          items.push({
            id: `row-${tbl.id}-${row.id}`,
            module: 'tables',
            title: row.name || row.title || `Row #${row.index || row.id}`,
            subtitle: `In ${tbl.name} · ${row.status || row.city || ''}`,
            badge: 'Table Record',
            icon: Table2,
            recordId: tbl.id,
          });
        }
      });
    });

    // Expenses
    transactions.forEach((tx) => {
      if (tx.description.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q)) {
        items.push({
          id: `tx-${tx.id}`,
          module: 'expenses',
          title: tx.description,
          subtitle: `${tx.category} · ₹${tx.amount.toLocaleString()} · ${tx.date}`,
          badge: tx.type === 'income' ? 'Income' : 'Expense',
          icon: Wallet,
        });
      }
    });

    // Workouts
    workouts.forEach((w) => {
      if (w.title.toLowerCase().includes(q) || w.notes?.toLowerCase().includes(q)) {
        items.push({
          id: `w-${w.id}`,
          module: 'fitness',
          title: w.title,
          subtitle: `${w.date} · ${w.durationMinutes} mins · ${w.calories} kcal`,
          badge: 'Workout',
          icon: Dumbbell,
        });
      }
    });

    // Goals
    goals.forEach((g) => {
      if (g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)) {
        items.push({
          id: `goal-${g.id}`,
          module: 'goals',
          title: g.title,
          subtitle: `${g.current}/${g.target} ${g.unit} (${Math.round((g.current / g.target) * 100)}%)`,
          badge: 'Goal',
          icon: Target,
        });
      }
    });

    // Habits
    habits.forEach((h) => {
      if (h.name.toLowerCase().includes(q) || h.category.toLowerCase().includes(q)) {
        items.push({
          id: `habit-${h.id}`,
          module: 'goals',
          title: h.name,
          subtitle: `${h.category} · ${h.streak}-day streak`,
          badge: 'Habit',
          icon: Target,
        });
      }
    });

    // Trackers
    trackers.forEach((trk) => {
      if (trk.name.toLowerCase().includes(q)) {
        items.push({
          id: `trk-${trk.id}`,
          module: 'trackers',
          title: trk.name,
          subtitle: `Target: ${trk.targetPerDay} ${trk.unit}/day · ${trk.entries.length} entries`,
          badge: 'Tracker',
          icon: Sparkles,
          recordId: trk.id,
        });
      }
    });

    return items.slice(0, 20);
  }, [query, tasks, events, notes, tables, transactions, workouts, goals, habits, trackers]);

  if (!isSearchOpen) return null;

  const handleSelectResult = (item: SearchResultItem) => {
    setActiveModule(item.module);
    if (item.module === 'notes' && item.recordId) {
      setSelectedNoteId(item.recordId);
    } else if (item.module === 'tables' && item.recordId) {
      setSelectedTableId(item.recordId);
    } else if (item.module === 'trackers' && item.recordId) {
      setSelectedTrackerId(item.recordId);
    } else if (item.module === 'tasks' && item.recordId) {
      setFocusRecord({ kind: item.badge, id: item.recordId });
    }
    setSearchOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-20 bg-black/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Cosmos OS"
        className="relative w-full max-w-xl rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-2xl overflow-hidden"
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-[#DFE1D9] dark:border-[#383D35] px-4 py-3">
          <Search className="h-5 w-5 text-[#8A8E85] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks, notes, tables, expenses, fitness, goals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchOpen(false);
            }}
            className="w-full bg-transparent text-sm text-[#252821] dark:text-[#ECEDE6] placeholder-[#8A8E85] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] mr-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setSearchOpen(false)}
            className="rounded px-2 py-1 text-xs font-semibold text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="py-8 text-center text-xs text-[#8A8E85]">
              Type keywords to search across all Cosmos OS personal modules...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8A8E85]">
              No records found matching "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectResult(item)}
                    className="flex w-full items-center justify-between rounded-lg p-2.5 text-left hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#ECEDE7] dark:bg-[#30352D] text-[#526B55] dark:text-[#A8BDA1]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                            {item.title}
                          </span>
                          <span className="shrink-0 rounded bg-[#E8EEE6] dark:bg-[#303B2E] px-1.5 py-0.5 text-[10px] font-semibold text-[#526B55] dark:text-[#A8BDA1]">
                            {item.badge}
                          </span>
                        </div>
                        <div className="truncate text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#8A8E85] opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="border-t border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/50 dark:bg-[#181A17]/50 px-4 py-2 text-[11px] text-[#8A8E85] flex justify-between">
          <span>Navigate with mouse or touch</span>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
};
