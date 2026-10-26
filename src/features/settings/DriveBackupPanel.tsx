import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DriveBackup, useIntegrations } from '../../context/IntegrationsContext';
import { usePrefs } from '../../context/PrefsContext';
import { BackupSettings, buildBackupJson, countRecords, MAX_BACKUP_BYTES, parseBackup, ParseResult } from '../../data/backup';
import { formatBytes } from '../../lib/mail';

const btn = 'rounded border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] disabled:opacity-50';
const primary = 'rounded bg-[#3D5240] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50';
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

type Ok = Extract<ParseResult, { ok: true }>;
interface Pending { backup: DriveBackup; parsed: Ok; mode: 'merge' | 'replace' }

/**
 * Manual Google Drive backup & restore. No automatic or scheduled backups.
 * Backups are new timestamped files (never overwritten), verified after upload; restore validates first, asks
 * before anything can be replaced, and saves a safety backup before a replace. A failure never deletes local data.
 */
export const DriveBackupPanel: React.FC = () => {
  const { getCosmosData, mergeRecords, replaceAllData, showToast, themePreference, setThemePreference } = useApp();
  const { integrations, connect, disconnect, busy, driveCreate, driveList, driveGet, refreshConnections } = useIntegrations();
  const { prefs, update } = usePrefs();
  const drive = integrations.find((i) => i.id === 'gdrive');
  const connected = drive?.status === 'connected';
  const needsReconnect = drive?.status === 'needs_reauthorization';

  const [backups, setBackups] = useState<DriveBackup[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [working, setWorking] = useState<'backup' | 'list' | 'restore' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const currentSettings = (): BackupSettings => ({ theme: themePreference, playlists: prefs.playlists, activePlaylistId: prefs.activePlaylistId, mailFolder: prefs.mailFolder, appleMusic: prefs.appleMusic });

  const loadList = useCallback(async () => {
    setWorking('list'); setListError(null);
    try { setBackups((await driveList()).backups); } catch (e) { setListError((e as Error).message); } finally { setWorking(null); }
  }, [driveList]);
  useEffect(() => { if (connected) void loadList(); else setBackups(null); }, [connected]);

  const createBackup = async (): Promise<boolean> => {
    const json = buildBackupJson(getCosmosData(), currentSettings());
    if (new TextEncoder().encode(json).length > MAX_BACKUP_BYTES) { setMessage({ kind: 'error', text: 'Your data is larger than the 10 MB Drive backup limit. Nothing was uploaded.' }); return false; }
    const r = await driveCreate(json);
    setMessage({ kind: 'ok', text: `Backed up ${r.records} records to Drive as “${r.name}”.` });
    await Promise.all([refreshConnections(), loadList()]);
    return true;
  };
  const backUpNow = async () => {
    setWorking('backup'); setMessage(null);
    try { await createBackup(); }
    catch (e) { setMessage({ kind: 'error', text: `Backup failed: ${(e as Error).message} Your data here is unchanged, and your earlier backups are untouched.` }); void refreshConnections(); }
    finally { setWorking(null); }
  };

  const startRestore = async (b: DriveBackup) => {
    setWorking('restore'); setMessage(null);
    try {
      const file = await driveGet(b.id);
      const parsed = parseBackup(file.content);
      if (!parsed.ok) { setMessage({ kind: 'error', text: `This backup can’t be restored: ${parsed.error} Nothing was changed.` }); return; }
      setPending({ backup: b, parsed, mode: 'merge' });
    } catch (e) { setMessage({ kind: 'error', text: `Couldn’t read that backup: ${(e as Error).message} Nothing was changed.` }); }
    finally { setWorking(null); }
  };

  const confirmRestore = async () => {
    if (!pending) return;
    const { parsed, mode } = pending;
    setWorking('restore'); setMessage(null);
    try {
      if (mode === 'merge') {
        mergeRecords(parsed.data);
        setMessage({ kind: 'ok', text: `Added any missing items from “${pending.backup.name}”. Everything you already had was kept.` });
      } else {
        // A replace can discard current data, so a safety copy must be safely in Drive first. If it can't be saved, stop.
        try { await createBackup(); } catch (e) { setMessage({ kind: 'error', text: `Restore cancelled: a safety backup of your current data couldn’t be saved first (${(e as Error).message}). Nothing was changed.` }); return; }
        replaceAllData(parsed.data);
        const st = parsed.settings;
        if (st.theme) setThemePreference(st.theme);
        update({ ...(st.playlists ? { playlists: st.playlists, activePlaylistId: st.activePlaylistId } : {}), ...(st.mailFolder ? { mailFolder: st.mailFolder } : {}), ...(st.appleMusic ? { appleMusic: st.appleMusic } : {}) });
        setMessage({ kind: 'ok', text: `Restored “${pending.backup.name}”. A safety backup of what you had before is in your Drive history.` });
      }
      setPending(null);
    } finally { setWorking(null); }
  };

  const current = getCosmosData();
  const diff = (() => {
    if (!pending) return null;
    const keys = ['tasks', 'events', 'notes', 'tables', 'transactions', 'subscriptions', 'workouts', 'goals', 'habits', 'trackers'] as const;
    let removed = 0, overwritten = 0, added = 0;
    for (const k of keys) {
      const inBackup = new Set(pending.parsed.data[k].map((x: { id: string }) => x.id));
      const here = new Set(current[k].map((x: { id: string }) => x.id));
      for (const id of here) inBackup.has(id) ? overwritten++ : removed++;
      for (const id of inBackup) if (!here.has(id)) added++;
    }
    return { removed, overwritten, added };
  })();

  return (
    <section aria-labelledby="drive-backup" className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-5 space-y-4 text-[#252821] dark:text-[#ECEDE6]">
      <div>
        <h2 id="drive-backup" className="text-sm font-bold">Backup &amp; Restore (Google Drive)</h2>
        <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">Manual only: nothing is backed up automatically. Backups are saved as new files in a “Cosmos OS Backups” folder in your Drive. Cosmos OS can only see the files it creates there, never the rest of your Drive. Passwords, tokens and other credentials are never included.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold">{connected ? `Connected${drive?.connectedEmail ? ` as ${drive.connectedEmail}` : ''}` : needsReconnect ? 'Access expired or was revoked' : 'Not connected'}</span>
        {connected
          ? <button className={btn} disabled={busy === 'gdrive' || working !== null} onClick={() => void disconnect('gdrive')}>Disconnect</button>
          : <button className={primary} disabled={busy === 'gdrive'} onClick={() => void connect('gdrive')}>{busy === 'gdrive' ? 'Opening Google…' : needsReconnect ? 'Reconnect Google Drive' : 'Connect Google Drive'}</button>}
        {connected && <button className={primary} disabled={working !== null} onClick={() => void backUpNow()}>{working === 'backup' ? 'Backing up…' : 'Back Up Now'}</button>}
      </div>

      {connected && (
        <p className="text-xs" aria-label="Backup status">
          {drive?.lastSync ? <>Last successful backup: <strong>{drive.lastSync}</strong></> : 'No backup has been made yet.'}
          {drive?.description?.includes('Last error:') && <span className="block text-rose-700 dark:text-rose-400">Last attempt failed: {drive.description.split('Last error:')[1].replace('Last backup attempt failed: ', '').trim()}</span>}
        </p>
      )}
      {!connected && !needsReconnect && <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">Cosmos OS works fully without Drive. Connect it only when you want off-site backups.</p>}

      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${message.kind === 'error' ? 'text-rose-700 dark:text-rose-400' : 'text-[#3D5240] dark:text-[#A8BDA1]'}`}>{message.text}</p>}

      {connected && (
        <div>
          <h3 className="mb-1 text-xs font-bold">Backup history</h3>
          {listError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{listError} <button className="underline" onClick={() => void loadList()}>Retry</button></p>}
          {!listError && backups === null && <p role="status" className="text-xs text-[#8A8E85]">Loading…</p>}
          {backups && backups.length === 0 && <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">No backups in Drive yet.</p>}
          {backups && backups.length > 0 && (
            <ul aria-label="Backup history" className="divide-y divide-[#ECEDE7] dark:divide-[#2A2E28] text-xs">
              {backups.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0"><span className="block truncate font-medium">{b.name}</span><span className="text-[#6B7067] dark:text-[#A6AB9F]">{when(b.createdTime)} · {b.records} records · {formatBytes(b.size)}</span></span>
                  <button className={btn} disabled={working !== null} aria-label={`Restore ${b.name}`} onClick={() => void startRestore(b)}>Restore…</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pending && diff && (
        <div role="dialog" aria-modal="true" aria-label="Confirm restore" className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs space-y-3">
          <p className="font-bold">Restore “{pending.backup.name}”?</p>
          <p>Made {when(pending.parsed.createdAt) || 'at an unknown time'} · {pending.parsed.counts.total} records (you currently have {countRecords(current)}){pending.parsed.legacy ? ' · older file format' : ''}. Checked: the file is complete and compatible.</p>
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Restore method</legend>
            <label className="flex items-start gap-2"><input type="radio" name="restore-mode" checked={pending.mode === 'merge'} onChange={() => setPending({ ...pending, mode: 'merge' })} /><span><strong>Add missing items</strong> (safe). Keeps everything you have now and adds what the backup has that you don’t ({diff.added} items).</span></label>
            <label className="flex items-start gap-2"><input type="radio" name="restore-mode" checked={pending.mode === 'replace'} onChange={() => setPending({ ...pending, mode: 'replace' })} /><span><strong>Replace everything with this backup.</strong> Items you have now that aren’t in the backup will be removed.</span></label>
          </fieldset>
          {pending.mode === 'replace' && (
            <p role="alert" className="font-semibold text-rose-800 dark:text-rose-300">This will remove {diff.removed} current item{diff.removed === 1 ? '' : 's'} and overwrite {diff.overwritten} with the backup’s version. First, a safety backup of your current data is saved to Drive; if that fails, nothing changes.</p>
          )}
          <div className="flex gap-2">
            <button className={btn} disabled={working !== null} onClick={() => setPending(null)}>Cancel</button>
            <button className={primary} disabled={working !== null} onClick={() => void confirmRestore()}>{working === 'restore' ? 'Restoring…' : pending.mode === 'replace' ? 'Save safety backup, then replace' : 'Add missing items'}</button>
          </div>
        </div>
      )}
    </section>
  );
};
