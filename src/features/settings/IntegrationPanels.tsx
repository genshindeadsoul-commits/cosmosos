import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { parseSpreadsheetId, sheetToTable } from '../../lib/integrationsApi';

const field = 'w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-3 py-2 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:ring-1 focus:ring-[#526B55]';
const btn = 'rounded-lg bg-[#3D5240] hover:bg-[#2E3F31] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50';

/** Preview first, then create. Imports never silently overwrite existing tables. */
export const SheetsImportPanel: React.FC = () => {
  const { sheetsPreview } = useIntegrations();
  const { addTableCollection, showToast } = useApp();
  const [url, setUrl] = useState('');
  const [range, setRange] = useState('A1:Z200');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ title: string; values: string[][] } | null>(null);

  const load = async () => {
    const id = parseSpreadsheetId(url);
    if (!id) { showToast('That doesn’t look like a Google Sheets link.', 'error'); return; }
    setLoading(true);
    try { setPreview(await sheetsPreview(id, range)); }
    catch (e) { setPreview(null); showToast((e as Error).message, 'error'); }
    finally { setLoading(false); }
  };

  const t = preview ? sheetToTable(preview.values) : null;
  const create = () => {
    if (!preview || !t || t.columns.length === 0) { showToast('The range has no data.', 'error'); return; }
    addTableCollection({ name: preview.title, description: 'Imported from Google Sheets (one-time copy)', columns: t.columns,
      rows: t.rows.map((r, i) => ({ id: crypto.randomUUID(), ...r })) });
    setPreview(null); setUrl('');
  };

  return (
    <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-4 space-y-3">
      <div className="text-xs font-bold">Import a spreadsheet as a table</div>
      <input aria-label="Spreadsheet link" className={field} placeholder="https://docs.google.com/spreadsheets/d/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="flex gap-2">
        <input aria-label="Range" className={field} value={range} onChange={(e) => setRange(e.target.value)} />
        <button className={btn} onClick={load} disabled={loading || !url.trim()}>{loading ? 'Loading…' : 'Preview'}</button>
      </div>
      {preview && t && (
        <div className="space-y-2">
          <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">“{preview.title}”: {t.columns.length} columns, {t.rows.length} rows. Showing the first 5.</p>
          <div className="overflow-x-auto"><table className="text-[11px] border-collapse w-full">
            <thead><tr>{t.columns.map((c) => <th key={c.id} className="border border-[#DFE1D9] dark:border-[#383D35] px-2 py-1 text-left">{c.name}</th>)}</tr></thead>
            <tbody>{t.rows.slice(0, 5).map((r, i) => <tr key={i}>{t.columns.map((c) => <td key={c.id} className="border border-[#DFE1D9] dark:border-[#383D35] px-2 py-1">{r[c.id]}</td>)}</tr>)}</tbody>
          </table></div>
          <button className={btn} onClick={create}>Create table from this preview</button>
        </div>
      )}
    </div>
  );
};

export const HealthTokenPanel: React.FC = () => {
  const { healthTokens, createHealthToken, revokeHealthToken } = useIntegrations();
  const { showToast } = useApp();
  const [label, setLabel] = useState('My phone');
  const [fresh, setFresh] = useState<string | null>(null);
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL ?? '<your-project>.supabase.co'}/functions/v1/health-ingest`;
  const active = healthTokens.filter((t) => !t.revoked_at);

  return (
    <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-4 space-y-3">
      <div className="text-xs font-bold">Companion app ingest tokens</div>
      <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
        POST workouts to <code className="break-all">{endpoint}</code> with <code>Authorization: Bearer &lt;token&gt;</code>. Body:
        <code className="block mt-1 whitespace-pre-wrap">{`{"workouts":[{"externalId":"hc-123","title":"Run","date":"2026-10-19","durationMinutes":32,"calories":null}]}`}</code>
        Missing duration/calories stay blank, never 0. Re-sending the same <code>externalId</code> is safe.
      </p>
      <div className="flex gap-2">
        <input aria-label="Token label" className={field} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
        <button className={btn} onClick={async () => { try { setFresh(await createHealthToken(label)); } catch (e) { showToast((e as Error).message, 'error'); } }}>Generate</button>
      </div>
      {fresh && (
        <div role="alert" className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px]">
          <p className="font-semibold">Copy this token now. It is shown once and can’t be retrieved later.</p>
          <code className="mt-1 block break-all">{fresh}</code>
          <div className="mt-2 flex gap-2">
            <button className={btn} onClick={() => { void navigator.clipboard?.writeText(fresh); showToast('Token copied', 'success'); }}>Copy</button>
            <button className="text-xs underline" onClick={() => setFresh(null)}>I’ve saved it</button>
          </div>
        </div>
      )}
      <ul className="space-y-1 text-[11px]">
        {healthTokens.length === 0 && <li className="text-[#8A8E85]">No tokens yet.</li>}
        {healthTokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2">
            <span>{t.label} · created {new Date(t.created_at).toLocaleDateString()} · {t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleString()}` : 'never used'}{t.revoked_at ? ' · revoked' : ''}</span>
            {!t.revoked_at && <button className="font-semibold text-rose-600 hover:underline" onClick={() => revokeHealthToken(t.id).catch((e) => showToast(e.message, 'error'))}>Revoke</button>}
          </li>
        ))}
      </ul>
      {active.length === 0 && <p className="text-[11px] text-[#8A8E85]">Status stays “Not connected” until a companion app actually sends data.</p>}
    </div>
  );
};
