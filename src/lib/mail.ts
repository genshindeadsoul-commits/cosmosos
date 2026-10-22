export const FOLDERS = [
  { id: 'inbox', label: 'Inbox' }, { id: 'all', label: 'All Mail' }, { id: 'sent', label: 'Sent' }, { id: 'drafts', label: 'Drafts' },
  { id: 'starred', label: 'Starred' }, { id: 'spam', label: 'Spam' }, { id: 'trash', label: 'Trash' },
] as const;
export type FolderId = (typeof FOLDERS)[number]['id'];
export const isFolderId = (v: unknown): v is FolderId => FOLDERS.some((f) => f.id === v);

export const GMAIL_SCOPES = {
  modify: 'https://www.googleapis.com/auth/gmail.modify',
  send: 'https://www.googleapis.com/auth/gmail.send',
} as const;

/** Downloaded files get a safe name: no path parts, control characters, or leading dots/dashes. */
export function sanitizeFilename(name: string, fallback = 'attachment'): string {
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/^[.\s-]+/, '').trim().slice(0, 120);
  return base || fallback;
}

/** Gmail returns base64url. Always a generic MIME type so the browser downloads instead of rendering. */
export function base64UrlToBlob(data: string): Blob {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'application/octet-stream' });
}

export const senderName = (from: string) => from.replace(/<[^>]*>/, '').replace(/^["'\s]+|["'\s]+$/g, '').trim() || from;
export const senderAddress = (from: string) => from.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ?? (from.includes('@') ? from.trim() : '');

export const replySubject = (s: string) => (/^re:\s/i.test(s) ? s : `Re: ${s}`);

export function quoteForReply(from: string, date: string, body: string, maxLines = 60): string {
  const lines = body.split(/\r?\n/).slice(0, maxLines).map((l) => `> ${l}`).join('\n');
  return `\n\nOn ${date}, ${senderName(from)} wrote:\n${lines}`;
}

export function formatMailDate(ms: number | null, fallback: string, now = new Date()): string {
  if (!ms) return fallback.slice(0, 16);
  const d = new Date(ms);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.getFullYear() === now.getFullYear() ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Appending pages must never show the same message twice (All Mail can repeat ids across pages). */
export function mergeUnique<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((m) => m.id));
  return [...existing, ...incoming.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))];
}
