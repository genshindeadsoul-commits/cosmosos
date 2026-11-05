import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Trash2,
  Edit2,
  Copy,
  PieChart as PieIcon,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Wallet,
  Building2,
  PiggyBank,
  Smartphone,
  Download,
  Upload,
  Calendar,
  Repeat,
  Target,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePrefs } from '../../context/PrefsContext';
import { todayKey, shiftDayKey } from '../../lib/dates';
import {
  formatCurrency,
  roundCurrency,
  calculateAccountBalances,
  calculateCashFlow,
  calculateBudgetProgress,
  exportTransactionsToCsv,
  getNextRecurringDate,
} from '../../lib/finance';
import { Account, FinanceCategoryMeta, RecurringTransaction, Subscription, Transaction, TransactionType } from '../../types';
import { Modal } from '../../components/common/Modal';
import { AccountManagerModal } from './components/AccountManagerModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { BudgetManagerModal } from './components/BudgetManagerModal';
import { RecurringSubModal } from './components/RecurringSubModal';
import { CsvImportModal } from './components/CsvImportModal';

export const ExpensesView: React.FC = () => {
  const {
    transactions,
    subscriptions,
    addTransaction,
    addTransactions,
    updateTransaction,
    duplicateTransaction,
    deleteTransaction,
    reassignCategory,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    recordSubscriptionPayment,
  } = useApp();

  const {
    prefs,
    setMonthlyBudget,
    setCategoryBudget,
    accounts,
    createAccount,
    updateAccount,
    archiveAccount,
    deleteAccount,
    financeCategories,
    createFinanceCategory,
    updateFinanceCategory,
    deleteFinanceCategory,
    recurringTransactions,
    createRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    toggleRecurringStatus,
  } = usePrefs();

  // Navigation & View State
  const [selectedMonth, setSelectedMonth] = useState(() => todayKey().slice(0, 7));
  const [viewScope, setViewScope] = useState<'month' | 'all'>('month');
  const [activeTab, setActiveTab] = useState<'transactions' | 'accounts' | 'budgets' | 'recurring' | 'analytics'>('transactions');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Modal Open States
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isRecurringSubOpen, setIsRecurringSubOpen] = useState(false);
  const [recurringSubMode, setRecurringSubMode] = useState<'recurring' | 'subscription'>('recurring');
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);

  // New Transaction Form State (with Mandatory Title)
  const [newTxTitle, setNewTxTitle] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxType, setNewTxType] = useState<TransactionType>('expense');
  const [newTxCategory, setNewTxCategory] = useState('Groceries');
  const [newTxAccount, setNewTxAccount] = useState(() => accounts[0]?.name || 'Bank account');
  const [newTxTransferAccount, setNewTxTransferAccount] = useState(() => accounts[1]?.name || 'Cash');
  const [newTxDate, setNewTxDate] = useState(() => todayKey());
  const [newTxNotes, setNewTxNotes] = useState('');
  const [newTxTags, setNewTxTags] = useState('');

  // Edit Transaction Form State
  const [editTxTitle, setEditTxTitle] = useState('');
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxType, setEditTxType] = useState<TransactionType>('expense');
  const [editTxCategory, setEditTxCategory] = useState('Groceries');
  const [editTxAccount, setEditTxAccount] = useState('Bank account');
  const [editTxTransferAccount, setEditTxTransferAccount] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxNotes, setEditTxNotes] = useState('');

  // Shift month helper
  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${ny}-${nm}`);
  };

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Account Balances Reconciled
  const accountBalances = useMemo(() => {
    return calculateAccountBalances(accounts, transactions);
  }, [accounts, transactions]);

  // Total Net Worth across all non-archived accounts
  const totalNetWorth = useMemo(() => {
    return accounts
      .filter((a) => !a.isArchived)
      .reduce((sum, a) => roundCurrency(sum + (accountBalances[a.name] || 0)), 0);
  }, [accounts, accountBalances]);

  // Scoped Transactions for Current View
  const scopedTransactions = useMemo(() => {
    if (viewScope === 'all') return transactions;
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, viewScope, selectedMonth]);

  // Cash Flow Calculations (Transfers strictly excluded from income/expense)
  const cashFlow = useMemo(() => {
    return calculateCashFlow(scopedTransactions);
  }, [scopedTransactions]);

  // Monthly Budget (strictly scoped to selectedMonth)
  const currentMonthlyBudget = prefs.monthlyBudgets?.[selectedMonth] ?? 0;
  const currentCategoryBudgets = prefs.categoryBudgets?.[selectedMonth] ?? {};

  // Monthly Expense strictly for selectedMonth
  const monthlyExpense = useMemo(() => {
    return transactions
      .filter((t) => t.date.startsWith(selectedMonth) && t.type === 'expense')
      .reduce((sum, t) => roundCurrency(sum + t.amount), 0);
  }, [transactions, selectedMonth]);

  const budgetProgress = useMemo(() => {
    return calculateBudgetProgress(currentMonthlyBudget, monthlyExpense);
  }, [currentMonthlyBudget, monthlyExpense]);

  // Filtered & Sorted Transactions for Ledger List
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qNum = parseFloat(searchQuery.replace(/[^0-9.]/g, ''));

    return scopedTransactions
      .filter((t) => {
        // Search query
        if (q) {
          const titleMatch = (t.title || '').toLowerCase().includes(q);
          const descMatch = (t.description || '').toLowerCase().includes(q);
          const catMatch = (t.category || '').toLowerCase().includes(q);
          const notesMatch = (t.notes || '').toLowerCase().includes(q);
          const accMatch = (t.account || '').toLowerCase().includes(q);
          const amountMatch = Number.isFinite(qNum) && t.amount === qNum;
          if (!titleMatch && !descMatch && !catMatch && !notesMatch && !accMatch && !amountMatch) {
            return false;
          }
        }

        // Type filter
        if (filterType !== 'all' && t.type !== filterType) return false;

        // Category filter
        if (filterCategory !== 'all' && t.category !== filterCategory) return false;

        // Account filter
        if (filterAccount !== 'all' && t.account !== filterAccount && t.transferAccount !== filterAccount) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '');
        }
        if (sortBy === 'date-asc') {
          return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '');
        }
        if (sortBy === 'amount-desc') {
          return b.amount - a.amount;
        }
        if (sortBy === 'amount-asc') {
          return a.amount - b.amount;
        }
        return 0;
      });
  }, [scopedTransactions, searchQuery, filterType, filterCategory, filterAccount, sortBy]);

  // Category breakdown for analytics
  const categoryBreakdown = useMemo(() => {
    const expenses = scopedTransactions.filter((t) => t.type === 'expense');
    const catMap: Record<string, number> = {};
    expenses.forEach((e) => {
      catMap[e.category] = roundCurrency((catMap[e.category] || 0) + e.amount);
    });

    return Object.entries(catMap)
      .map(([cat, amount]) => {
        const meta = financeCategories.find((c) => c.name === cat);
        return {
          category: cat,
          amount,
          color: meta?.color || '#526B55',
          percentage: cashFlow.expense > 0 ? ((amount / cashFlow.expense) * 100).toFixed(1) : '0',
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [scopedTransactions, cashFlow.expense, financeCategories]);

  // Form Handlers
  const handleOpenAddTx = (defaultType: TransactionType = 'expense') => {
    setNewTxType(defaultType);
    setNewTxTitle('');
    setNewTxAmount('');
    setNewTxCategory(defaultType === 'income' ? 'Salary' : defaultType === 'transfer' ? 'Transfer' : 'Groceries');
    setNewTxAccount(accounts[0]?.name || 'Bank account');
    setNewTxTransferAccount(accounts[1]?.name || 'Cash');
    setNewTxDate(todayKey());
    setNewTxNotes('');
    setNewTxTags('');
    setIsAddTxOpen(true);
  };

  const handleAddTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newTxAmount);
    if (!newTxTitle.trim() || !amt || amt <= 0) return;

    addTransaction({
      title: newTxTitle.trim(),
      description: newTxTitle.trim(),
      type: newTxType,
      category: newTxCategory,
      amount: roundCurrency(amt),
      account: newTxAccount,
      transferAccount: newTxType === 'transfer' ? newTxTransferAccount : undefined,
      date: newTxDate || todayKey(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      notes: newTxNotes.trim() || undefined,
      tags: newTxTags
        ? newTxTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    });

    setIsAddTxOpen(false);
  };

  const handleOpenEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setEditTxTitle(tx.title || tx.description || tx.category);
    setEditTxAmount(String(tx.amount));
    setEditTxType(tx.type);
    setEditTxCategory(tx.category);
    setEditTxAccount(tx.account || 'Bank account');
    setEditTxTransferAccount(tx.transferAccount || '');
    setEditTxDate(tx.date);
    setEditTxNotes(tx.notes || '');
  };

  const handleEditTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amt = parseFloat(editTxAmount);
    if (!editTxTitle.trim() || !amt || amt <= 0) return;

    updateTransaction({
      ...editingTx,
      title: editTxTitle.trim(),
      description: editTxTitle.trim(),
      type: editTxType,
      category: editTxCategory,
      amount: roundCurrency(amt),
      account: editTxAccount,
      transferAccount: editTxType === 'transfer' ? editTxTransferAccount : undefined,
      date: editTxDate || editingTx.date,
      notes: editTxNotes.trim() || undefined,
    });

    setEditingTx(null);
  };

  // CSV Export
  const handleExportCsv = () => {
    const csvData = exportTransactionsToCsv(filteredTransactions);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cosmos_transactions_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Account Transfer
  const handleTransferFunds = (tx: {
    fromAccount: string;
    toAccount: string;
    amount: number;
    title: string;
    date: string;
    notes?: string;
  }) => {
    addTransaction({
      title: tx.title,
      description: tx.title,
      type: 'transfer',
      category: 'Transfer',
      amount: roundCurrency(tx.amount),
      account: tx.fromAccount,
      transferAccount: tx.toAccount,
      date: tx.date,
      notes: tx.notes,
    });
  };

  // Post Recurring Transaction Now
  const handlePostRecurring = (rec: RecurringTransaction) => {
    const today = todayKey();
    addTransaction({
      title: rec.title,
      description: rec.notes || `${rec.title} (${rec.frequency})`,
      type: rec.type,
      category: rec.category,
      amount: rec.amount,
      account: rec.account,
      transferAccount: rec.transferAccount,
      date: today,
      notes: `Recurring ${rec.frequency} transaction`,
    });

    // Advance next due date
    const nextDate = getNextRecurringDate(rec.nextDueDate || today, rec.frequency, rec.interval);
    updateRecurringTransaction(rec.id, {
      nextDueDate: nextDate,
      lastGeneratedDate: today,
    });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 animate-in fade-in duration-150">
      {/* 1. Header & Financial Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1D9] dark:border-[#383D35] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
              Expenses & Ledger
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#526B55]/15 text-[#38543D] dark:text-[#A8BDA1]">
              Phase 5
            </span>
          </div>
          <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F] mt-0.5">
            Calm personal cash flow, account reconciliation, budgets, and subscriptions
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleOpenAddTx('expense')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAccountsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
          >
            <Wallet className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
            <span>Accounts ({accounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCategoriesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
          >
            <Sliders className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
            <span>Categories</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBudgetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
          >
            <Target className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
            <span>Budgets</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCsvImportOpen(true)}
            title="Import CSV"
            className="p-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
          >
            <Upload className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            title="Export CSV"
            className="p-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. Month Selector & Financial Overview Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white dark:bg-[#20231F] border border-[#DFE1D9] dark:border-[#383D35] rounded-lg p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-1 rounded text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                {viewScope === 'month' ? monthLabel : 'All Recorded Time'}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1 rounded text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center bg-[#F5F5F0] dark:bg-[#181A17] p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setViewScope('month')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  viewScope === 'month'
                    ? 'bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                    : 'text-[#8A8E85]'
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  viewScope === 'all'
                    ? 'bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6] shadow-xs'
                    : 'text-[#8A8E85]'
                }`}
              >
                All Time
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'transactions', label: 'Ledger' },
              { id: 'accounts', label: 'Accounts' },
              { id: 'budgets', label: 'Budgets' },
              { id: 'recurring', label: 'Recurring & Subs' },
              { id: 'analytics', label: 'Reports' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-[#526B55] text-white shadow-xs'
                    : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#20231F]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Income */}
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
              <span>Total Inflow</span>
            </div>
            <div className="text-base sm:text-lg font-extrabold text-[#252821] dark:text-[#ECEDE6] mt-1 font-mono">
              {formatCurrency(cashFlow.income)}
            </div>
            <div className="text-[10px] text-[#8A8E85] mt-0.5">
              {scopedTransactions.filter((t) => t.type === 'income').length} deposits
            </div>
          </div>

          {/* Expenses */}
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
              <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
              <span>Total Outflow</span>
            </div>
            <div className="text-base sm:text-lg font-extrabold text-[#252821] dark:text-[#ECEDE6] mt-1 font-mono">
              {formatCurrency(cashFlow.expense)}
            </div>
            <div className="text-[10px] text-[#8A8E85] mt-0.5">
              {scopedTransactions.filter((t) => t.type === 'expense').length} debits
            </div>
          </div>

          {/* Net Cash Flow */}
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
              <Wallet className="h-3.5 w-3.5 text-[#526B55] dark:text-[#A8BDA1]" />
              <span>Net Cash Flow</span>
            </div>
            <div
              className={`text-base sm:text-lg font-extrabold mt-1 font-mono ${
                cashFlow.net >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {cashFlow.net >= 0 ? '+' : ''}
              {formatCurrency(cashFlow.net)}
            </div>
            <div className="text-[10px] text-[#8A8E85] mt-0.5">
              {cashFlow.transferCount > 0 ? `${cashFlow.transferCount} transfers excluded` : 'Income minus expenses'}
            </div>
          </div>

          {/* Budget Remaining */}
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
              <Target className="h-3.5 w-3.5 text-blue-500" />
              <span>Budget Remaining</span>
            </div>
            <div className="text-base sm:text-lg font-extrabold text-[#252821] dark:text-[#ECEDE6] mt-1 font-mono">
              {currentMonthlyBudget > 0 ? formatCurrency(budgetProgress.remaining) : '—'}
            </div>
            <div className="text-[10px] text-[#8A8E85] mt-0.5">
              {currentMonthlyBudget > 0 ? `${budgetProgress.percent}% of budget used` : 'No budget set'}
            </div>
          </div>

          {/* Total Net Worth */}
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
              <PiggyBank className="h-3.5 w-3.5 text-amber-500" />
              <span>Total Net Worth</span>
            </div>
            <div className="text-base sm:text-lg font-extrabold text-[#252821] dark:text-[#ECEDE6] mt-1 font-mono">
              {formatCurrency(totalNetWorth)}
            </div>
            <div className="text-[10px] text-[#8A8E85] mt-0.5">
              Across {accounts.filter((a) => !a.isArchived).length} active accounts
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: LEDGER & TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8A8E85]" />
                <input
                  type="text"
                  placeholder="Search title, amount, account, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                />
              </div>

              {/* Filter Selectors */}
              <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                {/* Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  aria-label="Filter transactions by type"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  <option value="all">All Types</option>
                  <option value="expense">Expenses Only</option>
                  <option value="income">Income Only</option>
                  <option value="transfer">Transfers Only</option>
                </select>

                {/* Category Filter */}
                <div className="flex items-center gap-1">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    aria-label="Filter transactions by category"
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                  >
                    <option value="all">All Categories</option>
                    {financeCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {filterCategory !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setFilterCategory('all')}
                      aria-label="Clear category filter"
                      className="p-1 rounded text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Account Filter */}
                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  aria-label="Filter transactions by account"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  <option value="all">All Accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>

                {/* Sort By */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Sort transactions"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="amount-desc">Highest Amount</option>
                  <option value="amount-asc">Lowest Amount</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transactions Table / List */}
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] shadow-xs overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <Wallet className="h-8 w-8 text-[#8A8E85] mx-auto mb-2 opacity-50" />
                <h3 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                  No transactions recorded
                </h3>
                <p className="text-xs text-[#8A8E85] mt-1">
                  {searchQuery || filterType !== 'all' || filterCategory !== 'all'
                    ? 'No transactions matched your search filters.'
                    : 'Click "Add Transaction" to record your first income, expense, or transfer.'}
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenAddTx('expense')}
                  className="mt-3 px-3 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
                >
                  + Add Transaction
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 text-[#6B7067] dark:text-[#A6AB9F] uppercase tracking-wider font-semibold text-[10px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Title / Description</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFE1D9]/70 dark:divide-[#383D35]/70">
                    {filteredTransactions.map((tx) => {
                      const displayTitle = tx.title || tx.description || tx.category;
                      const isIncome = tx.type === 'income';
                      const isTransfer = tx.type === 'transfer';

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-[#F5F5F0]/40 dark:hover:bg-[#292D27]/40 transition-colors"
                        >
                          {/* Date */}
                          <td className="py-2.5 px-3 font-mono text-[#6B7067] dark:text-[#A6AB9F] whitespace-nowrap">
                            {tx.date}
                            {tx.time && <span className="text-[10px] text-[#8A8E85] block">{tx.time}</span>}
                          </td>

                          {/* Custom Title & Notes */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#252821] dark:text-[#ECEDE6]">
                              {displayTitle}
                            </div>
                            {tx.notes && (
                              <div className="text-[10px] text-[#8A8E85] line-clamp-1">
                                {tx.notes}
                              </div>
                            )}
                          </td>

                          {/* Category Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F5F0] dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6] border border-[#DFE1D9] dark:border-[#383D35]">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    financeCategories.find((c) => c.name === tx.category)?.color || '#526B55',
                                }}
                              />
                              <span>{tx.category}</span>
                            </span>
                          </td>

                          {/* Account Pill */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-[#6B7067] dark:text-[#A6AB9F]">
                            {isTransfer ? (
                              <span className="flex items-center gap-1 font-semibold text-[11px]">
                                <span>{tx.account || 'Bank account'}</span>
                                <ArrowRightLeft className="h-3 w-3 text-[#8A8E85]" />
                                <span>{tx.transferAccount || 'Cash'}</span>
                              </span>
                            ) : (
                              <span className="text-[11px]">{tx.account || 'Bank account'}</span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span
                              className={`font-mono font-bold ${
                                isIncome
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isTransfer
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-[#252821] dark:text-[#ECEDE6]'
                              }`}
                            >
                              {isIncome ? '+' : isTransfer ? '⇄ ' : '-'}
                              {formatCurrency(tx.amount)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditTx(tx)}
                                aria-label={`Edit ${displayTitle}`}
                                className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => duplicateTransaction(tx.id)}
                                aria-label={`Duplicate ${displayTitle}`}
                                className="p-1 text-[#8A8E85] hover:text-[#526B55] dark:hover:text-[#A8BDA1]"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete transaction "${displayTitle}"?`)) {
                                    deleteTransaction(tx.id);
                                  }
                                }}
                                aria-label={`Delete ${displayTitle}`}
                                className="p-1 text-[#8A8E85] hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Managed Accounts ({accounts.length})
              </h2>
              <p className="text-xs text-[#8A8E85]">
                Balances automatically reconcile with income, expenses, and inter-account transfers
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAccountsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add / Manage Accounts</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const balance = accountBalances[acc.name] ?? acc.openingBalance ?? 0;
              const accTxCount = transactions.filter((t) => t.account === acc.name || t.transferAccount === acc.name).length;

              return (
                <div
                  key={acc.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                    acc.isArchived
                      ? 'opacity-60 bg-gray-50 dark:bg-gray-900/30 border-dashed border-gray-300 dark:border-gray-700'
                      : 'bg-white dark:bg-[#20231F] border-[#DFE1D9] dark:border-[#383D35] shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: acc.color || '#2563EB' }}
                      >
                        <Wallet className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[#252821] dark:text-[#ECEDE6]">
                          {acc.name}
                        </div>
                        <div className="text-[10px] text-[#8A8E85] uppercase tracking-wider font-semibold">
                          {acc.type}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#DFE1D9]/60 dark:border-[#383D35]/60 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] text-[#8A8E85]">Opening: {formatCurrency(acc.openingBalance)}</div>
                      <div className="text-[10px] text-[#8A8E85]">{accTxCount} transactions</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-[#8A8E85]">Current Balance</div>
                      <div className="font-mono font-extrabold text-base text-[#252821] dark:text-[#ECEDE6]">
                        {formatCurrency(balance)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: BUDGETS */}
      {activeTab === 'budgets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                Budget Management ({monthLabel})
              </h2>
              <p className="text-xs text-[#8A8E85]">
                Calm spending targets with category limits and non-punitive visual progress
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBudgetOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
            >
              <Target className="h-3.5 w-3.5" />
              <span>Configure Limits</span>
            </button>
          </div>

          {/* Overall Monthly Budget Card */}
          <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Monthly Spending Cap
                </div>
                <div className="text-sm sm:text-base font-extrabold font-mono text-[#252821] dark:text-[#ECEDE6] mt-0.5">
                  {currentMonthlyBudget > 0 ? formatCurrency(currentMonthlyBudget) : 'No total budget set'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#8A8E85]">Total Spent: <strong>{formatCurrency(monthlyExpense)}</strong></div>
                <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {currentMonthlyBudget > 0
                    ? budgetProgress.remaining >= 0
                      ? `${formatCurrency(budgetProgress.remaining)} remaining`
                      : `${formatCurrency(Math.abs(budgetProgress.remaining))} over budget`
                    : ''}
                </div>
              </div>
            </div>

            {currentMonthlyBudget > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                  <span>Progress: {budgetProgress.percent}%</span>
                  <span>{formatCurrency(monthlyExpense)} / {formatCurrency(currentMonthlyBudget)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E5E7EB] dark:bg-[#383D35] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      budgetProgress.isOver
                        ? 'bg-rose-500'
                        : budgetProgress.percent > 85
                        ? 'bg-amber-500'
                        : 'bg-[#526B55]'
                    }`}
                    style={{ width: `${Math.min(100, budgetProgress.percent)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Category Budgets Grid */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7067] dark:text-[#A6AB9F]">
              Category Limits
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {financeCategories
                .filter((c) => c.type === 'expense' || c.type === 'both')
                .map((cat) => {
                  const spent = scopedTransactions
                    .filter((t) => t.category === cat.name && t.type === 'expense')
                    .reduce((sum, t) => roundCurrency(sum + t.amount), 0);
                  const limit = currentCategoryBudgets[cat.name] || 0;
                  const progress = calculateBudgetProgress(limit, spent);

                  return (
                    <div
                      key={cat.id}
                      className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3.5 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.color || '#526B55' }}
                          />
                          <span className="font-bold text-xs text-[#252821] dark:text-[#ECEDE6]">
                            {cat.name}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-xs text-[#252821] dark:text-[#ECEDE6]">
                          {formatCurrency(spent)} {limit > 0 ? `/ ${formatCurrency(limit)}` : ''}
                        </span>
                      </div>

                      {limit > 0 ? (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-[#8A8E85]">
                            <span>{progress.percent}%</span>
                            <span className={progress.isOver ? 'text-rose-600 font-bold' : ''}>
                              {progress.remaining >= 0
                                ? `${formatCurrency(progress.remaining)} remaining`
                                : `${formatCurrency(Math.abs(progress.remaining))} over limit`}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#383D35] overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                progress.isOver
                                  ? 'bg-rose-500'
                                  : progress.percent > 85
                                  ? 'bg-amber-500'
                                  : 'bg-[#526B55]'
                              }`}
                              style={{ width: `${Math.min(100, progress.percent)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-[#8A8E85]">No specific limit configured</div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RECURRING & SUBSCRIPTIONS */}
      {activeTab === 'recurring' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Subscriptions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Active Subscriptions ({subscriptions.length})
                </h2>
                <p className="text-[11px] text-[#8A8E85]">
                  Track renewal dates and record payments without creating duplicates
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingSubscription(null);
                  setRecurringSubMode('subscription');
                  setIsRecurringSubOpen(true);
                }}
                className="flex items-center gap-1 text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Subscription</span>
              </button>
            </div>

            <div className="space-y-2">
              {subscriptions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DFE1D9] dark:border-[#383D35] p-6 text-center text-xs text-[#8A8E85]">
                  No subscriptions recorded. Add Netflix, Spotify, cloud storage, etc.
                </div>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#252821] dark:text-[#ECEDE6]">
                        {sub.name}
                      </div>
                      <div className="text-[10px] text-[#8A8E85] flex items-center gap-1.5 mt-0.5">
                        <span className="capitalize">{sub.billingCycle}</span>
                        <span>•</span>
                        <span>Renews: <strong>{sub.renewalDate}</strong></span>
                        {sub.account && (
                          <>
                            <span>•</span>
                            <span>{sub.account}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-mono font-bold text-xs text-[#252821] dark:text-[#ECEDE6]">
                          {formatCurrency(sub.amount)}
                        </div>
                        <div className="text-[9px] uppercase font-semibold text-[#8A8E85]">
                          {sub.billingCycle}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => recordSubscriptionPayment(sub.id)}
                        className="px-2 py-1 text-[11px] font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-md shadow-xs whitespace-nowrap"
                      >
                        Record Payment
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubscription(sub);
                          setRecurringSubMode('subscription');
                          setIsRecurringSubOpen(true);
                        }}
                        aria-label={`Edit subscription ${sub.name}`}
                        className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete subscription "${sub.name}"?`)) {
                            deleteSubscription(sub.id);
                          }
                        }}
                        aria-label={`Delete subscription ${sub.name}`}
                        className="p-1 text-[#8A8E85] hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recurring Transactions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Recurring Commitments ({recurringTransactions.length})
                </h2>
                <p className="text-[11px] text-[#8A8E85]">
                  Scheduled transactions that you can post with one click when due
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingRecurring(null);
                  setRecurringSubMode('recurring');
                  setIsRecurringSubOpen(true);
                }}
                className="flex items-center gap-1 text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Recurring</span>
              </button>
            </div>

            <div className="space-y-2">
              {recurringTransactions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DFE1D9] dark:border-[#383D35] p-6 text-center text-xs text-[#8A8E85]">
                  No recurring rules set. Add rent, salary, SIP, electricity, etc.
                </div>
              ) : (
                recurringTransactions.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3 shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#252821] dark:text-[#ECEDE6]">
                          {rec.title}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                            rec.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#8A8E85] flex items-center gap-1.5 mt-0.5">
                        <span className="capitalize">{rec.frequency}</span>
                        <span>•</span>
                        <span>Next due: <strong>{rec.nextDueDate}</strong></span>
                        <span>•</span>
                        <span>{rec.account}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#252821] dark:text-[#ECEDE6]">
                        {formatCurrency(rec.amount)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handlePostRecurring(rec)}
                        title="Post this transaction now"
                        className="px-2 py-1 text-[11px] font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-md shadow-xs whitespace-nowrap"
                      >
                        Post Now
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleRecurringStatus(rec.id)}
                        aria-label={`Toggle pause ${rec.title}`}
                        className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]"
                      >
                        {rec.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecurring(rec);
                          setRecurringSubMode('recurring');
                          setIsRecurringSubOpen(true);
                        }}
                        aria-label={`Edit recurring ${rec.title}`}
                        className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete recurring rule "${rec.title}"?`)) {
                            deleteRecurringTransaction(rec.id);
                          }
                        }}
                        aria-label={`Delete recurring ${rec.title}`}
                        className="p-1 text-[#8A8E85] hover:text-rose-600"
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
      )}

      {/* TAB 5: REPORTS & ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Spending Breakdown */}
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6] flex items-center gap-1.5">
                <PieIcon className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                <span>Spending by Category ({monthLabel})</span>
              </h3>

              {categoryBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8A8E85]">
                  No expense records found for this period.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {categoryBreakdown.map((item) => (
                    <div key={item.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-[#252821] dark:text-[#ECEDE6]">
                          {item.category}
                        </span>
                        <span className="font-mono text-[#6B7067] dark:text-[#A6AB9F]">
                          {formatCurrency(item.amount)} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E5E7EB] dark:bg-[#383D35] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Income vs Expense Balance */}
            <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#252821] dark:text-[#ECEDE6] flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
                <span>Cash Flow Distribution</span>
              </h3>

              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#6B7067] dark:text-[#A6AB9F]">Total Inflow</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(cashFlow.income)}
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-emerald-100 dark:bg-emerald-950/30 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#6B7067] dark:text-[#A6AB9F]">Total Outflow</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(cashFlow.expense)}
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-rose-100 dark:bg-rose-950/30 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{
                        width: `${cashFlow.income > 0 ? Math.min(100, (cashFlow.expense / cashFlow.income) * 100) : 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 text-xs flex justify-between items-center">
                  <span className="font-bold text-[#252821] dark:text-[#ECEDE6]">Net Position</span>
                  <span
                    className={`font-mono font-extrabold text-sm ${
                      cashFlow.net >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {cashFlow.net >= 0 ? '+' : ''}{formatCurrency(cashFlow.net)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODALS */}

      {/* Add Transaction Modal (with Mandatory Title) */}
      <Modal
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
        title="Record Transaction"
        maxWidth="md"
      >
        <form onSubmit={handleAddTxSubmit} className="space-y-3.5">
          {/* Transaction Type Buttons */}
          <div className="flex items-center gap-2">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setNewTxType(t);
                  if (t === 'transfer') setNewTxCategory('Transfer');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize border ${
                  newTxType === t
                    ? t === 'income'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : t === 'transfer'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-[#526B55] text-white border-[#526B55]'
                    : 'border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Mandatory Custom Title */}
          <div>
            <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
              Transaction Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. DMart groceries, Petrol for scooter, Electricity bill"
              value={newTxTitle}
              onChange={(e) => setNewTxTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={newTxAmount}
                onChange={(e) => setNewTxAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={newTxDate}
                onChange={(e) => setNewTxDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                {newTxType === 'transfer' ? 'From Account' : 'Account'}
              </label>
              <select
                value={newTxAccount}
                onChange={(e) => setNewTxAccount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {newTxType === 'transfer' ? (
              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  To Account
                </label>
                <select
                  value={newTxTransferAccount}
                  onChange={(e) => setNewTxTransferAccount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  {accounts.filter((a) => a.name !== newTxAccount).map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  Category
                </label>
                <select
                  value={newTxCategory}
                  onChange={(e) => setNewTxCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  {financeCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid via GooglePay, voucher used"
              value={newTxNotes}
              onChange={(e) => setNewTxNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
            <button
              type="button"
              onClick={() => setIsAddTxOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        title="Edit Transaction"
        maxWidth="md"
      >
        <form onSubmit={handleEditTxSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
              Transaction Title *
            </label>
            <input
              type="text"
              required
              value={editTxTitle}
              onChange={(e) => setEditTxTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={editTxAmount}
                onChange={(e) => setEditTxAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={editTxDate}
                onChange={(e) => setEditTxDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Account
              </label>
              <select
                value={editTxAccount}
                onChange={(e) => setEditTxAccount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Category
              </label>
              <select
                value={editTxCategory}
                onChange={(e) => setEditTxCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                {financeCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={editTxNotes}
              onChange={(e) => setEditTxNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
            <button
              type="button"
              onClick={() => setEditingTx(null)}
              className="px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
            >
              Update Transaction
            </button>
          </div>
        </form>
      </Modal>

      {/* Account Manager Modal */}
      <AccountManagerModal
        isOpen={isAccountsOpen}
        onClose={() => setIsAccountsOpen(false)}
        accounts={accounts}
        balances={accountBalances}
        onCreateAccount={createAccount}
        onUpdateAccount={updateAccount}
        onArchiveAccount={archiveAccount}
        onDeleteAccount={deleteAccount}
        onTransfer={handleTransferFunds}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        categories={financeCategories}
        transactions={transactions}
        onCreateCategory={createFinanceCategory}
        onUpdateCategory={updateFinanceCategory}
        onDeleteCategory={deleteFinanceCategory}
        onReassignCategory={reassignCategory}
      />

      {/* Budget Manager Modal */}
      <BudgetManagerModal
        isOpen={isBudgetOpen}
        onClose={() => setIsBudgetOpen(false)}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        monthlyBudget={currentMonthlyBudget}
        onSetMonthlyBudget={setMonthlyBudget}
        categoryBudgets={currentCategoryBudgets}
        onSetCategoryBudget={setCategoryBudget}
        categories={financeCategories}
        transactions={transactions}
      />

      {/* Recurring & Subscription Modal */}
      <RecurringSubModal
        isOpen={isRecurringSubOpen}
        onClose={() => setIsRecurringSubOpen(false)}
        mode={recurringSubMode}
        editingRecurring={editingRecurring}
        editingSubscription={editingSubscription}
        accounts={accounts}
        categories={financeCategories}
        onSaveRecurring={createRecurringTransaction}
        onUpdateRecurring={updateRecurringTransaction}
        onSaveSubscription={addSubscription}
        onUpdateSubscription={updateSubscription}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
        existingTransactions={transactions}
        onImport={addTransactions}
      />
    </div>
  );
};
