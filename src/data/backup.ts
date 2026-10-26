import { CosmosAppData, EMPTY_DATA, isUuid, newId } from './cloudData';
import { parseMusicLink } from '../lib/musicLinks';
import type { PlaylistItem } from '../lib/playlists';

/** v1/v2: flat lists (older exports). v3: wrapped envelope with settings and integrity counts. */
export const BACKUP_VERSION = 3;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const LISTS = ['tasks', 'events', 'notes', 'tables', 'transactions', 'subscriptions', 'workouts', 'goals', 'habits', 'trackers'] as const;
export type ListName = (typeof LISTS)[number];

/** Only non-sensitive application settings travel in a backup. Never tokens, secrets, passwords, or provider credentials. */
export interface BackupSettings {
  theme?: 'light' | 'dark' | 'system';
  playlists?: PlaylistItem[]; activePlaylistId?: string; mailFolder?: string;
  appleMusic?: { x?: number; y?: number; w?: number; h?: number; mode?: 'compact' | 'expanded' | 'minimized'; visible?: boolean };
}

const SECRETISH = /token|secret|password|passwd|credential|api[_-]?key|authorization|cookie|refresh/i;
/** Defense in depth: drop anything credential-shaped, at any depth, even if a future setting accidentally holds one. */
export function stripSecrets<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripSecrets) as unknown as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !SECRETISH.test(k)).map(([k, x]) => [k, stripSecrets(x)])) as T;
  return v;
}

export function countRecords(d: CosmosAppData): number { return LISTS.reduce((n, k) => n + d[k].length, 0); }

export function buildBackupJson(data: CosmosAppData, settings: BackupSettings = {}, now = new Date()): string {
  const lists = Object.fromEntries(LISTS.map((k) => [k, data[k]]));
  const counts = Object.fromEntries(LISTS.map((k) => [k, data[k].length]));
  return JSON.stringify({ app: 'cosmos-os', formatVersion: BACKUP_VERSION, createdAt: now.toISOString(), counts, data: lists, settings: stripSecrets(settings) });
}

export function exportCosmosBackup(data: CosmosAppData, settings: BackupSettings = {}): void {
  const blob = new Blob([buildBackupJson(data, settings)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cosmos-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ParseResult =
  | { ok: true; data: CosmosAppData; settings: BackupSettings; counts: { total: number; remapped: number }; createdAt: string | null; formatVersion: number; legacy: boolean }
  | { ok: false; error: string };

const real = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** Settings come from a file, so every value is re-validated: playlist links are re-parsed, layout numbers re-bounded. */
export function sanitizeSettings(raw: any): BackupSettings {
  if (!raw || typeof raw !== 'object') return {};
  const out: BackupSettings = {};
  if (raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system') out.theme = raw.theme;
  if (typeof raw.mailFolder === 'string' && /^(inbox|all|sent|drafts|starred|spam|trash)$/.test(raw.mailFolder)) out.mailFolder = raw.mailFolder;
  if (Array.isArray(raw.playlists)) {
    const lists: PlaylistItem[] = raw.playlists.slice(0, 50).flatMap((p: any): PlaylistItem[] => {
      const r = typeof p?.openUrl === 'string' ? parseMusicLink(p.openUrl) : null;
      if (!r || !r.ok) return [];
      return [{ id: typeof p.id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(p.id) ? p.id : newId(), name: (typeof p.name === 'string' ? p.name : '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || 'Playlist', provider: r.provider, kind: r.kind, openUrl: r.openUrl, embedUrl: r.embedUrl, enabled: p.enabled !== false }];
    });
    out.playlists = lists;
    if (typeof raw.activePlaylistId === 'string' && lists.some((p) => p.id === raw.activePlaylistId)) out.activePlaylistId = raw.activePlaylistId;
  }
  const am = raw.appleMusic;
  if (am && typeof am === 'object') {
    const n = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined);
    out.appleMusic = { x: n(am.x, 0, 10000), y: n(am.y, 0, 10000), w: n(am.w, 280, 640), h: n(am.h, 120, 640), mode: ['compact', 'expanded', 'minimized'].includes(am.mode) ? am.mode : undefined, visible: typeof am.visible === 'boolean' ? am.visible : undefined };
  }
  return out;
}

/** Pure validation + normalization. Never touches current data; the caller decides how to apply the result. */
export function parseBackup(json: string): ParseResult {
  if (json.length > MAX_BACKUP_BYTES) return { ok: false, error: 'Backup file is larger than 10 MB.' };
  let raw: any;
  try { raw = JSON.parse(json); } catch { return { ok: false, error: 'File is not valid JSON.' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Unexpected backup format.' };

  const wrapped = raw.app === 'cosmos-os';
  let formatVersion = 2, createdAt: string | null = null, source = raw, settings: BackupSettings = {};
  if (wrapped) {
    if (!Number.isInteger(raw.formatVersion) || raw.formatVersion < 1) return { ok: false, error: 'Backup has an invalid version.' };
    if (raw.formatVersion > BACKUP_VERSION) return { ok: false, error: `This backup was made by a newer version of Cosmos OS (format ${raw.formatVersion}). Update the app before restoring it.` };
    if (!raw.data || typeof raw.data !== 'object') return { ok: false, error: 'Backup has no data section.' };
    formatVersion = raw.formatVersion; source = raw.data; createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : null;
    settings = sanitizeSettings(raw.settings);
  } else if (raw.version !== undefined && typeof raw.version !== 'string' && typeof raw.version !== 'number') {
    return { ok: false, error: 'Backup has an invalid version field.' };
  }
  if (!LISTS.some((k) => Array.isArray(source[k]))) return { ok: false, error: 'Backup contains no Cosmos OS records.' };

  const data: CosmosAppData = structuredClone(EMPTY_DATA);
  for (const k of LISTS) {
    const v = source[k];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.some((x) => !x || typeof x !== 'object')) return { ok: false, error: `"${k}" is malformed.` };
    (data as any)[k] = v;
  }
  // Integrity: the envelope records how many items each list had when it was written. A mismatch means truncation/tampering.
  if (wrapped && raw.counts && typeof raw.counts === 'object') {
    for (const k of LISTS) if (typeof raw.counts[k] === 'number' && raw.counts[k] !== data[k].length) return { ok: false, error: `The backup is incomplete or damaged: "${k}" should have ${raw.counts[k]} items but has ${data[k].length}.` };
  }

  // Re-key anything whose id isn't a UUID (older exports), keeping links intact.
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
  const bad = [
    ...data.transactions.filter((t) => !real(t.date) || !Number.isFinite(t.amount)).map((t) => `expense "${t.description}"`),
    ...data.events.filter((e) => !real(e.date)).map((e) => `event "${e.title}"`),
    ...data.tasks.filter((t) => !t.title || (t.dueDate && !real(t.dueDate))).map((t) => `task "${t.title}"`),
  ];
  if (bad.length) return { ok: false, error: `Invalid dates/amounts in: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}. Nothing was imported.` };

  return { ok: true, data, settings, counts: { total: countRecords(data), remapped }, createdAt, formatVersion, legacy: !wrapped };
}
