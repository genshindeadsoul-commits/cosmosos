import React from 'react';
import {
  ExternalLink,
  Trash2,
  Copy,
  Edit2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
} from 'lucide-react';
import type { TableCollection, TableColumn, TableRow } from '../../../types';

interface TableGridViewProps {
  table: TableCollection;
  rows: TableRow[];
  sortColumnId: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (colId: string) => void;
  onEditRecord: (row: TableRow) => void;
  onDuplicateRecord: (rowId: string) => void;
  onDeleteRecord: (rowId: string) => void;
  onToggleCheckbox: (rowId: string, colId: string, currentVal: boolean) => void;
  onAddRecordClick: () => void;
}

export const TableGridView: React.FC<TableGridViewProps> = ({
  table,
  rows,
  sortColumnId,
  sortDirection,
  onSort,
  onEditRecord,
  onDuplicateRecord,
  onDeleteRecord,
  onToggleCheckbox,
  onAddRecordClick,
}) => {
  const visibleColumns = table.columns.filter((c) => !c.hidden);

  const renderCellContent = (row: TableRow, col: TableColumn) => {
    const val = row[col.id];

    if (col.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={!!val}
          onChange={() => onToggleCheckbox(row.id, col.id, !!val)}
          aria-label={`${col.name} checkbox`}
          className="h-4 w-4 rounded border-[#DFE1D9] text-[#526B55] focus:ring-[#526B55] cursor-pointer"
        />
      );
    }

    if (col.type === 'select' || col.type === 'status') {
      const statusStr = String(val || '').toUpperCase();
      const isPositive = statusStr === 'CONFIRM' || statusStr === 'COMPLETED' || statusStr === 'DONE' || statusStr === 'ACTIVE';
      const isPending = statusStr === 'PENDING' || statusStr === 'READING' || statusStr === 'IN PROGRESS';
      const isNegative = statusStr === 'CANCEL' || statusStr === 'URGENT' || statusStr === 'FAILED';

      return (
        <span
          className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${
            isPositive
              ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
              : isPending
              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
              : isNegative
              ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
              : 'bg-[#ECEDE7] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F]'
          }`}
        >
          {val ? String(val) : '—'}
        </span>
      );
    }

    if (col.type === 'multi-select') {
      const tags: string[] = Array.isArray(val)
        ? val
        : typeof val === 'string' && val
        ? val.split(',').map((s) => s.trim())
        : [];
      if (tags.length === 0) return <span className="text-[#C9CDC2]">—</span>;

      return (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-[#ECEDE7] dark:bg-[#292D27] px-1.5 py-0.2 text-[10px] font-medium text-[#6B7067] dark:text-[#A6AB9F]"
            >
              {tag}
            </span>
          ))}
        </div>
      );
    }

    if (col.type === 'url' || col.type === 'link') {
      if (!val) return <span className="text-[#C9CDC2]">—</span>;
      return (
        <a
          href={val}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 font-mono text-[11px] text-[#526B55] dark:text-[#A8BDA1] hover:underline"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[150px]">{val}</span>
        </a>
      );
    }

    if (col.type === 'currency') {
      if (val === undefined || val === null || val === '') return <span className="text-[#C9CDC2]">—</span>;
      const num = Number(val);
      const symbol = col.currencySymbol || '₹';
      return (
        <span className="font-mono text-xs font-semibold">
          {symbol}{Number.isFinite(num) ? num.toLocaleString() : val}
        </span>
      );
    }

    if (col.type === 'number') {
      if (val === undefined || val === null || val === '') return <span className="text-[#C9CDC2]">—</span>;
      const num = Number(val);
      return <span className="font-mono text-xs">{Number.isFinite(num) ? num.toLocaleString() : val}</span>;
    }

    return <span>{val !== undefined && val !== null && val !== '' ? String(val) : '—'}</span>;
  };

  return (
    <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] shadow-xs overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 text-[#6B7067] dark:text-[#A6AB9F] font-bold">
              {visibleColumns.map((col) => {
                const isSorted = sortColumnId === col.id;
                return (
                  <th
                    key={col.id}
                    onClick={() => onSort(col.id)}
                    className="py-3 px-4 tracking-wider cursor-pointer select-none hover:bg-[#EAECE6] dark:hover:bg-[#242722] transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.name}</span>
                      {isSorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-[#526B55] dark:text-[#A8BDA1]" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-[#526B55] dark:text-[#A8BDA1]" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 hover:opacity-100 text-[#8A8E85]" />
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="py-3 px-4 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFE1D9] dark:divide-[#383D35] text-[#252821] dark:text-[#ECEDE6]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-xs text-[#8A8E85]">
                  <p className="mb-2">No records match the current search or filters.</p>
                  <button
                    type="button"
                    onClick={onAddRecordClick}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add New Record</span>
                  </button>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors group"
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.id}
                      onDoubleClick={() => onEditRecord(row)}
                      className="py-3 px-4 font-medium"
                    >
                      {renderCellContent(row, col)}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onEditRecord(row)}
                        aria-label="Edit record"
                        className="rounded p-1 text-[#8A8E85] hover:text-[#526B55] dark:hover:text-[#A8BDA1] transition-colors"
                        title="Edit record"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateRecord(row.id)}
                        aria-label="Duplicate record"
                        className="rounded p-1 text-[#8A8E85] hover:text-[#526B55] dark:hover:text-[#A8BDA1] transition-colors"
                        title="Duplicate record"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(row.id)}
                        aria-label="Delete row"
                        className="rounded p-1 text-[#8A8E85] hover:text-rose-500 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
