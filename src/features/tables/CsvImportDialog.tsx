import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { TableCollection } from '../../types';
import { guessMapping, Mapping, parseCsv, planCsvImport } from '../../lib/csv';

interface Props { table: TableCollection; file: File; onCancel: () => void; onImport: (rows: Record<string, string>[], skipped: number) => void }

const MAX_BYTES = 5 * 1024 * 1024;

/** Preview first. Nothing is written until the user confirms, and invalid rows are listed, never silently dropped. */
export const CsvImportDialog: React.FC<Props> = ({ table, file, onCancel, onImport }) => {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(file.size > MAX_BYTES ? 'File is larger than 5 MB.' : null);
  const [mapping, setMapping] = useState<Mapping>({});

  React.useEffect(() => {
    if (file.size > MAX_BYTES) return;
    file.text().then((t) => {
      try {
        const parsed = parseCsv(t);
        if (parsed.length < 2) { setError('The file has no data rows.'); return; }
        setRows(parsed); setMapping(guessMapping(parsed[0], table.columns));
      } catch (e) { setError((e as Error).message); }
    }).catch(() => setError('Could not read the file.'));
  }, [file, table]);

  const plan = useMemo(() => (rows ? planCsvImport(rows.slice(1), mapping, table.columns, table.rows) : null), [rows, mapping, table]);
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const taken = (id: string, except: number) => Object.entries(mapping).some(([i, v]) => v === id && +i !== except);
  const cell = 'border border-[#DFE1D9] dark:border-[#383D35] px-2 py-1 text-left';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Import CSV" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6]">
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-4 py-3">
          <div className="text-sm font-bold">Import “{file.name}” into {table.name}</div>
          <button onClick={onCancel} aria-label="Close" className="rounded-md p-1 hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
          {error && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-rose-800 dark:text-rose-300">{error}</p>}
          {!error && !rows && <p role="status">Reading file…</p>}
          {rows && plan && (
            <>
              <div>
                <p className="mb-1 font-semibold">1. Match file columns to table columns</p>
                <table className="w-full border-collapse"><tbody>
                  {rows[0].map((h, i) => (
                    <tr key={i}>
                      <td className={cell}>{h || `(column ${i + 1})`}</td>
                      <td className={cell}>
                        <select aria-label={`Map ${h || `column ${i + 1}`}`} value={mapping[i] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value || null }))}
                          className="w-full rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1">
                          <option value="">Skip this column</option>
                          {table.columns.map((c) => <option key={c.id} value={c.id} disabled={taken(c.id, i)}>{c.name} ({c.type})</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
              <div>
                <p className="mb-1 font-semibold">2. Preview (first 5 valid rows)</p>
                <div className="overflow-x-auto"><table className="w-full border-collapse">
                  <thead><tr>{table.columns.map((c) => <th key={c.id} className={cell}>{c.name}</th>)}</tr></thead>
                  <tbody>{plan.valid.slice(0, 5).map((r, i) => <tr key={i}>{table.columns.map((c) => <td key={c.id} className={cell}>{r[c.id]}</td>)}</tr>)}</tbody>
                </table></div>
              </div>
              <p>
                <strong>{plan.valid.length}</strong> row{plan.valid.length === 1 ? '' : 's'} will be added
                {plan.duplicates > 0 && <>, <strong>{plan.duplicates}</strong> duplicate{plan.duplicates === 1 ? '' : 's'} skipped</>}
                {plan.errors.length > 0 && <>, <strong>{plan.errors.length}</strong> invalid row{plan.errors.length === 1 ? '' : 's'} skipped</>}.
              </p>
              {plan.errors.length > 0 && (
                <ul aria-label="Invalid rows" className="max-h-28 list-disc space-y-0.5 overflow-y-auto pl-5 text-rose-700 dark:text-rose-400">
                  {plan.errors.slice(0, 20).map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}
                  {plan.errors.length > 20 && <li>…and {plan.errors.length - 20} more</li>}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#DFE1D9] dark:border-[#383D35] px-4 py-3">
          <button onClick={onCancel} className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold">Cancel</button>
          <button disabled={!plan || plan.valid.length === 0 || mappedCount === 0} onClick={() => plan && onImport(plan.valid, plan.errors.length + plan.duplicates)}
            className="rounded-lg bg-[#3D5240] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            {plan ? `Import ${plan.valid.length} row${plan.valid.length === 1 ? '' : 's'}` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
