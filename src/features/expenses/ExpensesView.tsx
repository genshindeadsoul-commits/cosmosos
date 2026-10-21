import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  PieChart as PieIcon,
  CreditCard,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ExpenseCategory, TransactionType } from '../../types';

export const ExpensesView: React.FC = () => {
  const {
    transactions,
    subscriptions,
    addTransaction,
    deleteTransaction,
    addSubscription,
    deleteSubscription,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);

  // New Tx Form state
  const [newTxType, setNewTxType] = useState<TransactionType>('expense');
  const [newTxCat, setNewTxCat] = useState<ExpenseCategory>('Groceries');
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxAmt, setNewTxAmt] = useState('');

  // New Sub Form state
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmt, setNewSubAmt] = useState('');
  const [newSubRenewal, setNewSubRenewal] = useState('2026-11-01');

  // Calculations from actual records
  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const totalExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const netBalance = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1) : '0';

  const incomeStreamsCount = transactions.filter((t) => t.type === 'income').length;
  const debitStreamsCount = transactions.filter((t) => t.type === 'expense').length;

  // Breakdown by category
  const categoryBreakdown = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense');
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
  }, [transactions, totalExpense]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [transactions, searchQuery, filterType]);

  const handleAddTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newTxAmt);
    if (isNaN(amt) || amt <= 0 || !newTxDesc.trim()) return;

    addTransaction({
      type: newTxType,
      category: newTxCat,
      description: newTxDesc.trim(),
      amount: amt,
      date: new Date().toISOString().slice(0, 10),
      time: '12:30 PM',
    });
    setNewTxDesc('');
    setNewTxAmt('');
    setIsAddTxOpen(false);
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
      {/* Top Action Button */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
          Expenses & Ledger
        </h1>
        <button
          onClick={() => setIsAddTxOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* Metric Cards matching Screenshot 6 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Net Balance */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
            <span>Net Balance</span>
            <CreditCard className="h-4 w-4 text-[#8A8E85]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#252821] dark:text-[#ECEDE6]">
            ₹{netBalance.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-[#477653] dark:text-[#91B594]">
            +{savingsRate}% savings rate
          </div>
        </div>

        {/* Incomes */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
            <span>Incomes</span>
            <ArrowUpRight className="h-4 w-4 text-[#477653] dark:text-[#91B594]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#477653] dark:text-[#91B594]">
            +₹{totalIncome.toLocaleString()}
          </div>
          <div className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            From {incomeStreamsCount} credit streams
          </div>
        </div>

        {/* Expenses */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]">
            <span>Expenses</span>
            <ArrowDownLeft className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
            -₹{totalExpense.toLocaleString()}
          </div>
          <div className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">
            Across {debitStreamsCount} debits
          </div>
        </div>
      </div>

      {/* Transaction Activity Table */}
      <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] shadow-xs overflow-hidden">
        <div className="border-b border-[#DFE1D9] dark:border-[#383D35] p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#252821] dark:text-[#ECEDE6]">
            Transaction Activity
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8A8E85]" />
              <input
                type="text"
                placeholder="Search transaction..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] pl-8 pr-3 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
              />
            </div>
            <select
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

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/60 dark:bg-[#181A17]/60 text-[#6B7067] dark:text-[#A6AB9F] font-bold">
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4">Date & Time</th>
                <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE1D9] dark:divide-[#383D35]">
              {filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50 transition-colors group"
                >
                  <td className="py-2.5 px-4 font-bold text-[#252821] dark:text-[#ECEDE6]">
                    {tx.category}
                  </td>
                  <td className="py-2.5 px-4 text-[#6B7067] dark:text-[#A6AB9F]">
                    {tx.description}
                  </td>
                  <td className="py-2.5 px-4 text-[#8A8E85] font-mono text-[11px]">
                    {tx.date} {tx.time}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono font-bold ${
                      tx.type === 'income'
                        ? 'text-[#477653] dark:text-[#91B594]'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      aria-label="Delete transaction"
                      className="p-1 text-[#8A8E85] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Expense Breakdown Donut & Subscriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Expense Breakdown Donut */}
        <div className="lg:col-span-7 rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF] dark:bg-[#20231F] p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#DFE1D9] dark:border-[#383D35]">
            <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
              Expense Breakdown
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
                      strokeDasharray={`${segmentLength} ${circumference}`}
                      strokeDashoffset={-prevLength}
                      fill="transparent"
                      className="transition-all duration-300"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] uppercase font-bold text-[#8A8E85]">
                  TOTAL OUT
                </span>
                <span className="text-xs font-extrabold text-[#252821] dark:text-[#ECEDE6]">
                  ₹{totalExpense.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Legend with percentages */}
            <div className="sm:col-span-7 space-y-2">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
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
              ))}
            </div>
          </div>
        </div>

        {/* Subscriptions Card matching Screenshot 6 */}
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
              {subscriptions.map((sub) => (
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
              ))}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                    Type
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
                    Amount (₹ INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1500"
                    value={newTxAmt}
                    onChange={(e) => setNewTxAmt(e.target.value)}
                    className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] mb-1">
                  Category
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
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Metro monthly smartcard top-up"
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
