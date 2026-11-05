import React, { useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import {
  Account,
  FinanceCategoryMeta,
  RecurringFrequency,
  RecurringTransaction,
  Subscription,
  TransactionType,
} from '../../../types';
import { todayKey } from '../../../lib/dates';
import { roundCurrency } from '../../../lib/finance';

interface RecurringSubModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'recurring' | 'subscription';
  editingRecurring?: RecurringTransaction | null;
  editingSubscription?: Subscription | null;
  accounts: Account[];
  categories: FinanceCategoryMeta[];
  onSaveRecurring: (rec: Omit<RecurringTransaction, 'id'>) => void;
  onUpdateRecurring: (id: string, patch: Partial<RecurringTransaction>) => void;
  onSaveSubscription: (sub: Omit<Subscription, 'id'>) => void;
  onUpdateSubscription: (sub: Subscription) => void;
}

export const RecurringSubModal: React.FC<RecurringSubModalProps> = ({
  isOpen,
  onClose,
  mode,
  editingRecurring,
  editingSubscription,
  accounts,
  categories,
  onSaveRecurring,
  onUpdateRecurring,
  onSaveSubscription,
  onUpdateSubscription,
}) => {
  // Recurring state
  const [recTitle, setRecTitle] = useState(() => editingRecurring?.title || '');
  const [recType, setRecType] = useState<TransactionType>(() => editingRecurring?.type || 'expense');
  const [recCat, setRecCat] = useState(() => editingRecurring?.category || 'Utilities');
  const [recAmount, setRecAmount] = useState(() => (editingRecurring ? String(editingRecurring.amount) : ''));
  const [recAccount, setRecAccount] = useState(() => editingRecurring?.account || accounts[0]?.name || 'Bank account');
  const [recTransferAccount, setRecTransferAccount] = useState(() => editingRecurring?.transferAccount || accounts[1]?.name || 'Cash');
  const [recFrequency, setRecFrequency] = useState<RecurringFrequency>(() => editingRecurring?.frequency || 'monthly');
  const [recInterval, setRecInterval] = useState(() => String(editingRecurring?.interval || 1));
  const [recStartDate, setRecStartDate] = useState(() => editingRecurring?.startDate || todayKey());
  const [recNotes, setRecNotes] = useState(() => editingRecurring?.notes || '');

  // Subscription state
  const [subName, setSubName] = useState(() => editingSubscription?.name || '');
  const [subDesc, setSubDesc] = useState(() => editingSubscription?.description || '');
  const [subAmount, setSubAmount] = useState(() => (editingSubscription ? String(editingSubscription.amount) : ''));
  const [subCycle, setSubCycle] = useState<Subscription['billingCycle']>(() => editingSubscription?.billingCycle || 'monthly');
  const [subRenewal, setSubRenewal] = useState(() => editingSubscription?.renewalDate || todayKey());
  const [subAccount, setSubAccount] = useState(() => editingSubscription?.account || accounts[0]?.name || 'Bank account');
  const [subCategory, setSubCategory] = useState(() => editingSubscription?.category || 'Utilities');
  const [subStatus, setSubStatus] = useState<Subscription['status']>(() => editingSubscription?.status || 'active');

  if (!isOpen) return null;

  const handleRecurringSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(recAmount);
    if (!recTitle.trim() || !amt || amt <= 0) return;

    const payload: Omit<RecurringTransaction, 'id'> = {
      title: recTitle.trim(),
      type: recType,
      category: recCat,
      amount: roundCurrency(amt),
      account: recAccount,
      transferAccount: recType === 'transfer' ? recTransferAccount : undefined,
      frequency: recFrequency,
      interval: parseInt(recInterval, 10) || 1,
      startDate: recStartDate || todayKey(),
      nextDueDate: recStartDate || todayKey(),
      status: editingRecurring ? editingRecurring.status : 'active',
      notes: recNotes.trim() || undefined,
    };

    if (editingRecurring) {
      onUpdateRecurring(editingRecurring.id, payload);
    } else {
      onSaveRecurring(payload);
    }
    onClose();
  };

  const handleSubscriptionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(subAmount);
    if (!subName.trim() || !amt || amt <= 0) return;

    if (editingSubscription) {
      onUpdateSubscription({
        ...editingSubscription,
        name: subName.trim(),
        description: subDesc.trim() || undefined,
        amount: roundCurrency(amt),
        billingCycle: subCycle,
        renewalDate: subRenewal || todayKey(),
        account: subAccount,
        category: subCategory,
        status: subStatus,
      });
    } else {
      onSaveSubscription({
        name: subName.trim(),
        description: subDesc.trim() || undefined,
        amount: roundCurrency(amt),
        billingCycle: subCycle,
        renewalDate: subRenewal || todayKey(),
        account: subAccount,
        category: subCategory,
        status: 'active',
      });
    }
    onClose();
  };

  const title =
    mode === 'recurring'
      ? editingRecurring
        ? 'Edit Recurring Transaction'
        : 'Add Recurring Transaction'
      : editingSubscription
      ? 'Edit Subscription'
      : 'Add Subscription';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      {mode === 'recurring' ? (
        <form onSubmit={handleRecurringSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Monthly Rent, Salary, Internet bill"
              value={recTitle}
              onChange={(e) => setRecTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Type
              </label>
              <select
                value={recType}
                onChange={(e) => setRecType(e.target.value as TransactionType)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value)}
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
                value={recAccount}
                onChange={(e) => setRecAccount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {recType === 'transfer' ? (
              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  Transfer To
                </label>
                <select
                  value={recTransferAccount}
                  onChange={(e) => setRecTransferAccount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  {accounts.filter((a) => a.name !== recAccount).map((a) => (
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
                  value={recCat}
                  onChange={(e) => setRecCat(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Frequency
              </label>
              <select
                value={recFrequency}
                onChange={(e) => setRecFrequency(e.target.value as RecurringFrequency)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Start / Next Due Date *
              </label>
              <input
                type="date"
                required
                value={recStartDate}
                onChange={(e) => setRecStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Account number, contract note"
              value={recNotes}
              onChange={(e) => setRecNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
            >
              Save Recurring Rule
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubscriptionSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
              Subscription Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Netflix, Spotify, iCloud 2TB, AWS"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
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
                value={subAmount}
                onChange={(e) => setSubAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Billing Frequency
              </label>
              <select
                value={subCycle}
                onChange={(e) => setSubCycle(e.target.value as Subscription['billingCycle'])}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Next Renewal Date *
              </label>
              <input
                type="date"
                required
                value={subRenewal}
                onChange={(e) => setSubRenewal(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Payment Account
              </label>
              <select
                value={subAccount}
                onChange={(e) => setSubAccount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Category
              </label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Status
              </label>
              <select
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value as Subscription['status'])}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Family plan with 4 members"
              value={subDesc}
              onChange={(e) => setSubDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
            >
              {editingSubscription ? 'Update Subscription' : 'Add Subscription'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
