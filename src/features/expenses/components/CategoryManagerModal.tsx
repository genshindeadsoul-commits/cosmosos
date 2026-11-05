import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Tag, AlertCircle } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { FinanceCategoryMeta, Transaction } from '../../../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: FinanceCategoryMeta[];
  transactions: Transaction[];
  onCreateCategory: (cat: Omit<FinanceCategoryMeta, 'id'>) => void;
  onUpdateCategory: (id: string, patch: Partial<FinanceCategoryMeta>) => void;
  onDeleteCategory: (id: string) => void;
  onReassignCategory: (oldCategory: string, newCategory: string) => void;
}

const CATEGORY_COLORS = [
  '#16A34A', '#526B55', '#2563EB', '#D97706', '#8B5CF6', '#EC4899', '#0D9488', '#E11D48', '#6B7067', '#F59E0B',
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  transactions,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReassignCategory,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'edit' | 'safeDelete'>('list');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [editingCat, setEditingCat] = useState<FinanceCategoryMeta | null>(null);
  const [deletingCat, setDeletingCat] = useState<FinanceCategoryMeta | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('Miscellaneous');

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'both'>('expense');
  const [color, setColor] = useState('#526B55');

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setName('');
    setType('expense');
    setColor('#526B55');
    setActiveTab('create');
  };

  const handleStartEdit = (cat: FinanceCategoryMeta) => {
    setEditingCat(cat);
    setName(cat.name);
    setType(cat.type);
    setColor(cat.color || '#526B55');
    setActiveTab('edit');
  };

  const handleStartDelete = (cat: FinanceCategoryMeta) => {
    const txCount = transactions.filter((t) => t.category === cat.name).length;
    if (txCount === 0) {
      if (window.confirm(`Delete category "${cat.name}"?`)) {
        onDeleteCategory(cat.id);
      }
      return;
    }
    // Has transactions -> prompt safe reassignment
    setDeletingCat(cat);
    const fallback = categories.find((c) => c.name !== cat.name)?.name || 'Miscellaneous';
    setReassignTarget(fallback);
    setActiveTab('safeDelete');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateCategory({
      name: name.trim(),
      type,
      color,
    });
    setActiveTab('list');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !name.trim()) return;
    const oldName = editingCat.name;
    const newName = name.trim();
    onUpdateCategory(editingCat.id, {
      name: newName,
      type,
      color,
    });
    // If name changed, reassign all existing transactions
    if (oldName !== newName) {
      onReassignCategory(oldName, newName);
    }
    setActiveTab('list');
  };

  const handleConfirmSafeDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingCat || !reassignTarget) return;
    onReassignCategory(deletingCat.name, reassignTarget);
    onDeleteCategory(deletingCat.id);
    setDeletingCat(null);
    setActiveTab('list');
  };

  const filteredCategories = categories.filter((c) => {
    if (filterType === 'all') return true;
    return c.type === filterType || c.type === 'both';
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Custom Categories" maxWidth="md">
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setActiveTab('list'); setFilterType('all'); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'list' && filterType === 'all'
                  ? 'bg-[#526B55] text-white'
                  : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#20231F]'
              }`}
            >
              All ({categories.length})
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('list'); setFilterType('expense'); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'list' && filterType === 'expense'
                  ? 'bg-[#526B55] text-white'
                  : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#20231F]'
              }`}
            >
              Expenses
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('list'); setFilterType('income'); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'list' && filterType === 'income'
                  ? 'bg-[#526B55] text-white'
                  : 'text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#20231F]'
              }`}
            >
              Income
            </button>
          </div>
          {activeTab === 'list' && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="flex items-center gap-1 text-xs font-bold text-[#526B55] dark:text-[#A8BDA1] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Category</span>
            </button>
          )}
        </div>

        {/* Tab 1: Category List */}
        {activeTab === 'list' && (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {filteredCategories.map((cat) => {
              const txCount = transactions.filter((t) => t.category === cat.name).length;
              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] hover:bg-[#F5F5F0]/50 dark:hover:bg-[#292D27]/50"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || '#526B55' }}
                    />
                    <div>
                      <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                        {cat.name}
                      </div>
                      <div className="text-[10px] text-[#8A8E85] flex items-center gap-2">
                        <span className="capitalize">{cat.type}</span>
                        <span>•</span>
                        <span>{txCount} {txCount === 1 ? 'transaction' : 'transactions'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(cat)}
                      aria-label={`Edit category ${cat.name}`}
                      className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartDelete(cat)}
                      aria-label={`Delete category ${cat.name}`}
                      className="p-1 text-[#8A8E85] hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2 & 3: Create / Edit Category */}
        {(activeTab === 'create' || activeTab === 'edit') && (
          <form onSubmit={activeTab === 'create' ? handleCreateSubmit : handleEditSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Health & Wellness, Freelance, Subscriptions"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
                Category Type
              </label>
              <div className="flex items-center gap-2">
                {(['expense', 'income', 'both'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize border ${
                      type === t
                        ? 'border-[#526B55] bg-[#526B55]/10 text-[#526B55] dark:text-[#A8BDA1] dark:bg-[#526B55]/20 font-bold'
                        : 'border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1.5">
                Category Color
              </label>
              <div className="flex items-center gap-2">
                {CATEGORY_COLORS.map((c) => (
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
                {activeTab === 'create' ? 'Create Category' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: Safe Deletion with Reassignment */}
        {activeTab === 'safeDelete' && deletingCat && (
          <form onSubmit={handleConfirmSafeDelete} className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4" />
                <span>Category contains transactions</span>
              </div>
              <p>
                Category <strong>"{deletingCat.name}"</strong> is currently used in{' '}
                <strong>
                  {transactions.filter((t) => t.category === deletingCat.name).length}
                </strong>{' '}
                transactions. Select a replacement category to safely reassign them before deletion.
              </p>
            </div>

            <div>
              <label
                htmlFor="reassign-category-select"
                className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1"
              >
                Reassign transactions to:
              </label>
              <select
                id="reassign-category-select"
                aria-label="Reassign transactions to:"
                value={reassignTarget}
                onChange={(e) => setReassignTarget(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
              >
                {categories
                  .filter((c) => c.name !== deletingCat.name)
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </select>
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
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                Reassign & Delete
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
