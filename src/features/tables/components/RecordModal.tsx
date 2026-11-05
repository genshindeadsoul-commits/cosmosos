import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import type { TableCollection, TableRow } from '../../../types';

interface RecordModalProps {
  isOpen: boolean;
  table: TableCollection;
  record?: TableRow | null; // null if creating, row if editing
  onClose: () => void;
  onSave: (tableId: string, rowData: Record<string, any>, rowId?: string) => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  table,
  record,
  onClose,
  onSave,
}) => {
  const isEditing = !!record;
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (record) {
      setFormData({ ...record });
    } else {
      // Initialize defaults based on column types
      const initial: Record<string, any> = {};
      table.columns.forEach((col) => {
        if (col.id === 'index') return;
        if (col.type === 'checkbox') initial[col.id] = false;
        else if (col.type === 'select' || col.type === 'status') {
          initial[col.id] = col.options?.[0] || '';
        } else if (col.type === 'multi-select') {
          initial[col.id] = [];
        } else {
          initial[col.id] = '';
        }
      });
      setFormData(initial);
    }
  }, [record, table]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(table.id, formData, record?.id);
    onClose();
  };

  const handleMultiSelectToggle = (colId: string, opt: string) => {
    const currentList: string[] = Array.isArray(formData[colId])
      ? formData[colId]
      : typeof formData[colId] === 'string' && formData[colId]
      ? formData[colId].split(',').map((s: string) => s.trim())
      : [];
    const nextList = currentList.includes(opt)
      ? currentList.filter((x) => x !== opt)
      : [...currentList, opt];
    setFormData({ ...formData, [colId]: nextList });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Record — ${table.name}` : `New Record in ${table.name}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          {table.columns
            .filter((col) => col.id !== 'index')
            .map((col) => {
              const val = formData[col.id];

              if (col.type === 'checkbox') {
                return (
                  <div key={col.id} className="flex items-center justify-between p-2 rounded-lg bg-[#F5F5F0] dark:bg-[#181A17]">
                    <label className="text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] cursor-pointer">
                      {col.name}
                    </label>
                    <input
                      type="checkbox"
                      checked={!!val}
                      onChange={(e) => setFormData({ ...formData, [col.id]: e.target.checked })}
                      className="h-4 w-4 rounded border-[#DFE1D9] text-[#526B55] focus:ring-[#526B55]"
                    />
                  </div>
                );
              }

              if (col.type === 'select' || col.type === 'status') {
                const options = col.options?.length ? col.options : ['ACTIVE', 'PENDING', 'DONE'];
                return (
                  <div key={col.id}>
                    <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                      {col.name}
                    </label>
                    <select
                      value={val || options[0] || ''}
                      onChange={(e) => setFormData({ ...formData, [col.id]: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:border-[#526B55]"
                    >
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (col.type === 'multi-select') {
                const currentArr: string[] = Array.isArray(val)
                  ? val
                  : typeof val === 'string' && val
                  ? val.split(',').map((s: string) => s.trim())
                  : [];
                const options = col.options || [];

                return (
                  <div key={col.id} className="space-y-1">
                    <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                      {col.name}
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60">
                      {options.length === 0 ? (
                        <span className="text-[11px] text-[#8A8E85]">No options configured</span>
                      ) : (
                        options.map((opt) => {
                          const isSelected = currentArr.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleMultiSelectToggle(col.id, opt)}
                              className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                                isSelected
                                  ? 'bg-[#526B55] text-white'
                                  : 'bg-white dark:bg-[#20231F] text-[#6B7067] dark:text-[#A6AB9F] border border-[#DFE1D9] dark:border-[#383D35]'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              }

              if (col.type === 'currency') {
                return (
                  <div key={col.id}>
                    <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                      {col.name}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-[#8A8E85]">
                        {col.currencySymbol || '₹'}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={val ?? ''}
                        onChange={(e) => setFormData({ ...formData, [col.id]: e.target.value })}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:border-[#526B55]"
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div key={col.id}>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    {col.name}
                  </label>
                  <input
                    type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : col.type === 'url' ? 'url' : 'text'}
                    value={val ?? ''}
                    onChange={(e) => setFormData({ ...formData, [col.id]: e.target.value })}
                    placeholder={`Enter ${col.name.toLowerCase()}...`}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:border-[#526B55]"
                  />
                </div>
              );
            })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs transition-colors"
          >
            {isEditing ? 'Save Changes' : 'Add Record'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
