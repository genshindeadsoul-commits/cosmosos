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
      rows: t.rows });
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
  const { healthTokens, createHealthToken, revokeHealthToken, sync, busy } = useIntegrations();
  const { showToast } = useApp();
  const [label, setLabel] = useState('My phone');
  const [fresh, setFresh] = useState<string | null>(null);
  const [showCurl, setShowCurl] = useState(false);
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL ?? '<your-project>.supabase.co'}/functions/v1/api/health-ingest`;
  const active = healthTokens.filter((t) => !t.revoked_at);

  const sampleCurl = (token: string) => `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"workouts":[{"externalId":"demo-${Date.now()}","title":"Outdoor Run","date":"${new Date().toISOString().slice(0, 10)}","durationMinutes":35,"calories":310}]}'`;

  return (
    <div className="rounded-xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold">Companion app ingest tokens</div>
        <button
          onClick={() => sync('health')}
          disabled={busy === 'health'}
          className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-2.5 py-1 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] disabled:opacity-50"
        >
          <span>{busy === 'health' ? 'Checking…' : 'Check for new data'}</span>
        </button>
      </div>

      <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] leading-relaxed">
        <strong>Why a companion app?</strong> Android Health Connect is an on-device Android service (<code>androidx.health.connect.client</code>) and cannot be queried directly from web browsers. Google Fit REST APIs are being phased out. Your Android companion app reads Health Connect locally and pushes workouts here using a personal ingest token. Synced workouts appear in Fitness.
      </p>

      <div className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F] space-y-1">
        <p>
          POST workouts to <code className="break-all">{endpoint}</code> with <code>Authorization: Bearer &lt;token&gt;</code>.
        </p>
        <p className="text-[10px] text-[#8A8E85]">
          Missing duration/calories stay blank (never forced to 0). Re-sending the same <code>externalId</code> is safe and idempotent.
        </p>
      </div>

      <div className="flex gap-2">
        <input aria-label="Token label" className={field} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Token label (e.g. Pixel 8)" />
        <button className={btn} onClick={async () => { try { setFresh(await createHealthToken(label)); } catch (e) { showToast((e as Error).message, 'error'); } }}>Generate</button>
      </div>

      {fresh && (
        <div role="alert" className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px] space-y-2">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Copy this token now. It is shown once and cannot be retrieved later.</p>
          <code className="mt-1 block break-all font-mono bg-white/70 dark:bg-black/30 p-1.5 rounded text-[10px] select-all">{fresh}</code>
          <div className="flex flex-wrap gap-2 pt-1">
            <button className={btn} onClick={() => { void navigator.clipboard?.writeText(fresh); showToast('Token copied', 'success'); }}>Copy Token</button>
            <button
              className="rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-2.5 py-1 text-xs font-semibold text-[#6B7067] dark:text-[#A6AB9F] hover:bg-white"
              onClick={() => { void navigator.clipboard?.writeText(sampleCurl(fresh)); showToast('Sample curl command copied', 'success'); }}
            >
              Copy Test curl Command
            </button>
            <button className="text-xs underline text-[#6B7067] dark:text-[#A6AB9F]" onClick={() => setFresh(null)}>I’ve saved it</button>
          </div>
        </div>
      )}

      <ul className="space-y-1 text-[11px] divide-y divide-[#DFE1D9]/40 dark:divide-[#383D35]/40">
        {healthTokens.length === 0 && <li className="text-[#8A8E85] py-1">No tokens generated yet.</li>}
        {healthTokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
            <div>
              <span className="font-semibold">{t.label}</span>
              <span className="text-[#8A8E85]"> · created {new Date(t.created_at).toLocaleDateString()} · {t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleString()}` : 'never used'}{t.revoked_at ? ' · revoked' : ''}</span>
            </div>
            {!t.revoked_at && <button className="font-semibold text-rose-600 hover:underline" onClick={() => revokeHealthToken(t.id).catch((e) => showToast(e.message, 'error'))}>Revoke</button>}
          </li>
        ))}
      </ul>

      <div className="pt-1 text-[11px] text-[#8A8E85]">
        {active.length === 0 ? (
          <p>Status stays “Not connected” until an ingest token is generated and a companion app sends data.</p>
        ) : (
          <div className="flex items-center justify-between">
            <p>Status stays “Not connected” until your companion app sends its first workout payload.</p>
            <button type="button" onClick={() => setShowCurl(!showCurl)} className="underline text-xs text-[#526B55] dark:text-[#A8BDA1]">
              {showCurl ? 'Hide sample curl' : 'Show sample curl'}
            </button>
          </div>
        )}
      </div>

      {showCurl && (
        <div className="rounded-lg bg-[#F5F5F0] dark:bg-[#181A17] p-2.5 text-[10px] font-mono overflow-x-auto">
          <p className="text-[#8A8E85] mb-1 font-sans">Send a test workout using curl (replace &lt;YOUR_TOKEN&gt; with your ingest token):</p>
          <pre className="whitespace-pre-wrap">{sampleCurl('<YOUR_TOKEN>')}</pre>
        </div>
      )}
    </div>
  );
};
