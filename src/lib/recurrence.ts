export type Recurrence = 'daily' | 'weekly' | 'monthly';

const pad = (n: number) => String(n).padStart(2, '0');
export const todayLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Next due date after `iso` (YYYY-MM-DD). Pure calendar math (no timezone shifts).
 * Monthly clamps to the last day of shorter months: Jan 31 -> Feb 28/29 -> Mar 28 would drift,
 * so callers pass the ORIGINAL anchor day via `anchorDay` to keep Mar 31 after Feb 28.
 */
export function nextOccurrence(iso: string, rule: Recurrence, anchorDay?: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (rule === 'daily' || rule === 'weekly') {
    const dt = new Date(Date.UTC(y, m - 1, d + (rule === 'daily' ? 1 : 7)));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(anchorDay ?? d, last))}`;
}
