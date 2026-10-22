// Pure parsing helpers (no network). Unit-tested under Node.

export interface GmailHeaderMap { from: string; subject: string; date: string }
export const rawHeader = (headers: { name: string; value: string }[] = [], name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value ?? '';
type Part = { mimeType?: string; filename?: string; body?: { data?: string; size?: number; attachmentId?: string }; parts?: Part[]; headers?: { name: string; value: string }[] };

export function headerMap(headers: { name: string; value: string }[] = []): GmailHeaderMap {
  const get = (n: string) => headers.find((h) => h.name.toLowerCase() === n)?.value ?? '';
  return { from: get('from'), subject: get('subject') || '(no subject)', date: get('date') };
}

const b64urlToText = (s: string): string => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function htmlToText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim();
}

/** Prefer text/plain; fall back to stripped HTML. Output is PLAIN TEXT only, so the UI never renders remote HTML. */
export function extractBody(payload: Part | undefined, limit = 20000): { text: string; attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[] } {
  const plain: string[] = [], html: string[] = [], attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[] = [];
  const walk = (p?: Part) => {
    if (!p) return;
    if (p.filename && p.body?.attachmentId) attachments.push({ filename: p.filename, mimeType: p.mimeType ?? 'application/octet-stream', size: p.body.size ?? 0, attachmentId: p.body.attachmentId });
    else if (p.mimeType === 'text/plain' && p.body?.data) plain.push(b64urlToText(p.body.data));
    else if (p.mimeType === 'text/html' && p.body?.data) html.push(b64urlToText(p.body.data));
    p.parts?.forEach(walk);
  };
  walk(payload);
  const text = (plain.length ? plain.join('\n') : htmlToText(html.join('\n'))).slice(0, limit);
  return { text, attachments };
}

// ---------- calendar ----------
const pad = (n: number) => String(n).padStart(2, '0');
function clock(dateTime?: string): string {
  const m = dateTime?.match(/T(\d{2}):(\d{2})/);
  if (!m) return '';
  const h = Number(m[1]); const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${m[2]} ${ap}`;
}

export interface NormalizedEvent { providerId: string; title: string; description?: string; date: string; startTime: string; endTime: string; location?: string }

/** Uses the event's OWN wall-clock date/time (not the viewer's timezone), so what Google shows is what we show. */
export function normalizeGoogleEvent(e: any): NormalizedEvent | null {
  if (!e || e.status === 'cancelled' || !e.id) return null;
  const startRaw: string | undefined = e.start?.dateTime ?? e.start?.date;
  if (!startRaw) return null;
  return {
    providerId: String(e.id), title: String(e.summary ?? '(No title)').slice(0, 500),
    description: e.description ? String(e.description).slice(0, 5000) : undefined,
    date: startRaw.slice(0, 10), startTime: clock(e.start?.dateTime), endTime: clock(e.end?.dateTime),
    location: e.location ? String(e.location).slice(0, 500) : undefined,
  };
}

// ---------- health ----------
export interface HealthWorkoutIn { externalId: string; title: string; date: string; durationMinutes?: number | null; calories?: number | null; notes?: string }
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Strict calendar check: JS Date.parse happily rolls 2026-02-31 over to March, Postgres does not. */
export function isRealDate(s: string): boolean {
  if (!ISO.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Missing duration/calories stay NULL (never coerced to 0). Returns first error or the cleaned rows. */
export function validateHealthPayload(body: any): { ok: true; rows: HealthWorkoutIn[] } | { ok: false; error: string } {
  if (!body || !Array.isArray(body.workouts)) return { ok: false, error: 'Expected { workouts: [...] }' };
  if (body.workouts.length === 0 || body.workouts.length > 100) return { ok: false, error: 'Send between 1 and 100 workouts per request.' };
  const rows: HealthWorkoutIn[] = [];
  for (const [i, w] of body.workouts.entries()) {
    const at = `workouts[${i}]`;
    if (typeof w?.externalId !== 'string' || !w.externalId || w.externalId.length > 128) return { ok: false, error: `${at}.externalId required (<=128 chars)` };
    if (typeof w.title !== 'string' || !w.title.trim() || w.title.length > 200) return { ok: false, error: `${at}.title required (<=200 chars)` };
    if (typeof w.date !== 'string' || !isRealDate(w.date)) return { ok: false, error: `${at}.date must be YYYY-MM-DD` };
    const dur = w.durationMinutes ?? null, cal = w.calories ?? null;
    if (dur !== null && (!Number.isInteger(dur) || dur < 0 || dur > 1440)) return { ok: false, error: `${at}.durationMinutes must be an integer 0-1440 or null` };
    if (cal !== null && (!Number.isInteger(cal) || cal < 0 || cal > 20000)) return { ok: false, error: `${at}.calories must be an integer 0-20000 or null` };
    rows.push({ externalId: w.externalId, title: w.title.trim(), date: w.date, durationMinutes: dur, calories: cal, notes: typeof w.notes === 'string' ? w.notes.slice(0, 2000) : undefined });
  }
  return { ok: true, rows };
}
