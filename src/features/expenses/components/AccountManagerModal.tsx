import React, { useState } from 'react';
import { X, Plus, Edit2, Archive, Trash2, ArrowRightLeft, Wallet, Building2, PiggyBank, Smartphone, CreditCard } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Account, AccountType, Transaction } from '../../../types';
import { formatCurrency, roundCurrency } from '../../../lib/finance';
import { todayKey } from '../../../lib/dates';

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  balances: Record<string, number>;
  onCreateAccount: (acc: Omit<Account, 'id'>) => void;
  onUpdateAccount: (id: string, patch: Partial<Account>) => void;
  onArchiveAccount: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onTransfer: (tx: {
    fromAccount: string;
    toAccount: string;
    amount: number;
    title: string;
    date: string;
    notes?: string;
  }) => void;
}

const ACCOUNT_TYPE_ICONS: Record<AccountType, React.ElementType> = {
  cash: Wallet,
  bank: Building2,
  savings: PiggyBank,
  wallet: Smartphone,
  credit: CreditCard,
  custom: Wallet,
};

const COLOR_PALETTE = [
  '#2563EB', '#16A34A', '#D97706', '#8B5CF6', '#EC4899', '#0D9488', '#E11D48', '#4B5563',
];

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({
  isOpen,
  onClose,
  accounts,
  balances,
  onCreateAccount,
  onUpdateAccount,
  onArchiveAccount,
  onDeleteAccount,
  onTransfer,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'transfer' | 'create' | 'edit'>('list');
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [openingBalance, setOpeningBalance] = useState('');
  const [color, setColor] = useState('#2563EB');

  // Transfer states
  const [transferFrom, setTransferFrom] = useState(() => accounts[0]?.name || 'Bank account');
  const [transferTo, setTransferTo] = useState(() => accounts[1]?.name || 'Cash');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferTitle, setTransferTitle] = useState('Account transfer');
  const [transferDate, setTransferDate] = useState(() => todayKey());
  const [transferNotes, setTransferNotes] = useState('');

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setName('');
    setType('bank');
    setOpeningBalance('0');
    setColor('#2563EB');
    setActiveTab('create');
  };

  const handleStartEdit = (acc: Account) => {
    setEditingAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setOpeningBalance(String(acc.openingBalance));
    setColor(acc.color || '#2563EB');
    setActiveTab('edit');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateAccount({
      name: name.trim(),
      type,
      openingBalance: parseFloat(openingBalance) || 0,
      color,
    });
    setActiveTab('list');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAcc || !name.trim()) return;
    onUpdateAccount(editingAcc.id, {
      name: name.trim(),
      type,
      openingBalance: parseFloat(openingBalance) || 0,
      color,
    });
    setActiveTab('list');
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0 || transferFrom === transferTo) return;

    onTransfer({
      fromAccount: transferFrom,
      toAccount: transferTo,
      amount: roundCurrency(amt),
      title: transferTitle.trim() || `Transfer to ${transferTo}`,
      date: transferDate || todayKey(),
      notes: transferNotes.trim() || undefined,
    });

    setTransferAmount('');
    setTransferNotes('');
    setActiveTab('list');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Accounts" maxWidth="lg">
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'list'
                  ? 'bg-[#526B55] text-white'
                  : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#20231F]'
              }`}
            >
              All Accounts ({accounts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transfer')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'transfer'
                  ? 'bg-[#526B55] text-white'
                  : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#20231F]'
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Transfer Funds</span>
            </button>
          </div>
          {activeTab === 'list' && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="flex items-center gap-1 text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Account</span>
            </button>
          )}
        </div>

        {/* Tab 1: Account List */}
        {activeTab === 'list' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {accounts.map((acc) => {
                const IconComponent = ACCOUNT_TYPE_ICONS[acc.type] || Wallet;
                const balance = balances[acc.name] ?? acc.openingBalance ?? 0;
                return (
                  <div
                    key={acc.id}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                      acc.isArchived
                        ? 'opacity-60 bg-gray-50 dark:bg-gray-900/30 border-dashed border-gray-300 dark:border-gray-700'
                        : 'bg-white dark:bg-[#20231F] border-[#DFE1D9] dark:border-[#383D35] shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: acc.color || '#2563EB' }}
                        >
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[#252821] dark:text-[#ECEDE6] flex items-center gap-1.5">
                            <span>{acc.name}</span>
                            {acc.isArchived && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-normal">
                                Archived
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] uppercase font-semibold text-[#8A8E85]">
                            {acc.type}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(acc)}
                          aria-label={`Edit account ${acc.name}`}
                          className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onArchiveAccount(acc.id)}
                          aria-label={`Archive account ${acc.name}`}
                          className="p-1 text-[#8A8E85] hover:text-amber-600"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                        {accounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete account "${acc.name}"? Transactions using this account will keep their records.`)) {
                                onDeleteAccount(acc.id);
                              }
                            }}
                            aria-label={`Delete account ${acc.name}`}
                            className="p-1 text-[#8A8E85] hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#DFE1D9]/60 dark:border-[#383D35]/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[#8A8E85]">
                        Opening: {formatCurrency(acc.openingBalance)}
                      </span>
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-[#252821] dark:text-[#ECEDE6]">
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

        {/* Tab 2: Transfer Funds */}
        {activeTab === 'transfer' && (
          <form onSubmit={handleTransferSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  From Account
                </label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  {accounts.filter((a) => !a.isArchived).map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name} ({formatCurrency(balances[a.name] ?? 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  To Account
                </label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  {accounts.filter((a) => !a.isArchived && a.name !== transferFrom).map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name} ({formatCurrency(balances[a.name] ?? 0)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  Transfer Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
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
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Description / Title
              </label>
              <input
                type="text"
                value={transferTitle}
                onChange={(e) => setTransferTitle(e.target.value)}
                placeholder="e.g. ATM withdrawal, Credit card payoff"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300">
              💡 Transfers simply reallocate money between accounts. They never count as income or expense and do not affect your overall net cash flow.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
              >
                Execute Transfer
              </button>
            </div>
          </form>
        )}

        {/* Tab 3 & 4: Create or Edit Account */}
        {(activeTab === 'create' || activeTab === 'edit') && (
          <form onSubmit={activeTab === 'create' ? handleCreateSubmit : handleEditSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Account Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. HDFC Salary Account, Emergency Fund"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  Account Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                >
                  <option value="bank">Bank Account</option>
                  <option value="cash">Cash in Hand</option>
                  <option value="savings">Savings Account</option>
                  <option value="wallet">Digital Wallet / UPI</option>
                  <option value="credit">Credit Card</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1.5">
                Accent Color
              </label>
              <div className="flex items-center gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      color === c ? 'scale-125 ring-2 ring-offset-2 ring-[#526B55]' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] rounded-lg shadow-xs"
              >
                {activeTab === 'create' ? 'Create Account' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
