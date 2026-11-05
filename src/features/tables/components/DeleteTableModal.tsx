import React, { useState } from 'react';
import { AlertTriangle, Archive, Trash2, X } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import type { TableCollection } from '../../../types';

interface DeleteTableModalProps {
  isOpen: boolean;
  table: TableCollection;
  onClose: () => void;
  onConfirmDelete: (tableId: string) => void;
  onArchiveInstead: (tableId: string) => void;
}

export const DeleteTableModal: React.FC<DeleteTableModalProps> = ({
  isOpen,
  table,
  onClose,
  onConfirmDelete,
  onArchiveInstead,
}) => {
  const [confirmName, setConfirmName] = useState('');
  const rowCount = table.rows.length;
  const isProtectedOrHasRows = rowCount > 0;
  const isConfirmed = !isProtectedOrHasRows || confirmName.trim().toLowerCase() === table.name.trim().toLowerCase();

  const handleDelete = () => {
    onConfirmDelete(table.id);
    onClose();
  };

  const handleArchive = () => {
    onArchiveInstead(table.id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Table" maxWidth="md">
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Permanent Deletion Warning</span>
          </div>
          <p className="text-xs leading-relaxed">
            You are about to permanently delete table <strong>"{table.name}"</strong>.
            {rowCount > 0 ? (
              <> This will permanently erase all <strong>{rowCount}</strong> associated record{rowCount === 1 ? '' : 's'} and column definitions across all synced devices.</>
            ) : (
              <> This table contains 0 records and will be permanently removed.</>
            )}
          </p>
        </div>

        {/* Archive Alternative Card */}
        <div className="p-3 rounded-xl bg-[#F5F5F0] dark:bg-[#181A17] border border-[#DFE1D9] dark:border-[#383D35] flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] flex items-center gap-1.5">
              <Archive className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
              <span>Looking to hide this table instead?</span>
            </div>
            <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
              Archiving safely hides the table from your view while keeping all records recoverable.
            </p>
          </div>
          <button
            type="button"
            onClick={handleArchive}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] hover:bg-[#EAECE6] transition-colors shrink-0"
          >
            Archive Instead
          </button>
        </div>

        {/* Confirmation Input if table has rows */}
        {isProtectedOrHasRows && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6]">
              Type <strong className="text-rose-600 dark:text-rose-400 select-all font-mono">{table.name}</strong> to confirm:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={table.name}
              aria-label="Confirm table name to delete"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:border-rose-500"
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
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
            disabled={!isConfirmed}
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Table Permanently</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
