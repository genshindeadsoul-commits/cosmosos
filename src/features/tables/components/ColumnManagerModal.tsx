import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Tags,
  Link2,
  DollarSign,
  AlertCircle,
  Settings2,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import type { TableCollection, TableColumn, TableColumnType } from '../../../types';

interface ColumnManagerModalProps {
  isOpen: boolean;
  table: TableCollection;
  onClose: () => void;
  onUpdateColumns: (tableId: string, columns: TableColumn[]) => void;
}

export const COLUMN_TYPE_META: Record<
  TableColumnType,
  { label: string; icon: React.FC<{ className?: string }>; description: string }
> = {
  text: { label: 'Text', icon: Type, description: 'Plain text or titles' },
  number: { label: 'Number', icon: Hash, description: 'Numeric values, counts, ratings' },
  date: { label: 'Date', icon: Calendar, description: 'Calendar dates (YYYY-MM-DD)' },
  checkbox: { label: 'Checkbox', icon: CheckSquare, description: 'Boolean true/false toggle' },
  select: { label: 'Select', icon: List, description: 'Single option from a list' },
  'multi-select': { label: 'Multi-select', icon: Tags, description: 'Multiple tags or categories' },
  url: { label: 'URL', icon: Link2, description: 'Web addresses with quick link' },
  currency: { label: 'Currency', icon: DollarSign, description: 'Money with currency symbol' },
  status: { label: 'Status (Legacy)', icon: List, description: 'Status badge' },
  link: { label: 'Link (Legacy)', icon: Link2, description: 'Web link' },
};

export const ColumnManagerModal: React.FC<ColumnManagerModalProps> = ({
  isOpen,
  table,
  onClose,
  onUpdateColumns,
}) => {
  const [columns, setColumns] = useState<TableColumn[]>(table.columns);
  const [editingColId, setEditingColId] = useState<string | null>(null);

  // New column state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<TableColumnType>('text');
  const [newColOptions, setNewColOptions] = useState('');
  const [newColCurrency, setNewColCurrency] = useState('₹');

  // Move column order
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;
    const updated = [...columns];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setColumns(updated);
  };

  // Toggle column visibility
  const handleToggleHide = (colId: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, hidden: !c.hidden } : c))
    );
  };

  // Delete column
  const handleDeleteColumn = (colId: string) => {
    if (columns.length <= 1) {
      alert('A table must have at least one column.');
      return;
    }
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    if (editingColId === colId) setEditingColId(null);
  };

  // Add new column submit
  const handleCreateColumn = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newColName.trim();
    if (!trimmed) return;
    const baseId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const uniqueId = columns.some((c) => c.id === baseId) ? `${baseId}_${Date.now().toString(36)}` : baseId;

    const optionsArray =
      newColType === 'select' || newColType === 'multi-select' || newColType === 'status'
        ? newColOptions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const newColumn: TableColumn = {
      id: uniqueId,
      name: trimmed,
      type: newColType,
      options: optionsArray && optionsArray.length > 0 ? optionsArray : ['ACTIVE', 'PENDING', 'DONE'],
      currencySymbol: newColType === 'currency' ? newColCurrency || '₹' : undefined,
      hidden: false,
    };

    setColumns((prev) => [...prev, newColumn]);
    setNewColName('');
    setNewColType('text');
    setNewColOptions('');
    setIsAddingNew(false);
  };

  // Save all changes
  const handleSaveAll = () => {
    onUpdateColumns(table.id, columns);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Column Management — ${table.name}`} maxWidth="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#DFE1D9] dark:border-[#383D35]">
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Reorder, rename, hide, or add column definitions. Existing records will be safely preserved.
          </p>
          {!isAddingNew && (
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Column</span>
            </button>
          )}
        </div>

        {/* Add New Column Form */}
        {isAddingNew && (
          <form
            onSubmit={handleCreateColumn}
            className="p-3.5 rounded-xl border border-[#526B55]/30 bg-[#F5F7F4] dark:bg-[#1C221D] space-y-3"
          >
            <div className="flex items-center justify-between font-bold text-xs text-[#252821] dark:text-[#ECEDE6]">
              <span>New Column Details</span>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="text-[#6B7067] hover:text-[#252821] text-xs font-normal"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  Column Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priority, Price, Status, URL"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="new-col-type-select"
                  className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1"
                >
                  Column Type
                </label>
                <select
                  id="new-col-type-select"
                  aria-label="Column Type"
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value as TableColumnType)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  <option value="text">Text (General string)</option>
                  <option value="number">Number (Numeric calculation)</option>
                  <option value="date">Date (YYYY-MM-DD)</option>
                  <option value="checkbox">Checkbox (True / False)</option>
                  <option value="select">Select (Single choice)</option>
                  <option value="multi-select">Multi-select (Tags)</option>
                  <option value="url">URL (Web address link)</option>
                  <option value="currency">Currency (Monetary amount)</option>
                </select>
              </div>
            </div>

            {/* Sub-settings depending on type */}
            {(newColType === 'select' || newColType === 'multi-select') && (
              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  Options (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Low, Medium, High, Urgent"
                  value={newColOptions}
                  onChange={(e) => setNewColOptions(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                />
              </div>
            )}

            {newColType === 'currency' && (
              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  Currency Symbol
                </label>
                <select
                  value={newColCurrency}
                  onChange={(e) => setNewColCurrency(e.target.value)}
                  className="w-32 px-3 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  <option value="₹">₹ (INR)</option>
                  <option value="$">$ (USD)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="£">£ (GBP)</option>
                  <option value="¥">¥ (JPY)</option>
                </select>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs transition-colors"
              >
                Create Column
              </button>
            </div>
          </form>
        )}

        {/* Existing Columns List */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {columns.map((col, index) => {
            const meta = COLUMN_TYPE_META[col.type] || COLUMN_TYPE_META.text;
            const Icon = meta.icon;
            const isEditing = editingColId === col.id;

            return (
              <div
                key={col.id}
                className={`p-2.5 rounded-xl border transition-colors ${
                  col.hidden
                    ? 'border-[#DFE1D9]/60 dark:border-[#383D35]/60 bg-gray-50/50 dark:bg-gray-900/20 opacity-70'
                    : 'border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-[#F5F5F0] dark:bg-[#181A17] text-[#526B55] dark:text-[#A8BDA1] shrink-0">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                          {col.name}
                        </span>
                        {col.hidden && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold">
                            Hidden
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#8A8E85] font-mono">
                        {meta.label} {col.options?.length ? `(${col.options.length} options)` : ''} {col.currencySymbol ? `(${col.currencySymbol})` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Reorder Buttons */}
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      aria-label={`Move ${col.name} up`}
                      className="p-1 rounded text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === columns.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      aria-label={`Move ${col.name} down`}
                      className="p-1 rounded text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>

                    {/* Hide / Unhide */}
                    <button
                      type="button"
                      onClick={() => handleToggleHide(col.id)}
                      aria-label={col.hidden ? `Show ${col.name}` : `Hide ${col.name}`}
                      className="p-1 rounded text-[#8A8E85] hover:text-[#526B55] dark:hover:text-[#A8BDA1] transition-colors"
                      title={col.hidden ? 'Unhide column' : 'Hide column'}
                    >
                      {col.hidden ? <EyeOff className="h-3.5 w-3.5 text-amber-600" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>

                    {/* Edit Settings Toggle */}
                    <button
                      type="button"
                      onClick={() => setEditingColId(isEditing ? null : col.id)}
                      aria-label={`Configure ${col.name}`}
                      className={`p-1 rounded transition-colors ${
                        isEditing
                          ? 'text-[#526B55] dark:text-[#A8BDA1] bg-[#F5F5F0] dark:bg-[#181A17]'
                          : 'text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
                      }`}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete Column */}
                    <button
                      type="button"
                      onClick={() => handleDeleteColumn(col.id)}
                      aria-label={`Delete column ${col.name}`}
                      className="p-1 rounded text-[#8A8E85] hover:text-rose-600 transition-colors"
                      title="Delete column"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Editing for this column */}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-[#DFE1D9] dark:border-[#383D35] space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                          Rename Column
                        </label>
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) =>
                            setColumns((prev) =>
                              prev.map((c) => (c.id === col.id ? { ...c, name: e.target.value } : c))
                            )
                          }
                          className="w-full px-2.5 py-1 text-xs rounded border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                        />
                      </div>

                      {(col.type === 'select' || col.type === 'multi-select' || col.type === 'status') && (
                        <div>
                          <label className="block text-[11px] font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                            Options (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={(col.options || []).join(', ')}
                            onChange={(e) => {
                              const opts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                              setColumns((prev) =>
                                prev.map((c) => (c.id === col.id ? { ...c, options: opts } : c))
                              );
                            }}
                            className="w-full px-2.5 py-1 text-xs rounded border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                          />
                        </div>
                      )}

                      {col.type === 'currency' && (
                        <div>
                          <label className="block text-[11px] font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                            Currency Symbol
                          </label>
                          <input
                            type="text"
                            value={col.currencySymbol || '₹'}
                            onChange={(e) =>
                              setColumns((prev) =>
                                prev.map((c) => (c.id === col.id ? { ...c, currencySymbol: e.target.value } : c))
                              )
                            }
                            className="w-24 px-2.5 py-1 text-xs rounded border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs transition-colors"
          >
            Save Columns
          </button>
        </div>
      </div>
    </Modal>
  );
};
