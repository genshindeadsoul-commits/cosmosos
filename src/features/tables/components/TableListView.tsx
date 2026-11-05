import React, { useState } from 'react';
import {
  Edit2,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
} from 'lucide-react';
import type { TableCollection, TableRow } from '../../../types';

interface TableListViewProps {
  table: TableCollection;
  rows: TableRow[];
  onEditRecord: (row: TableRow) => void;
  onDuplicateRecord: (rowId: string) => void;
  onDeleteRecord: (rowId: string) => void;
  onToggleCheckbox: (rowId: string, colId: string, currentVal: boolean) => void;
  onAddRecordClick: () => void;
}

export const TableListView: React.FC<TableListViewProps> = ({
  table,
  rows,
  onEditRecord,
  onDuplicateRecord,
  onDeleteRecord,
  onToggleCheckbox,
  onAddRecordClick,
}) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const visibleColumns = table.columns.filter((c) => !c.hidden);
  const primaryCol = visibleColumns.find((c) => c.type === 'text' && c.id !== 'index') || visibleColumns[0];
  const statusCol = visibleColumns.find((c) => c.type === 'select' || c.type === 'status');
  const dateCol = visibleColumns.find((c) => c.type === 'date');
  const checkboxCol = visibleColumns.find((c) => c.type === 'checkbox');

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-8 text-center text-xs text-[#8A8E85]">
        <p className="mb-3">No records found matching your filters.</p>
        <button
          type="button"
          onClick={onAddRecordClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Record</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const isExpanded = !!expandedRows[row.id];
        const primaryVal = row[primaryCol?.id || ''] || `Record #${row.index || ''}`;
        const statusVal = statusCol ? row[statusCol.id] : null;
        const dateVal = dateCol ? row[dateCol.id] : null;

        return (
          <div
            key={row.id}
            className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3.5 shadow-xs space-y-2.5 transition-all hover:border-[#526B55]/40"
          >
            {/* Top Row: Primary Title, Badges, Checkbox */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {checkboxCol && (
                  <input
                    type="checkbox"
                    checked={!!row[checkboxCol.id]}
                    onChange={() => onToggleCheckbox(row.id, checkboxCol.id, !!row[checkboxCol.id])}
                    className="h-4 w-4 rounded border-[#DFE1D9] text-[#526B55] focus:ring-[#526B55] cursor-pointer shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6] truncate">
                    {String(primaryVal)}
                  </h4>
                  {dateVal && (
                    <span className="text-[11px] text-[#8A8E85] font-mono">
                      {dateVal}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              {statusVal && (
                <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold tracking-wider bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                  {String(statusVal)}
                </span>
              )}
            </div>

            {/* Quick Preview Fields */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-[#DFE1D9]/50 dark:border-[#383D35]/50">
              {visibleColumns
                .filter((c) => c.id !== primaryCol?.id && c.id !== statusCol?.id && c.id !== checkboxCol?.id)
                .slice(0, isExpanded ? visibleColumns.length : 2)
                .map((col) => {
                  const val = row[col.id];
                  return (
                    <div key={col.id} className="min-w-0">
                      <span className="text-[10px] text-[#8A8E85] font-semibold block uppercase tracking-wider">
                        {col.name}
                      </span>
                      <div className="text-xs text-[#252821] dark:text-[#ECEDE6] truncate font-medium">
                        {col.type === 'url' && val ? (
                          <a
                            href={val}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#526B55] dark:text-[#A8BDA1] hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="truncate">{val}</span>
                          </a>
                        ) : col.type === 'currency' && val !== undefined && val !== '' ? (
                          `${col.currencySymbol || '₹'}${Number(val).toLocaleString()}`
                        ) : (
                          String(val ?? '—')
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Card Footer: Expand toggle & Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
              {visibleColumns.length > 3 ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(row.id)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#8A8E85] hover:text-[#526B55] dark:hover:text-[#A8BDA1]"
                >
                  {isExpanded ? (
                    <>
                      <span>Less details</span>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      <span>More details</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              ) : (
                <div />
              )}

              {/* Actions: Edit, Duplicate, Delete */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEditRecord(row)}
                  aria-label="Edit record"
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-[#526B55] dark:text-[#A8BDA1] hover:bg-[#F5F5F0] dark:hover:bg-[#181A17] transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateRecord(row.id)}
                  aria-label="Duplicate record"
                  className="p-1.5 text-xs text-[#8A8E85] hover:text-[#526B55] dark:hover:text-[#A8BDA1] rounded-lg transition-colors"
                  title="Duplicate"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRecord(row.id)}
                  aria-label="Delete row"
                  className="p-1.5 text-xs text-[#8A8E85] hover:text-rose-600 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
