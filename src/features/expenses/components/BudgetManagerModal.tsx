import React, { useState } from 'react';
import { Target, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { FinanceCategoryMeta, Transaction } from '../../../types';
import { formatCurrency, roundCurrency, calculateBudgetProgress } from '../../../lib/finance';

interface BudgetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  monthlyBudget: number;
  onSetMonthlyBudget: (month: string, amount: number) => void;
  categoryBudgets: Record<string, number>;
  onSetCategoryBudget: (month: string, category: string, amount: number) => void;
  categories: FinanceCategoryMeta[];
  transactions: Transaction[];
}

export const BudgetManagerModal: React.FC<BudgetManagerModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  onMonthChange,
  monthlyBudget,
  onSetMonthlyBudget,
  categoryBudgets,
  onSetCategoryBudget,
  categories,
  transactions,
}) => {
  const [totalInput, setTotalInput] = useState(() => (monthlyBudget > 0 ? String(monthlyBudget) : ''));
  const [catInputs, setCatInputs] = useState<Record<string, string>>(() => {
    const res: Record<string, string> = {};
    Object.entries(categoryBudgets).forEach(([cat, amt]) => {
      if (amt > 0) res[cat] = String(amt);
    });
    return res;
  });

  if (!isOpen) return null;

  // Month navigation
  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    const nextKey = `${ny}-${nm}`;
    onMonthChange(nextKey);
  };

  const monthLabel = (() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  })();

  // Current month's expenses
  const monthExpenses = transactions.filter((t) => t.date.startsWith(selectedMonth) && t.type === 'expense');
  const totalSpent = monthExpenses.reduce((sum, t) => sum + t.amount, 0);

  const handleSaveTotal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(totalInput);
    onSetMonthlyBudget(selectedMonth, Number.isFinite(val) ? Math.max(0, roundCurrency(val)) : 0);
  };

  const handleSaveCategoryBudget = (catName: string) => {
    const val = parseFloat(catInputs[catName] || '0');
    const safeVal = Number.isFinite(val) ? Math.max(0, roundCurrency(val)) : 0;
    onSetCategoryBudget(selectedMonth, catName, safeVal);
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both');

  const totalProgress = calculateBudgetProgress(monthlyBudget, totalSpent);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Budgets & Spending Limits" maxWidth="lg">
      <div className="space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F5F5F0]/70 dark:bg-[#181A17]/70 border border-[#DFE1D9] dark:border-[#383D35]">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="p-1 rounded text-[#6B7067] dark:text-[#A6AB9F] hover:bg-white dark:hover:bg-[#20231F]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
            {monthLabel} ({selectedMonth})
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="p-1 rounded text-[#6B7067] dark:text-[#A6AB9F] hover:bg-white dark:hover:bg-[#20231F]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Total Monthly Budget */}
        <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#526B55] dark:text-[#A8BDA1]" />
              <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                Total Monthly Budget
              </span>
            </div>
            <div className="text-xs text-[#8A8E85]">
              Spent: <strong>{formatCurrency(totalSpent)}</strong>
            </div>
          </div>

          <form onSubmit={handleSaveTotal} className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2 text-xs text-[#8A8E85]">₹</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00 (No budget)"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
            >
              Set Budget
            </button>
          </form>

          {monthlyBudget > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                <span>Progress: {totalProgress.percent}%</span>
                <span className={totalProgress.isOver ? 'text-rose-600 font-bold' : ''}>
                  {totalProgress.remaining >= 0
                    ? `${formatCurrency(totalProgress.remaining)} remaining`
                    : `${formatCurrency(Math.abs(totalProgress.remaining))} over budget`}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#E5E7EB] dark:bg-[#383D35] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    totalProgress.isOver
                      ? 'bg-rose-500'
                      : totalProgress.percent > 85
                      ? 'bg-amber-500'
                      : 'bg-[#526B55]'
                  }`}
                  style={{ width: `${Math.min(100, totalProgress.percent)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Category-Specific Budgets */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
            Category Spending Limits
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {expenseCategories.map((cat) => {
              const spent = monthExpenses
                .filter((t) => t.category === cat.name)
                .reduce((s, t) => s + t.amount, 0);
              const limit = categoryBudgets[cat.name] || 0;
              const inputVal = catInputs[cat.name] !== undefined ? catInputs[cat.name] : (limit > 0 ? String(limit) : '');
              const progress = calculateBudgetProgress(limit, spent);

              return (
                <div
                  key={cat.id}
                  className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cat.color || '#526B55' }}
                      />
                      <span className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#8A8E85]">
                        Spent: {formatCurrency(spent)}
                      </span>
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1 text-[11px] text-[#8A8E85]">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Limit"
                          value={inputVal}
                          onChange={(e) => {
                            setCatInputs((prev) => ({ ...prev, [cat.name]: e.target.value }));
                          }}
                          onBlur={() => handleSaveCategoryBudget(cat.name)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveCategoryBudget(cat.name);
                            }
                          }}
                          className="w-full pl-5 pr-2 py-1 text-xs rounded border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                        />
                      </div>
                    </div>
                  </div>

                  {limit > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-[#8A8E85]">
                        <span>{progress.percent}% used</span>
                        <span className={progress.isOver ? 'text-rose-600 font-semibold' : ''}>
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
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};
