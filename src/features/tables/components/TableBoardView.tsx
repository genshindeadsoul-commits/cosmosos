import React from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import type { TableCollection, TableRow } from '../../../types';

interface TableBoardViewProps {
  table: TableCollection;
  rows: TableRow[];
  onEditRecord: (row: TableRow) => void;
  onDeleteRecord: (rowId: string) => void;
  onChangeRecordStatus: (rowId: string, colId: string, nextStatus: string) => void;
  onAddRecordToGroup: (colId: string, statusValue: string) => void;
}

export const TableBoardView: React.FC<TableBoardViewProps> = ({
  table,
  rows,
  onEditRecord,
  onDeleteRecord,
  onChangeRecordStatus,
  onAddRecordToGroup,
}) => {
  const visibleColumns = table.columns.filter((c) => !c.hidden);
  const statusCol =
    visibleColumns.find((c) => c.id === table.metadata?.groupByColumnId) ||
    visibleColumns.find((c) => c.type === 'select' || c.type === 'status') ||
    visibleColumns.find((c) => c.options && c.options.length > 0) ||
    table.columns[0];

  const primaryCol = visibleColumns.find((c) => c.type === 'text' && c.id !== 'index') || visibleColumns[0];
  const dateCol = visibleColumns.find((c) => c.type === 'date');

  const columnOptions = statusCol?.options && statusCol.options.length > 0
    ? statusCol.options
    : ['CONFIRM', 'PENDING', 'CANCEL'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[#6B7067] dark:text-[#A6AB9F]">
        <span>
          Grouping by <strong>{statusCol?.name || 'Status'}</strong> ({columnOptions.length} lanes)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
        {columnOptions.map((opt) => {
          const optStr = String(opt);
          const colRows = rows.filter((r) => {
            const val = r[statusCol.id];
            return String(val || '').toUpperCase() === optStr.toUpperCase();
          });

          return (
            <div
              key={optStr}
              className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#F9F9F6] dark:bg-[#1A1C19] p-3 space-y-3 min-h-[220px]"
            >
              {/* Lane Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#DFE1D9] dark:border-[#383D35]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                    {optStr}
                  </span>
                  <span className="text-[10px] font-mono rounded bg-white dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] px-1.5 py-0.5 text-[#6B7067] dark:text-[#A6AB9F]">
                    {colRows.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onAddRecordToGroup(statusCol.id, optStr)}
                  aria-label={`Add to ${optStr}`}
                  className="p-1 rounded text-[#8A8E85] hover:text-[#526B55] hover:bg-white dark:hover:bg-[#20231F] transition-colors"
                  title="Add card"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Lane Cards */}
              <div className="space-y-2">
                {colRows.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-[#8A8E85] border border-dashed border-[#DFE1D9] dark:border-[#383D35] rounded-lg">
                    No records in this lane
                  </div>
                ) : (
                  colRows.map((row) => {
                    const title = row[primaryCol?.id || ''] || `Record #${row.index || ''}`;
                    const dateVal = dateCol ? row[dateCol.id] : null;

                    return (
                      <div
                        key={row.id}
                        className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xs space-y-2 hover:border-[#526B55]/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6] leading-snug">
                            {String(title)}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onEditRecord(row)}
                              className="p-1 text-[#8A8E85] hover:text-[#526B55] rounded"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRecord(row.id)}
                              className="p-1 text-[#8A8E85] hover:text-rose-600 rounded"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {dateVal && (
                          <div className="text-[10px] text-[#8A8E85] font-mono">
                            {dateVal}
                          </div>
                        )}

                        {/* Move status dropdown */}
                        <div className="pt-1 border-t border-[#DFE1D9]/40 dark:border-[#383D35]/40 flex items-center justify-between text-[10px]">
                          <span className="text-[#8A8E85]">Move to:</span>
                          <select
                            value={optStr}
                            onChange={(e) => onChangeRecordStatus(row.id, statusCol.id, e.target.value)}
                            aria-label="Change status"
                            className="text-[10px] py-0.5 px-1.5 rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                          >
                            {columnOptions.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
