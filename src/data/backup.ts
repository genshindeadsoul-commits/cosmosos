import { CosmosAppData, EMPTY_DATA, isUuid, newId } from './cloudData';

export const BACKUP_VERSION = 2;
const MAX_BYTES = 5 * 1024 * 1024;
const LISTS = ['tasks', 'events', 'notes', 'tables', 'transactions', 'subscriptions', 'workouts', 'goals', 'habits', 'trackers'] as const;

export function exportCosmosBackup(data: CosmosAppData): void {
  const payload = { ...data, version: BACKUP_VERSION, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cosmos-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ParseResult =
  | { ok: true; data: CosmosAppData; counts: { total: number; remapped: number } }
  | { ok: false; error: string };

/** Pure validation + normalization. Never touches current data; the caller merges the result. */
export function parseBackup(json: string): ParseResult {
  if (json.length > MAX_BYTES) return { ok: false, error: 'Backup file is larger than 5 MB.' };
  let raw: any;
  try { raw = JSON.parse(json); } catch { return { ok: false, error: 'File is not valid JSON.' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Unexpected backup format.' };
  if (raw.version !== undefined && typeof raw.version !== 'string' && typeof raw.version !== 'number') {
    return { ok: false, error: 'Backup has an invalid version field.' };
  }
  if (!LISTS.some((k) => Array.isArray(raw[k]))) return { ok: false, error: 'Backup contains no Cosmos OS records.' };

  const data: CosmosAppData = structuredClone(EMPTY_DATA);
  for (const k of LISTS) {
    const v = raw[k];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.some((x) => !x || typeof x !== 'object')) return { ok: false, error: `"${k}" is malformed.` };
    (data as any)[k] = v;
  }

  // Re-key anything whose id isn't a UUID (e.g. "task-1" from older exports), keeping links intact.
  let remapped = 0;
  const map = new Map<string, string>();
  const fix = (id: unknown): string => {
    if (isUuid(id)) return id;
    const key = String(id ?? '');
    if (!map.has(key)) { map.set(key, newId()); remapped++; }
    return map.get(key)!;
  };
  data.notes.forEach((n) => { n.id = fix(n.id); n.tags = Array.isArray(n.tags) ? n.tags : []; });
  data.tasks.forEach((t) => { t.id = fix(t.id); if (t.linkedNoteId) t.linkedNoteId = fix(t.linkedNoteId); });
  data.events.forEach((e) => { e.id = fix(e.id); e.source = e.source === 'google_calendar' ? 'google_calendar' : 'local'; });
  data.transactions.forEach((t) => { t.id = fix(t.id); });
  data.subscriptions.forEach((s) => { s.id = fix(s.id); });
  data.workouts.forEach((w) => { w.id = fix(w.id); w.exercises = Array.isArray(w.exercises) ? w.exercises : []; });
  data.goals.forEach((g) => { g.id = fix(g.id); });
  data.habits.forEach((h) => { h.id = fix(h.id); h.checkins = h.checkins && typeof h.checkins === 'object' ? h.checkins : {}; });
  data.trackers.forEach((t) => { t.id = fix(t.id); t.entries = (Array.isArray(t.entries) ? t.entries : []).map((e) => ({ ...e, id: fix(e.id) })); });
  data.tables.forEach((t) => {
    t.id = fix(t.id);
    t.columns = Array.isArray(t.columns) ? t.columns : [];
    t.rows = (Array.isArray(t.rows) ? t.rows : []).map((r) => ({ ...r, id: fix(r.id) }));
  });

  // Reject rows the database would refuse, so one bad record can't fail the whole save later.
  const real = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const [y, m, d] = v.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  };
  const iso = { test: real };
  const bad = [
    ...data.transactions.filter((t) => !iso.test(t.date) || !Number.isFinite(t.amount)).map((t) => `expense "${t.description}"`),
    ...data.events.filter((e) => !iso.test(e.date)).map((e) => `event "${e.title}"`),
    ...data.tasks.filter((t) => !t.title || (t.dueDate && !iso.test(t.dueDate))).map((t) => `task "${t.title}"`),
  ];
  if (bad.length) return { ok: false, error: `Invalid dates/amounts in: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}. Nothing was imported.` };

  const total = LISTS.reduce((n, k) => n + data[k].length, 0);
  return { ok: true, data, counts: { total, remapped } };
}
