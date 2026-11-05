import React, { useState, useMemo } from 'react';
import {
  Plus,
  Download,
  Upload,
  LayoutGrid,
  List as ListIcon,
  Kanban,
  MoreHorizontal,
  Search,
  Filter,
  Columns,
  Archive,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toCsv } from '../../lib/csv';
import { CsvImportDialog } from './CsvImportDialog';
import { TableGridView } from './components/TableGridView';
import { TableListView } from './components/TableListView';
import { TableBoardView } from './components/TableBoardView';
import { EmptyTablesState } from './components/EmptyTablesState';
import { TableMenuModal } from './components/TableMenuModal';
import { DeleteTableModal } from './components/DeleteTableModal';
import { DuplicateTableModal } from './components/DuplicateTableModal';
import { RenameTableModal } from './components/RenameTableModal';
import { ColumnManagerModal } from './components/ColumnManagerModal';
import { RecordModal } from './components/RecordModal';
import type { TableCollection, TableColumn, TableRow, NewTable } from '../../types';

export const TablesView: React.FC = () => {
  const {
    tables,
    selectedTableId,
    setSelectedTableId,
    addTableRow,
    addTableRows,
    updateTableRow,
    deleteTableRow,
    duplicateTableRow,
    addTableCollection,
    updateTableCollection,
    deleteTableCollection,
    duplicateTableCollection,
    archiveTableCollection,
    restoreTableCollection,
    showToast,
  } = useApp();

  // Active unarchived tables vs archived tables
  const activeTables = useMemo(() => tables.filter((t) => !t.archived), [tables]);
  const archivedTables = useMemo(() => tables.filter((t) => !!t.archived), [tables]);

  const activeTable = useMemo(() => {
    return tables.find((t) => t.id === selectedTableId) || activeTables[0] || tables[0];
  }, [tables, selectedTableId, activeTables]);

  // View state: 'grid' (spreadsheet), 'list' (cards), 'board' (kanban)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'board'>(
    (activeTable?.metadata?.view as any) || 'grid'
  );

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortColId, setSortColId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TableRow | null>(null);
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableDesc, setNewTableDesc] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [showArchivedList, setShowArchivedList] = useState(false);

  // Find status / select column for filtering
  const statusColumn = useMemo(() => {
    if (!activeTable) return null;
    return (
      activeTable.columns.find((c) => c.type === 'select' || c.type === 'status') ||
      activeTable.columns.find((c) => c.options && c.options.length > 0)
    );
  }, [activeTable]);

  // Filtered & Sorted Rows
  const displayedRows = useMemo(() => {
    if (!activeTable) return [];
    let list = [...activeTable.rows];

    // Status filter
    if (statusFilter !== 'ALL' && statusColumn) {
      list = list.filter((r) => {
        const val = r[statusColumn.id];
        return String(val || '').toUpperCase() === statusFilter.toUpperCase();
      });
    }

    // Global text search across visible cells
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        return activeTable.columns.some((c) => {
          const val = r[c.id];
          if (val === undefined || val === null) return false;
          if (Array.isArray(val)) return val.some((v) => String(v).toLowerCase().includes(q));
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // Sorting
    if (sortColId) {
      const col = activeTable.columns.find((c) => c.id === sortColId);
      list.sort((a, b) => {
        const valA = a[sortColId];
        const valB = b[sortColId];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null || valA === '') return 1;
        if (valB === undefined || valB === null || valB === '') return -1;

        if (col?.type === 'number' || col?.type === 'currency') {
          const numA = Number(valA);
          const numB = Number(valB);
          return sortDir === 'asc' ? numA - numB : numB - numA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return list;
  }, [activeTable, statusFilter, statusColumn, searchQuery, sortColId, sortDir]);

  // Handlers
  const handleSort = (colId: string) => {
    if (sortColId === colId) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortColId(null);
        setSortDir('asc');
      }
    } else {
      setSortColId(colId);
      setSortDir('asc');
    }
  };

  const handleExportCSV = () => {
    if (!activeTable) return;
    const csvContent = toCsv([
      activeTable.columns.map((c) => c.name),
      ...activeTable.rows.map((r) => activeTable.columns.map((c) => r[c.id] ?? '')),
    ]);
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

  const handleOpenAddRecord = () => {
    setEditingRecord(null);
    setIsRecordModalOpen(true);
  };

  const handleOpenEditRecord = (row: TableRow) => {
    setEditingRecord(row);
    setIsRecordModalOpen(true);
  };

  const handleSaveRecord = (tableId: string, rowData: Record<string, any>, rowId?: string) => {
    if (rowId) {
      updateTableRow(tableId, rowId, rowData);
    } else {
      addTableRow(tableId, rowData);
    }
  };

  const handleToggleCheckbox = (rowId: string, colId: string, currentVal: boolean) => {
    if (!activeTable) return;
    const existing = activeTable.rows.find((r) => r.id === rowId);
    if (!existing) return;
    updateTableRow(activeTable.id, rowId, { ...existing, [colId]: !currentVal });
  };

  const handleCreateCustomTable = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTableName.trim();
    if (!name) return;
    addTableCollection({
      name,
      description: newTableDesc.trim() || 'Custom personal database',
      columns: [
        { id: 'index', name: '#', type: 'number' },
        { id: 'name', name: 'Item Name', type: 'text' },
        { id: 'date', name: 'Date', type: 'date' },
        { id: 'status', name: 'Status', type: 'select', options: ['ACTIVE', 'PENDING', 'DONE'] },
      ],
      rows: [],
      metadata: { view: 'table' },
    });
    setNewTableName('');
    setNewTableDesc('');
    setIsNewTableModalOpen(false);
  };

  const handleCreateFromTemplate = (template: NewTable) => {
    addTableCollection(template);
    showToast(`Template "${template.name}" created`, 'success');
  };

  const handleToggleCalendarSync = () => {
    if (!activeTable) return;
    const current = !!activeTable.metadata?.calendarEnabled;
    const dateCol = activeTable.columns.find((c) => c.type === 'date');
    updateTableCollection(activeTable.id, {
      metadata: {
        ...activeTable.metadata,
        calendarEnabled: !current,
        calendarDateFieldId: dateCol?.id,
      },
    });
    showToast(
      !current ? `Calendar sync enabled for ${activeTable.name}` : `Calendar sync disabled`,
      'info'
    );
  };

  // If user has zero tables, render EmptyTablesState
  if (tables.length === 0) {
    return (
      <>
        <EmptyTablesState
          onCreateCustomTable={() => setIsNewTableModalOpen(true)}
          onCreateFromTemplate={handleCreateFromTemplate}
        />

        {/* Create Table Modal */}
        {isNewTableModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Create New Table"
              className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
                <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Create New Table
                </h3>
                <button
                  type="button"
                  onClick={() => setIsNewTableModalOpen(false)}
                  className="text-xs text-[#8A8E85] hover:text-[#252821]"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateCustomTable} className="space-y-3">
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
                    onClick={() => setIsNewTableModalOpen(false)}
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
      </>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 px-3 sm:px-4">
      {/* 1. Header & Table Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <select
              value={activeTable?.id}
              onChange={(e) => {
                setSelectedTableId(e.target.value);
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              aria-label="Select table"
              className="text-lg sm:text-xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6] bg-transparent border-none focus:outline-none cursor-pointer truncate max-w-xs sm:max-w-md"
            >
              {activeTables.map((t) => (
                <option key={t.id} value={t.id} className="bg-white dark:bg-[#20231F] text-sm">
                  {t.name} ({t.rows.length})
                </option>
              ))}
              {archivedTables.length > 0 && (
                <optgroup label="── Archived Tables ──">
                  {archivedTables.map((t) => (
                    <option key={t.id} value={t.id} className="bg-white dark:bg-[#20231F] text-sm italic">
                      📦 {t.name} ({t.rows.length})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* Create New Table Button */}
            <button
              type="button"
              onClick={() => setIsNewTableModalOpen(true)}
              className="rounded-lg p-1.5 text-[#8A8E85] hover:text-[#526B55] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
              title="Create new table"
              aria-label="Create new table"
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Table Context Menu Trigger */}
            {activeTable && (
              <button
                type="button"
                onClick={() => setIsTableMenuOpen(true)}
                className="rounded-lg p-1.5 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
                title="Table actions menu"
                aria-label="Table options menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            )}

            {activeTable?.archived && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                <Archive className="h-3 w-3" />
                <span>Archived</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F] truncate">
            {activeTable?.description || 'Custom database spreadsheet collection'}
          </p>
        </div>

        {/* Toolbar: New Record, Views, Export/Import */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenAddRecord}
            className="flex items-center gap-1.5 rounded-lg bg-[#252821] hover:bg-[#181A17] dark:bg-[#526B55] dark:hover:bg-[#405541] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Record</span>
          </button>

          {/* View Mode Switcher */}
          <div className="flex rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid View"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#252821] dark:bg-[#526B55] text-white shadow-xs'
                  : 'text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
              }`}
            >
              <LayoutGrid className="h-3 w-3" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List View"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#252821] dark:bg-[#526B55] text-white shadow-xs'
                  : 'text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
              }`}
            >
              <ListIcon className="h-3 w-3" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              aria-label="Board View"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                viewMode === 'board'
                  ? 'bg-[#252821] dark:bg-[#526B55] text-white shadow-xs'
                  : 'text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]'
              }`}
            >
              <Kanban className="h-3 w-3" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>

          {/* Manage Columns Button */}
          <button
            type="button"
            onClick={() => setIsColumnManagerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] transition-colors"
            title="Configure columns"
          >
            <Columns className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Columns</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] transition-colors"
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Import CSV */}
          <label className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-2.5 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB] transition-colors cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV</span>
            <input type="file" accept=".csv" onChange={handlePickCSV} className="hidden" />
          </label>
        </div>
      </div>

      {/* 2. Search & Filtering Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A8E85]" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:border-[#526B55]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8E85] hover:text-[#252821]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Pills (if table has select/status column) */}
          {statusColumn && (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`rounded-md px-2 py-1 text-[11px] font-bold tracking-wider transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-[#3D5240] dark:bg-[#526B55] text-white shadow-xs'
                    : 'bg-[#ECEDE7] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#DFE1D9]'
                }`}
              >
                ALL
              </button>
              {(statusColumn.options || ['CONFIRM', 'PENDING', 'CANCEL']).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setStatusFilter(opt)}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold tracking-wider transition-colors ${
                    statusFilter === opt
                      ? 'bg-[#3D5240] dark:bg-[#526B55] text-white shadow-xs'
                      : 'bg-[#ECEDE7] dark:bg-[#292D27] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#DFE1D9]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Record count badge */}
        <div className="text-[11px] font-mono text-[#8A8E85] shrink-0">
          Showing {displayedRows.length} of {activeTable?.rows.length || 0} records
        </div>
      </div>

      {/* 3. Main Records Presentation */}
      {viewMode === 'grid' && activeTable && (
        <TableGridView
          table={activeTable}
          rows={displayedRows}
          sortColumnId={sortColId}
          sortDirection={sortDir}
          onSort={handleSort}
          onEditRecord={handleOpenEditRecord}
          onDuplicateRecord={(rowId) => duplicateTableRow(activeTable.id, rowId)}
          onDeleteRecord={(rowId) => deleteTableRow(activeTable.id, rowId)}
          onToggleCheckbox={(rowId, colId, currentVal) => handleToggleCheckbox(rowId, colId, currentVal)}
          onAddRecordClick={handleOpenAddRecord}
        />
      )}

      {viewMode === 'list' && activeTable && (
        <TableListView
          table={activeTable}
          rows={displayedRows}
          onEditRecord={handleOpenEditRecord}
          onDuplicateRecord={(rowId) => duplicateTableRow(activeTable.id, rowId)}
          onDeleteRecord={(rowId) => deleteTableRow(activeTable.id, rowId)}
          onToggleCheckbox={(rowId, colId, currentVal) => handleToggleCheckbox(rowId, colId, currentVal)}
          onAddRecordClick={handleOpenAddRecord}
        />
      )}

      {viewMode === 'board' && activeTable && (
        <TableBoardView
          table={activeTable}
          rows={displayedRows}
          onEditRecord={handleOpenEditRecord}
          onDeleteRecord={(rowId) => deleteTableRow(activeTable.id, rowId)}
          onChangeRecordStatus={(rowId, colId, nextVal) => {
            const row = activeTable.rows.find((r) => r.id === rowId);
            if (row) updateTableRow(activeTable.id, rowId, { ...row, [colId]: nextVal });
          }}
          onAddRecordToGroup={(colId, val) => {
            addTableRow(activeTable.id, { [colId]: val });
          }}
        />
      )}

      {/* 4. Modals */}
      {/* Table Context Menu */}
      {activeTable && isTableMenuOpen && (
        <TableMenuModal
          isOpen={isTableMenuOpen}
          table={activeTable}
          onClose={() => setIsTableMenuOpen(false)}
          onOpenRename={() => setIsRenameModalOpen(true)}
          onOpenDuplicate={() => setIsDuplicateModalOpen(true)}
          onExportCsv={handleExportCSV}
          onOpenColumnManager={() => setIsColumnManagerOpen(true)}
          onToggleArchive={() => {
            if (activeTable.archived) restoreTableCollection(activeTable.id);
            else archiveTableCollection(activeTable.id);
          }}
          onOpenDelete={() => setIsDeleteModalOpen(true)}
          onToggleCalendarSync={handleToggleCalendarSync}
        />
      )}

      {/* Delete Table Modal */}
      {activeTable && isDeleteModalOpen && (
        <DeleteTableModal
          isOpen={isDeleteModalOpen}
          table={activeTable}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirmDelete={(tableId) => deleteTableCollection(tableId)}
          onArchiveInstead={(tableId) => archiveTableCollection(tableId)}
        />
      )}

      {/* Duplicate Table Modal */}
      {activeTable && isDuplicateModalOpen && (
        <DuplicateTableModal
          isOpen={isDuplicateModalOpen}
          table={activeTable}
          onClose={() => setIsDuplicateModalOpen(false)}
          onConfirmDuplicate={(tableId, includeRows) => duplicateTableCollection(tableId, includeRows)}
        />
      )}

      {/* Rename Table Modal */}
      {activeTable && isRenameModalOpen && (
        <RenameTableModal
          isOpen={isRenameModalOpen}
          table={activeTable}
          onClose={() => setIsRenameModalOpen(false)}
          onSave={(tableId, name, desc) => updateTableCollection(tableId, { name, description: desc })}
        />
      )}

      {/* Column Manager Modal */}
      {activeTable && isColumnManagerOpen && (
        <ColumnManagerModal
          isOpen={isColumnManagerOpen}
          table={activeTable}
          onClose={() => setIsColumnManagerOpen(false)}
          onUpdateColumns={(tableId, newCols) => updateTableCollection(tableId, { columns: newCols })}
        />
      )}

      {/* Add / Edit Record Modal */}
      {activeTable && isRecordModalOpen && (
        <RecordModal
          isOpen={isRecordModalOpen}
          table={activeTable}
          record={editingRecord}
          onClose={() => setIsRecordModalOpen(false)}
          onSave={handleSaveRecord}
        />
      )}

      {/* Create New Table Modal */}
      {isNewTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create New Table"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Create New Table
              </h3>
              <button
                type="button"
                onClick={() => setIsNewTableModalOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateCustomTable} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Table Name <span className="text-rose-500">*</span>
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
                  onClick={() => setIsNewTableModalOpen(false)}
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

      {/* CSV Import Modal */}
      {csvFile && activeTable && (
        <CsvImportDialog
          table={activeTable}
          file={csvFile}
          onCancel={() => setCsvFile(null)}
          onImport={(rows, skipped) => {
            addTableRows(activeTable.id, rows);
            showToast(
              `Imported ${rows.length} row${rows.length === 1 ? '' : 's'}${
                skipped ? `, skipped ${skipped}` : ''
              }`,
              'success'
            );
            setCsvFile(null);
          }}
        />
      )}
    </div>
  );
};
