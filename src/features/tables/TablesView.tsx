import React, { useState, useMemo } from 'react';
import {
  Plus,
  Download,
  Upload,
  LayoutGrid,
  Kanban,
  ExternalLink,
  Trash2,
  Table as TableIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toCsv } from '../../lib/csv';
import { CsvImportDialog } from './CsvImportDialog';

export const TablesView: React.FC = () => {
  const {
    tables,
    selectedTableId,
    setSelectedTableId,
    addTableRow,
    deleteTableRow,
    addTableCollection,
    addTableRows,
    showToast,
  } = useApp();

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [isNewTableOpen, setIsNewTableOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableDesc, setNewTableDesc] = useState('');

  const activeTable = tables.find((t) => t.id === selectedTableId) || tables[0];

  const filteredRows = useMemo(() => {
    if (!activeTable) return [];
    if (statusFilter === 'ALL') return activeTable.rows;
    return activeTable.rows.filter(
      (r) => r.status?.toString().toUpperCase() === statusFilter.toUpperCase()
    );
  }, [activeTable, statusFilter]);

  const handleExportCSV = () => {
    if (!activeTable) return;
    const csvContent = toCsv([activeTable.columns.map((c) => c.name), ...activeTable.rows.map((r) => activeTable.columns.map((c) => r[c.id] ?? ''))]);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTable.name.toLowerCase().replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV export downloaded', 'success');
  };

  const handlePickCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeTable) setCsvFile(file);
    e.target.value = '';
  };

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTable) return;
    addTableRow(activeTable.id, newRowData);
    setNewRowData({});
    setIsAddRecordOpen(false);
  };

  const handleCreateNewTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;
    addTableCollection({
      name: newTableName.trim(),
      description: newTableDesc.trim() || 'Custom spreadsheet collection',
      columns: [
        { id: 'index', name: '#', type: 'number' },
        { id: 'name', name: 'Item Name', type: 'text' },
        { id: 'date', name: 'Date', type: 'date' },
        { id: 'status', name: 'Status', type: 'status', options: ['ACTIVE', 'PENDING', 'DONE'] },
      ],
      rows: [
        { id: `r-${Date.now()}`, index: 1, name: 'Sample Item 1', date: new Date().toISOString().slice(0, 10), status: 'ACTIVE' },
      ],
    });
    setNewTableName('');
    setNewTableDesc('');
    setIsNewTableOpen(false);
  };

  return (
    <>
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Table Selection & Description Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <select
              value={activeTable?.id}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="text-lg sm:text-xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6] bg-transparent border-none focus:outline-none cursor-pointer"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id} className="bg-white dark:bg-[#20231F] text-sm">
                  {t.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsNewTableOpen(true)}
              className="rounded p-1 text-[#8A8E85] hover:text-[#526B55] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
              title="Create new table"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            {activeTable?.description || 'Custom database spreadsheet collection'}
          </p>
        </div>

        {/* Toolbar Buttons matching Screenshot 4 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddRecordOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#252821] hover:bg-[#181A17] dark:bg-[#526B55] dark:hover:bg-[#405541] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Record</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <label className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] transition-colors cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV</span>
            <input type="file" accept=".csv" onChange={handlePickCSV} className="hidden" />
          </label>

          <div className="flex rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#252821] dark:bg-[#526B55] text-white shadow-xs'
                  : 'text-[#8A8E85] hover:text-[#252821]'
              }`}
            >
              <LayoutGrid className="h-3 w-3" />
              <span>Grid View</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-[#252821] dark:bg-[#526B55] text-white shadow-xs'
                  : 'text-[#8A8E85] hover:text-[#252821]'
              }`}
            >
              <Kanban className="h-3 w-3" />
              <span>Kanban View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Status Pills matching Screenshot 4 */}
      <div className="flex items-center gap-2 pt-1 text-xs font-semibold">
        <span className="text-[#8A8E85]">Filter Status:</span>
        {['ALL', 'CONFIRM', 'PENDING', 'CANCEL'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-md px-2.5 py-1 text-xs font-bold tracking-wider transition-colors ${
              statusFilter === status
                ? 'bg-[#3D5240] dark:bg-[#526B55] text-white shadow-xs'
                : 'bg-[#ECEDE7] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#DFE1D9]'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="text-[11px] font-mono text-[#8A8E85]">
        Showing {filteredRows.length} of {activeTable?.rows.length || 0} records
      </div>

      {/* Main Table Container: Grid or Kanban */}
      {viewMode === 'grid' ? (
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-xs overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 text-[#6B7067] dark:text-[#A6AB9F] font-bold">
                  {activeTable?.columns.map((col) => (
                    <th key={col.id} className="py-3 px-4 tracking-wider">
                      {col.name}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE1D9] dark:divide-[#383D35] text-[#252821] dark:text-[#ECEDE6]">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeTable?.columns.length ? activeTable.columns.length + 1 : 4} className="py-8 text-center text-xs text-[#8A8E85]">
                      No records match the current status filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors group"
                    >
                      {activeTable?.columns.map((col) => {
                        const val = row[col.id];
                        if (col.type === 'status') {
                          const statusStr = String(val || '').toUpperCase();
                          const isConfirm = statusStr === 'CONFIRM' || statusStr === 'COMPLETED';
                          const isPending = statusStr === 'PENDING' || statusStr === 'READING';
                          const isCancel = statusStr === 'CANCEL';
                          return (
                            <td key={col.id} className="py-3 px-4">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                                  isConfirm
                                    ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                                    : isPending
                                    ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                    : isCancel
                                    ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                                    : 'bg-[#ECEDE7] text-[#6B7067]'
                                }`}
                              >
                                {statusStr}
                              </span>
                            </td>
                          );
                        }

                        if (col.type === 'link') {
                          return (
                            <td key={col.id} className="py-3 px-4">
                              {val ? (
                                <a
                                  href={val}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 font-mono text-[11px] text-[#526B55] dark:text-[#A8BDA1] hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="truncate max-w-[140px]">{val}</span>
                                </a>
                              ) : (
                                <span className="text-[#C9CDC2]">—</span>
                              )}
                            </td>
                          );
                        }

                        return (
                          <td key={col.id} className="py-3 px-4 font-medium">
                            {val ?? '—'}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => deleteTableRow(activeTable.id, row.id)}
                          aria-label="Delete row"
                          className="rounded p-1 text-[#8A8E85] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['CONFIRM', 'PENDING', 'CANCEL'].map((statusCol) => {
            const columnRows = activeTable?.rows.filter(
              (r) => (r.status || '').toString().toUpperCase() === statusCol
            ) || [];
            return (
              <div
                key={statusCol}
                className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-3 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#DFE1D9] dark:border-[#383D35]">
                  <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                    {statusCol}
                  </span>
                  <span className="text-[10px] font-mono rounded bg-[#ECEDE7] dark:bg-[#292D27] px-1.5 py-0.5 text-[#6B7067] dark:text-[#A6AB9F]">
                    {columnRows.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnRows.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/50 dark:bg-[#181A17]/50 p-2.5 text-xs space-y-1"
                    >
                      <div className="font-bold text-[#252821] dark:text-[#ECEDE6]">
                        {r.name || r.title || `Record #${r.index}`}
                      </div>
                      {r.city && <div className="text-[11px] text-[#6B7067]">{r.city}</div>}
                      {r.date && <div className="text-[10px] text-[#8A8E85]">{r.date}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Record Modal Dialog */}
      {isAddRecordOpen && activeTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add New Record"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Add Record to {activeTable.name}
              </h3>
              <button
                onClick={() => setIsAddRecordOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-3">
              {activeTable.columns
                .filter((c) => c.id !== 'index')
                .map((col) => (
                  <div key={col.id}>
                    <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                      {col.name}
                    </label>
                    {col.type === 'status' ? (
                      <select
                        value={newRowData[col.id] || (col.options ? col.options[0] : 'CONFIRM')}
                        onChange={(e) =>
                          setNewRowData({ ...newRowData, [col.id]: e.target.value })
                        }
                        className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                      >
                        {(col.options || ['CONFIRM', 'PENDING', 'CANCEL']).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                        value={newRowData[col.id] || ''}
                        onChange={(e) =>
                          setNewRowData({ ...newRowData, [col.id]: e.target.value })
                        }
                        placeholder={`Enter ${col.name.toLowerCase()}...`}
                        className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                      />
                    )}
                  </div>
                ))}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Table Modal Dialog */}
      {isNewTableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create New Table"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Create New Table Collection
              </h3>
              <button
                onClick={() => setIsNewTableOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateNewTableSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Table Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Milestones, Inventory..."
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Brief summary of table purpose..."
                  value={newTableDesc}
                  onChange={(e) => setNewTableDesc(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewTableOpen(false)}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white transition-colors"
                >
                  Create Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    {csvFile && activeTable && (
      <CsvImportDialog
        table={activeTable}
        file={csvFile}
        onCancel={() => setCsvFile(null)}
        onImport={(rows, skipped) => {
          addTableRows(activeTable.id, rows);
          showToast(`Imported ${rows.length} row${rows.length === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}`, 'success');
          setCsvFile(null);
        }}
      />
    )}
    </>
  );
};
