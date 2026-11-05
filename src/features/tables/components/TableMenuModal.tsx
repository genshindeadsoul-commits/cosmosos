import React from 'react';
import {
  Edit3,
  Copy,
  Download,
  Archive,
  ArchiveRestore,
  Trash2,
  Calendar,
  Columns,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import type { TableCollection } from '../../../types';

interface TableMenuModalProps {
  isOpen: boolean;
  table: TableCollection;
  onClose: () => void;
  onOpenRename: () => void;
  onOpenDuplicate: () => void;
  onExportCsv: () => void;
  onOpenColumnManager: () => void;
  onToggleArchive: () => void;
  onOpenDelete: () => void;
  onToggleCalendarSync: () => void;
}

export const TableMenuModal: React.FC<TableMenuModalProps> = ({
  isOpen,
  table,
  onClose,
  onOpenRename,
  onOpenDuplicate,
  onExportCsv,
  onOpenColumnManager,
  onToggleArchive,
  onOpenDelete,
  onToggleCalendarSync,
}) => {
  const isArchived = !!table.archived;
  const isCalendarSyncEnabled = !!table.metadata?.calendarEnabled;
  const hasDateField = table.columns.some((c) => c.type === 'date');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Table Actions — ${table.name}`} maxWidth="sm">
      <div className="space-y-1.5 py-1">
        {/* Rename */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenRename();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#181A17] transition-colors"
        >
          <Edit3 className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1] shrink-0" />
          <div className="text-left">
            <div>Rename Table</div>
            <div className="text-[10px] text-[#8A8E85] font-normal">Change name and description</div>
          </div>
        </button>

        {/* Duplicate */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenDuplicate();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#181A17] transition-colors"
        >
          <Copy className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1] shrink-0" />
          <div className="text-left">
            <div>Duplicate Table…</div>
            <div className="text-[10px] text-[#8A8E85] font-normal">Structure only or structure & records</div>
          </div>
        </button>

        {/* Columns Manager */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenColumnManager();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#181A17] transition-colors"
        >
          <Columns className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1] shrink-0" />
          <div className="text-left">
            <div>Manage Columns…</div>
            <div className="text-[10px] text-[#8A8E85] font-normal">Add, rename, reorder, or hide columns</div>
          </div>
        </button>

        {/* Export CSV */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onExportCsv();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#181A17] transition-colors"
        >
          <Download className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1] shrink-0" />
          <div className="text-left">
            <div>Export as CSV</div>
            <div className="text-[10px] text-[#8A8E85] font-normal">Download RFC 4180 spreadsheet file</div>
          </div>
        </button>

        {/* Calendar Sync Toggle (if table has date field) */}
        {hasDateField && (
          <button
            type="button"
            onClick={() => {
              onToggleCalendarSync();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#181A17] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1] shrink-0" />
              <div className="text-left">
                <div>Sync to Calendar</div>
                <div className="text-[10px] text-[#8A8E85] font-normal">Display dated records in Day Details</div>
              </div>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                isCalendarSyncEnabled
                  ? 'bg-[#526B55] text-white'
                  : 'bg-[#ECEDE7] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F]'
              }`}
            >
              {isCalendarSyncEnabled ? 'Enabled' : 'Off'}
            </span>
          </button>
        )}

        <div className="pt-1 border-t border-[#DFE1D9] dark:border-[#383D35]" />

        {/* Archive / Restore */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onToggleArchive();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#181A17] transition-colors"
        >
          {isArchived ? (
            <>
              <ArchiveRestore className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1] shrink-0" />
              <div className="text-left">
                <div>Restore Table</div>
                <div className="text-[10px] text-[#8A8E85] font-normal">Move back to active tables</div>
              </div>
            </>
          ) : (
            <>
              <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-left">
                <div>Archive Table</div>
                <div className="text-[10px] text-[#8A8E85] font-normal">Hide table without deleting data</div>
              </div>
            </>
          )}
        </button>

        {/* Delete Permanently */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenDelete();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="text-left">
            <div>Delete Table…</div>
            <div className="text-[10px] text-rose-600/70 dark:text-rose-400/70 font-normal">Permanently delete with confirmation</div>
          </div>
        </button>
      </div>
    </Modal>
  );
};
