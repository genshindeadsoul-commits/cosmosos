import { requireSupabase } from './supabase';

export class IntegrationError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const FRIENDLY: Record<string, string> = {
  not_configured: 'This connector isn’t set up on the server yet. The app owner needs to finish setup (docs/SETUP.md).',
  not_connected: 'Not connected. Connect it in Settings first.',
  needs_reauthorization: 'Access expired or was revoked. Reconnect in Settings.',
  rate_limited: 'The provider is rate-limiting requests. Wait a moment and retry.',
  forbidden: 'The provider denied this request (permission or account restriction).',
  unauthorized: 'Your session expired. Sign in again.',
};

/** Invoke an Edge Function as the signed-in user and turn failures into readable errors. */
export async function callFn<T>(name: string, body: unknown = {}): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let code = 'internal', message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); code = j.error ?? code; message = j.message ?? message; }
    } catch { /* non-JSON error body */ }
    if (/failed to send a request|fetch/i.test(message) && code === 'internal') {
      throw new IntegrationError('function_unavailable', 'The server function isn’t reachable. It may not be deployed yet (docs/SETUP.md).');
    }
    throw new IntegrationError(code, FRIENDLY[code] ?? message);
  }
  return data as T;
}

export interface GmailMessageSummary { id: string; threadId: string; from: string; subject: string; date: string; snippet: string; unread: boolean }
export interface GmailMessageFull { id: string; from: string; subject: string; date: string; bodyText: string; attachments: { filename: string; mimeType: string; size: number }[]; webLink: string }
export interface ImportedEvent { providerId: string; title: string; description?: string; date: string; startTime: string; endTime: string; location?: string }

/** Accepts a full Google Sheets URL or a bare id; returns null if neither looks valid. */
export function parseSpreadsheetId(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,100}$/.test(input.trim()) ? input.trim() : null;
}

/** First row = headers; rows padded/trimmed to header width; blank headers get names; duplicate headers de-duplicated. */
export function sheetToTable(values: string[][]): { columns: { id: string; name: string; type: 'text' }[]; rows: Record<string, string>[] } {
  const header = values[0] ?? [];
  const seen = new Map<string, number>();
  const columns = header.map((h, i) => {
    let name = String(h ?? '').trim() || `Column ${i + 1}`;
    const n = (seen.get(name.toLowerCase()) ?? 0) + 1; seen.set(name.toLowerCase(), n);
    if (n > 1) name = `${name} (${n})`;
    return { id: `col-${i + 1}`, name, type: 'text' as const };
  });
  const rows = values.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== '')).map((r) => {
    const o: Record<string, string> = {};
    columns.forEach((c, i) => { o[c.id] = String(r[i] ?? ''); });
    return o;
  });
  return { columns, rows };
}
