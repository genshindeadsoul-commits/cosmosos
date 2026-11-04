import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Edit2,
  PieChart as PieIcon,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Sliders,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePrefs } from '../../context/PrefsContext';
import { addMonthsKey, todayKey } from '../../lib/dates';
import { ExpenseCategory, Transaction, TransactionType } from '../../types';

export const ExpensesView: React.FC = () => {
  const {
    transactions,
    subscriptions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addSubscription,
    deleteSubscription,
  } = useApp();
  const { prefs, setMonthlyBudget } = usePrefs();

  // Active month for budget & overview navigation (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => todayKey().slice(0, 7));
  const [viewScope, setViewScope] = useState<'month' | 'all'>('month');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);

  // New Tx Form state
  const [newTxType, setNewTxType] = useState<TransactionType>('expense');
  const [newTxCat, setNewTxCat] = useState<ExpenseCategory>('Groceries');
  const [newTxTitle, setNewTxTitle] = useState('');
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxAmt, setNewTxAmt] = useState('');
  const [newTxDate, setNewTxDate] = useState(() => todayKey());

  // Edit Tx Form state
  const [editTxType, setEditTxType] = useState<TransactionType>('expense');
  const [editTxCat, setEditTxCat] = useState<ExpenseCategory>('Groceries');
  const [editTxTitle, setEditTxTitle] = useState('');
  const [editTxDesc, setEditTxDesc] = useState('');
  const [editTxAmt, setEditTxAmt] = useState('');
  const [editTxDate, setEditTxDate] = useState('');

  // Budget input state
  const currentBudget = prefs.monthlyBudgets?.[selectedMonth] ?? 0;
  const [budgetInput, setBudgetInput] = useState(() => (currentBudget > 0 ? String(currentBudget) : ''));

  // New Sub Form state
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmt, setNewSubAmt] = useState('');
  const [newSubRenewal, setNewSubRenewal] = useState(addMonthsKey(todayKey(), 1));

  // Helper for shifting months
  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    const nextKey = `${ny}-${nm}`;
    setSelectedMonth(nextKey);
    const b = prefs.monthlyBudgets?.[nextKey] ?? 0;
    setBudgetInput(b > 0 ? String(b) : '');
  };

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Scoped transactions for metrics
  const scopedTransactions = useMemo(() => {
    if (viewScope === 'all') return transactions;
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, viewScope, selectedMonth]);

  // Calculations from actual records
  const totalIncome = useMemo(
    () =>
      scopedTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0),
    [scopedTransactions]
  );

  const totalExpense = useMemo(
    () =>
      scopedTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
    [scopedTransactions]
  );

  const netBalance = totalIncome - totalExpense;

  // Monthly Budget calculations (strict separation per Part 11)
  const isBudgetEnabled = currentBudget > 0;
  const budgetRemaining = currentBudget - totalExpense;
  const budgetUsagePercent = isBudgetEnabled ? (totalExpense / currentBudget) * 100 : 0;
  const isOverBudget = isBudgetEnabled && budgetRemaining < 0;

  const incomeStreamsCount = scopedTransactions.filter((t) => t.type === 'income').length;
  const debitStreamsCount = scopedTransactions.filter((t) => t.type === 'expense').length;

  // Breakdown by category
  const categoryBreakdown = useMemo(() => {
    const expenses = scopedTransactions.filter((t) => t.type === 'expense');
    const catMap: Record<string, number> = {};
    expenses.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });

    const colors: Record<string, string> = {
      Savings: '#38543D',
      Groceries: '#526B55',
      Dining: '#D97706',
      Utilities: '#2563EB',
      Transportation: '#8B5CF6',
      Entertainment: '#EC4899',
      Miscellaneous: '#6B7067',
    };

    return Object.entries(catMap)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percentage: totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0',
        color: colors[cat] || '#8A8E85',
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [scopedTransactions, totalExpense]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (viewScope === 'month' && !t.date.startsWith(selectedMonth)) return false;
      const q = searchQuery.toLowerCase();
      const titleMatch = (t.title?.toLowerCase() ?? '').includes(q);
      const descMatch = (t.description?.toLowerCase() ?? '').includes(q);
      const catMatch = t.category.toLowerCase().includes(q);
      const matchesSearch = !q || titleMatch || descMatch || catMatch;
      const matchesType = filterType === 'all' || t.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [transactions, viewScope, selectedMonth, searchQuery, filterType]);

  const handleAddTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newTxAmt);
    if (isNaN(amt) || amt <= 0 || !newTxTitle.trim()) return;

    addTransaction({
      type: newTxType,
      category: newTxCat,
      title: newTxTitle.trim(),
      description: newTxDesc.trim(),
      amount: amt,
      date: newTxDate || todayKey(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    setNewTxTitle('');
    setNewTxDesc('');
    setNewTxAmt('');
    setIsAddTxOpen(false);
  };

  const handleOpenEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setEditTxType(tx.type);
    setEditTxCat(tx.category);
    setEditTxTitle(tx.title || tx.description || tx.category);
    setEditTxDesc(tx.description || '');
    setEditTxAmt(String(tx.amount));
    setEditTxDate(tx.date);
  };

  const handleEditTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amt = parseFloat(editTxAmt);
    if (isNaN(amt) || amt <= 0 || !editTxTitle.trim()) return;

    updateTransaction({
      ...editingTx,
      type: editTxType,
      category: editTxCat,
      title: editTxTitle.trim(),
      description: editTxDesc.trim(),
      amount: amt,
      date: editTxDate || editingTx.date,
    });

    setEditingTx(null);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(budgetInput);
    if (isNaN(amt) || amt <= 0) {
      setMonthlyBudget(selectedMonth, 0); // 0 or empty disables budget
    } else {
      setMonthlyBudget(selectedMonth, amt);
    }
    setIsBudgetModalOpen(false);
  };

  const handleAddSubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newSubAmt);
    if (isNaN(amt) || amt <= 0 || !newSubName.trim()) return;

    addSubscription({
      name: newSubName.trim(),
      amount: amt,
      billingCycle: 'monthly',
      renewalDate: newSubRenewal,
    });
    setNewSubName('');
    setNewSubAmt('');
    setIsAddSubOpen(false);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Header & Month Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
            Expenses & Ledger
          </h1>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Custom transaction titles, category tracking, and optional monthly budgets
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          {/* Month Navigator */}
          <div className="flex items-center rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] px-1 py-0.5 shadow-xs">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] rounded"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] select-none min-w-[110px] text-center">
              {monthLabel}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] rounded"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Scope Toggle: This Month vs All Time */}
          <div className="flex items-center rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] p-0.5 text-xs font-semibold">
            <button
              onClick={() => setViewScope('month')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewScope === 'month'
                  ? 'bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                  : 'text-[#6B7067] dark:text-[#A6AB9F]'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setViewScope('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewScope === 'all'
                  ? 'bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                  : 'text-[#6B7067] dark:text-[#A6AB9F]'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={() => {
              setBudgetInput(currentBudget > 0 ? String(currentBudget) : '');
              setIsBudgetModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] px-3 py-1.5 text-xs font-bold text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] shadow-xs transition-colors"
          >
            <Sliders className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
            <span>{isBudgetEnabled ? 'Edit Budget' : 'Set Budget'}</span>
          </button>

          <button
            onClick={() => {
              setNewTxDate(todayKey());
              setIsAddTxOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Balance Card */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
            <span>Net Balance</span>
            <CreditCard className="h-4 w-4 text-[#8A8E85]" />
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
            ₹{netBalance.toLocaleString()}
          </div>
          <div className="text-[11px] font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
            Total additions − Total removals
          </div>
        </div>

        {/* Incomes (Additions) */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
            <span>Additions (Income)</span>
            <ArrowUpRight className="h-4 w-4 text-[#477653] dark:text-[#91B594]" />
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-[#477653] dark:text-[#91B594]">
            +₹{totalIncome.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
            {incomeStreamsCount} credit {incomeStreamsCount === 1 ? 'stream' : 'streams'}
          </div>
        </div>

        {/* Expenses (Removals) */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
            <span>Removals (Expenses)</span>
            <ArrowDownLeft className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
            -₹{totalExpense.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
            {debitStreamsCount} debit {debitStreamsCount === 1 ? 'transaction' : 'transactions'}
          </div>
        </div>

        {/* Budget Status Card (Dynamic per Part 11) */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
          {isBudgetEnabled ? (
            <>
              <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                <span>Budget Remaining</span>
                {isOverBudget ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Over budget
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#477653] dark:text-[#91B594]">
                    {budgetUsagePercent.toFixed(1)}% used
                  </span>
                )}
              </div>
              <div
                className={`text-2xl font-extrabold tracking-tight ${
                  isOverBudget ? 'text-rose-600 dark:text-rose-400' : 'text-[#252821] dark:text-[#ECEDE6]'
                }`}
              >
                {budgetRemaining < 0 ? '-' : ''}₹{Math.abs(budgetRemaining).toLocaleString()}
              </div>
              <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] truncate">
                Budget: ₹{currentBudget.toLocaleString()} · Removals: ₹{totalExpense.toLocaleString()}
              </div>
              {/* Visual Spending Progress Bar */}
              <div className="w-full bg-[#E8EEE6] dark:bg-[#2A2E28] h-2 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full transition-all duration-300 ${
                    budgetUsagePercent > 100
                      ? 'bg-rose-500'
                      : budgetUsagePercent > 75
                      ? 'bg-amber-500'
                      : 'bg-[#477653] dark:bg-[#91B594]'
                  }`}
                  style={{ width: `${Math.min(100, budgetUsagePercent)}%` }}
                />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col justify-between py-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                <span>Monthly Budget</span>
                <span className="text-[10px] font-bold text-[#8A8E85]">Disabled</span>
              </div>
              <div className="text-sm font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                No budget configured
              </div>
              <button
                onClick={() => {
                  setBudgetInput('');
                  setIsBudgetModalOpen(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline pt-1"
              >
                <span>+ Set budget for {monthLabel}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Activity Table */}
      <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-xs overflow-hidden">
        <div className="border-b border-[#DFE1D9] dark:border-[#383D35] p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
              Transaction Activity ({filteredTransactions.length})
            </h2>
            <div className="text-[11px] text-[#8A8E85]">
              Showing {viewScope === 'month' ? monthLabel : 'All recorded transactions'}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8A8E85]" />
              <input
                type="text"
                placeholder="Search transaction by title, category, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] pl-8 pr-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
              />
            </div>
            <select
              aria-label="Filter transactions by type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full sm:w-auto rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="income">Incomes Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>
        </div>

        {/* Desktop View: Responsive Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 text-[#6B7067] dark:text-[#A6AB9F] font-bold">
                <th className="py-2.5 px-4">Transaction Title</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Description / Notes</th>
                <th className="py-2.5 px-4">Date & Time</th>
                <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#8A8E85]">
                    No transactions found for this period.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const displayTitle = tx.title || tx.description || tx.category;
                  const displayDesc = tx.title && tx.description ? tx.description : tx.notes || '';
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors group"
                    >
                      <td className="py-2.5 px-4 font-bold text-[#252821] dark:text-[#ECEDE6]">
                        {displayTitle}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="rounded bg-[#F0F1EB] dark:bg-[#292D27] px-2 py-0.5 text-[10px] font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#6B7067] dark:text-[#A6AB9F] max-w-[220px] truncate">
                        {displayDesc || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-[#8A8E85] font-mono text-[11px] whitespace-nowrap">
                        {tx.date} {tx.time || ''}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap ${
                          tx.type === 'income'
                            ? 'text-[#477653] dark:text-[#91B594]'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditTx(tx)}
                            aria-label={`Edit ${displayTitle}`}
                            title="Edit transaction"
                            className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTransaction(tx.id)}
                            aria-label={`Delete ${displayTitle}`}
                            title="Delete transaction"
                            className="p-1 text-[#8A8E85] hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Structured Transaction Cards */}
        <div className="md:hidden divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
          {filteredTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8A8E85]">
              No transactions found for this period.
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const displayTitle = tx.title || tx.description || tx.category;
              const displayDesc = tx.title && tx.description ? tx.description : tx.notes || '';
              return (
                <div
                  key={tx.id}
                  className="p-4 space-y-2 hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-[#252821] dark:text-[#ECEDE6] truncate">
                          {displayTitle}
                        </span>
                        <span className="shrink-0 rounded bg-[#F0F1EB] dark:bg-[#292D27] px-2 py-0.5 text-[10px] font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
                          {tx.category}
                        </span>
                      </div>
                      {displayDesc && (
                        <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] pt-0.5 line-clamp-2">
                          {displayDesc}
                        </p>
                      )}
                    </div>
                    <div
                      className={`font-mono font-bold text-sm shrink-0 whitespace-nowrap ${
                        tx.type === 'income'
                          ? 'text-[#477653] dark:text-[#91B594]'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#DFE1D9]/40 dark:border-[#383D35]/40 text-xs text-[#8A8E85]">
                    <span className="font-mono text-[11px]">
                      {tx.date} {tx.time || ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditTx(tx)}
                        aria-label={`Edit ${displayTitle}`}
                        className="flex items-center justify-center min-w-[36px] min-h-[36px] p-2 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6] rounded-lg hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteTransaction(tx.id)}
                        aria-label={`Delete ${displayTitle}`}
                        className="flex items-center justify-center min-w-[36px] min-h-[36px] p-2 text-[#8A8E85] hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Grid: Expense Breakdown Donut & Subscriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Expense Breakdown Donut */}
        <div className="lg:col-span-7 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#DFE1D9] dark:border-[#383D35]">
            <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
              Expense Breakdown ({monthLabel})
            </span>
            <PieIcon className="h-4 w-4 text-[#8A8E85]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
            {/* SVG Donut Illustration */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center relative">
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-[#ECEDE7] dark:stroke-[#292D27]"
                  strokeWidth="14"
                  fill="transparent"
                />
                {/* Dynamic SVG Segments */}
                {categoryBreakdown.map((item, idx) => {
                  const circumference = 238.76;
                  const itemRatio = totalExpense > 0 ? item.amount / totalExpense : 0;
                  const segmentLength = itemRatio * circumference;
                  const prevLength = categoryBreakdown
                    .slice(0, idx)
                    .reduce(
                      (acc, prev) =>
                        acc + (totalExpense > 0 ? (prev.amount / totalExpense) * circumference : 0),
                      0
                    );

                  return (
                    <circle
                      key={item.category}
                      cx="50"
                      cy="50"
                      r="38"
                      stroke={item.color}
                      strokeWidth="14"
                      strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                      strokeDashoffset={-prevLength}
                      fill="transparent"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-[#8A8E85] font-semibold uppercase">Total</span>
                <span className="text-xs font-extrabold text-[#252821] dark:text-[#ECEDE6]">
                  ₹{totalExpense.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Category breakdown legend */}
            <div className="sm:col-span-7 space-y-2">
              {categoryBreakdown.length === 0 ? (
                <div className="text-xs text-[#8A8E85] py-4 text-center">
                  No expense records in this timeframe.
                </div>
              ) : (
                categoryBreakdown.map((item) => (
                  <div key={item.category} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-[#252821] dark:text-[#ECEDE6]">
                        {item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="font-bold text-[#252821] dark:text-[#ECEDE6]">
                        ₹{item.amount.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-[#8A8E85] w-12 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Subscriptions Card */}
        <div className="lg:col-span-5 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#DFE1D9] dark:border-[#383D35]">
              <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                Subscriptions
              </span>
              <button
                onClick={() => setIsAddSubOpen(true)}
                className="text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
              >
                + Add
              </button>
            </div>

            <div className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
              {subscriptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#8A8E85]">
                  No subscriptions logged yet.
                </div>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="py-2.5 flex items-center justify-between hover:bg-[#F5F5F0]/40 dark:hover:bg-[#292D27]/40 px-1 rounded transition-colors group"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                        {sub.name}
                      </div>
                      <div className="text-[11px] text-[#8A8E85]">
                        Renews {sub.renewalDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#252821] dark:text-[#ECEDE6]">
                        ₹{sub.amount.toLocaleString()}/mo
                      </span>
                      <button
                        onClick={() => deleteSubscription(sub.id)}
                        aria-label="Remove subscription"
                        className="p-1 text-[#8A8E85] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Transaction Modal Dialog */}
      {isAddTxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add Transaction"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                New Transaction
              </h3>
              <button
                onClick={() => setIsAddTxOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddTxSubmit} className="space-y-3">
              {/* Type and Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Type *
                  </label>
                  <select
                    value={newTxType}
                    onChange={(e) => setNewTxType(e.target.value as any)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  >
                    <option value="expense">Expense (- Outflow)</option>
                    <option value="income">Income (+ Inflow)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Amount (₹ INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1500"
                    required
                    value={newTxAmt}
                    onChange={(e) => setNewTxAmt(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Custom Transaction Title (REQUIRED - Part 10) */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Custom Transaction Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly groceries, Electricity bill, Laptop purchase"
                  value={newTxTitle}
                  onChange={(e) => setNewTxTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              {/* Category and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Category *
                  </label>
                  <select
                    value={newTxCat}
                    onChange={(e) => setNewTxCat(e.target.value as ExpenseCategory)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Dining">Dining</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Savings">Savings</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Salary">Salary</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Affiliate">Affiliate</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTxDate}
                    onChange={(e) => setNewTxDate(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              {/* Description / Notes (Optional - Part 10) */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Purchased from local supermarket with 10% discount"
                  value={newTxDesc}
                  onChange={(e) => setNewTxDesc(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal Dialog */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit Transaction"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Edit Transaction
              </h3>
              <button
                onClick={() => setEditingTx(null)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleEditTxSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Type *
                  </label>
                  <select
                    value={editTxType}
                    onChange={(e) => setEditTxType(e.target.value as any)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  >
                    <option value="expense">Expense (- Outflow)</option>
                    <option value="income">Income (+ Inflow)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Amount (₹ INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editTxAmt}
                    onChange={(e) => setEditTxAmt(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Custom Transaction Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTxTitle}
                  onChange={(e) => setEditTxTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Category *
                  </label>
                  <select
                    value={editTxCat}
                    onChange={(e) => setEditTxCat(e.target.value as ExpenseCategory)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Dining">Dining</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Savings">Savings</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Salary">Salary</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Affiliate">Affiliate</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editTxDate}
                    onChange={(e) => setEditTxDate(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Description / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={editTxDesc}
                  onChange={(e) => setEditTxDesc(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Update Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set / Edit Monthly Budget Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Monthly Spending Budget"
            className="w-full max-w-sm rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <div>
                <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Monthly Spending Budget
                </h3>
                <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                  For {monthLabel}
                </p>
              </div>
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Budget Amount (₹ INR)
                </label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="e.g. 20000 (Enter 0 to disable)"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
                <p className="text-[11px] text-[#8A8E85] mt-1">
                  Enter ₹0 or leave empty to disable budget tracking for this month. Transactions are never deleted.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {currentBudget > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMonthlyBudget(selectedMonth, 0);
                      setIsBudgetModalOpen(false);
                    }}
                    className="rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 px-3 py-1.5 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    Disable Budget
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-1.5 text-xs font-bold text-white transition-colors"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subscription Modal Dialog */}
      {isAddSubOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add Subscription"
            className="w-full max-w-md rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
              <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Add Recurring Subscription
              </h3>
              <button
                onClick={() => setIsAddSubOpen(false)}
                className="text-xs text-[#8A8E85] hover:text-[#252821]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddSubSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Notion Pro"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Monthly Cost (₹)
                  </label>
                  <input
                    type="number"
                    value={newSubAmt}
                    onChange={(e) => setNewSubAmt(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Next Renewal Date
                  </label>
                  <input
                    type="date"
                    value={newSubRenewal}
                    onChange={(e) => setNewSubRenewal(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-4 py-2 text-xs font-bold text-white transition-colors"
                >
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
