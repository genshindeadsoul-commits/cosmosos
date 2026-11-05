import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Transaction } from '../../../types';
import { parseTransactionsFromCsv, formatCurrency } from '../../../lib/finance';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTransactions: Transaction[];
  onImport: (txs: Omit<Transaction, 'id'>[]) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  existingTransactions,
  onImport,
}) => {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedResult, setParsedResult] = useState<{
    valid: Partial<Transaction>[];
    duplicates: number;
    errors: { line: number; message: string }[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setCsvText(text);
      const res = parseTransactionsFromCsv(text, existingTransactions);
      setParsedResult(res);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    if (text.trim()) {
      const res = parseTransactionsFromCsv(text, existingTransactions);
      setParsedResult(res);
    } else {
      setParsedResult(null);
    }
  };

  const handleExecuteImport = () => {
    if (!parsedResult || parsedResult.valid.length === 0) return;
    const finalTxs = parsedResult.valid.map((t) => ({
      title: t.title || t.description || 'Transaction',
      description: t.description || t.title || '',
      type: t.type || 'expense',
      category: t.category || 'Miscellaneous',
      amount: t.amount || 0,
      date: t.date || '',
      account: t.account || 'Bank account',
      transferAccount: t.transferAccount,
      notes: t.notes,
    })) as Omit<Transaction, 'id'>[];

    onImport(finalTxs);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Transactions from CSV" maxWidth="lg">
      <div className="space-y-4">
        {/* Upload area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#DFE1D9] dark:border-[#383D35] hover:border-[#526B55] dark:hover:border-[#A8BDA1] rounded-xl p-5 text-center cursor-pointer transition-colors bg-[#F5F5F0]/40 dark:bg-[#181A17]/40"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Upload className="h-6 w-6 text-[#526B55] dark:text-[#A8BDA1] mx-auto mb-2" />
          <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
            {fileName ? fileName : 'Click to select CSV file'}
          </div>
          <p className="text-[11px] text-[#8A8E85] mt-1">
            Expected headers: Date, Title, Type, Category, Amount, Account, Notes
          </p>
        </div>

        {/* Or paste CSV text */}
        <div>
          <label className="block text-xs font-semibold text-[#252821] dark:text-[#ECEDE6] mb-1">
            Or paste CSV content directly:
          </label>
          <textarea
            rows={3}
            value={csvText}
            onChange={handleTextChange}
            placeholder="Date,Title,Type,Category,Amount,Account&#10;2026-11-06,DMart Groceries,expense,Groceries,2450.00,Bank account"
            className="w-full font-mono text-[11px] p-2.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#181A17] text-[#252821] dark:text-[#ECEDE6]"
          />
        </div>

        {/* Parsed Summary */}
        {parsedResult && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-2 text-emerald-800 dark:text-emerald-300">
                <div className="font-extrabold text-base">{parsedResult.valid.length}</div>
                <div className="text-[10px]">Valid Transactions</div>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-2 text-amber-800 dark:text-amber-300">
                <div className="font-extrabold text-base">{parsedResult.duplicates}</div>
                <div className="text-[10px]">Skipped Duplicates</div>
              </div>
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-2 text-rose-800 dark:text-rose-300">
                <div className="font-extrabold text-base">{parsedResult.errors.length}</div>
                <div className="text-[10px]">Errors</div>
              </div>
            </div>

            {/* Preview of valid items */}
            {parsedResult.valid.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                  Preview ({Math.min(5, parsedResult.valid.length)} of {parsedResult.valid.length})
                </div>
                <div className="max-h-[140px] overflow-y-auto divide-y divide-[#DFE1D9] dark:divide-[#383D35] border border-[#DFE1D9] dark:border-[#383D35] rounded-lg">
                  {parsedResult.valid.slice(0, 10).map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 text-xs bg-white dark:bg-[#20231F]">
                      <div>
                        <div className="font-bold text-[#252821] dark:text-[#ECEDE6]">
                          {t.title}
                        </div>
                        <div className="text-[10px] text-[#8A8E85]">
                          {t.date} • {t.category} • {t.account}
                        </div>
                      </div>
                      <span className="font-mono font-bold">
                        {formatCurrency(t.amount || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {parsedResult.errors.length > 0 && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 max-h-[100px] overflow-y-auto">
                <div className="font-bold mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Lines with errors:</span>
                </div>
                {parsedResult.errors.map((err, i) => (
                  <div key={i} className="text-[11px]">
                    Line {err.line}: {err.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[#DFE1D9] dark:border-[#383D35]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!parsedResult || parsedResult.valid.length === 0}
            onClick={handleExecuteImport}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#526B55] hover:bg-[#435946] disabled:opacity-50 rounded-lg shadow-xs"
          >
            Import {parsedResult ? `${parsedResult.valid.length} Records` : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
};
