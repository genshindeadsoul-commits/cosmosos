import React, { useState, useEffect } from 'react';
import { Edit3 } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import type { TableCollection } from '../../../types';

interface RenameTableModalProps {
  isOpen: boolean;
  table: TableCollection;
  onClose: () => void;
  onSave: (tableId: string, name: string, description: string) => void;
}

export const RenameTableModal: React.FC<RenameTableModalProps> = ({
  isOpen,
  table,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(table.name);
  const [description, setDescription] = useState(table.description || '');

  useEffect(() => {
    setName(table.name);
    setDescription(table.description || '');
  }, [table]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(table.id, trimmed, description.trim());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rename Table" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
            Table Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Project Tracker, Inventory..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:border-[#526B55]"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
            Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief notes about the purpose of this table..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:border-[#526B55]"
          />
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
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
