import React, { useState } from 'react';
import { Copy, Layers, ListFilter } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import type { TableCollection } from '../../../types';

interface DuplicateTableModalProps {
  isOpen: boolean;
  table: TableCollection;
  onClose: () => void;
  onConfirmDuplicate: (tableId: string, includeRows: boolean) => void;
}

export const DuplicateTableModal: React.FC<DuplicateTableModalProps> = ({
  isOpen,
  table,
  onClose,
  onConfirmDuplicate,
}) => {
  const [includeRows, setIncludeRows] = useState(true);
  const rowCount = table.rows.length;

  const handleDuplicate = () => {
    onConfirmDuplicate(table.id, includeRows);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Duplicate “${table.name}”`} maxWidth="md">
      <div className="space-y-4">
        <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
          Choose whether you would like to duplicate only the table structure or include all existing records.
        </p>

        <div className="space-y-2.5">
          {/* Option 1: Structure & Records */}
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              includeRows
                ? 'border-[#526B55] bg-[#F5F7F4] dark:bg-[#1C221D] ring-1 ring-[#526B55]'
                : 'border-[#DFE1D9] dark:border-[#383D35] hover:bg-[#F5F5F0] dark:hover:bg-[#181A17]'
            }`}
          >
            <input
              type="radio"
              name="duplicate_mode"
              checked={includeRows}
              onChange={() => setIncludeRows(true)}
              className="mt-0.5 text-[#526B55] focus:ring-[#526B55]"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                <Layers className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                <span>Structure and records</span>
              </div>
              <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                Copies the table schema, all columns, settings, and clones all <strong>{rowCount}</strong> existing record{rowCount === 1 ? '' : 's'}.
              </p>
            </div>
          </label>

          {/* Option 2: Structure Only */}
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              !includeRows
                ? 'border-[#526B55] bg-[#F5F7F4] dark:bg-[#1C221D] ring-1 ring-[#526B55]'
                : 'border-[#DFE1D9] dark:border-[#383D35] hover:bg-[#F5F5F0] dark:hover:bg-[#181A17]'
            }`}
          >
            <input
              type="radio"
              name="duplicate_mode"
              checked={!includeRows}
              onChange={() => setIncludeRows(false)}
              className="mt-0.5 text-[#526B55] focus:ring-[#526B55]"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                <ListFilter className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
                <span>Structure only (empty table)</span>
              </div>
              <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                Copies the table name, description, column definitions, and view preferences with 0 records.
              </p>
            </div>
          </label>
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
            type="button"
            onClick={handleDuplicate}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Create Duplicate</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
