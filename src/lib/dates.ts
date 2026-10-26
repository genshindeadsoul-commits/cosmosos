const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;          // m is 0-based
export const todayKey = (now = new Date()) => dayKey(now.getFullYear(), now.getMonth(), now.getDate());
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Blank cells before day 1. weekStart 1 = Monday-first, 0 = Sunday-first. */
export const leadingBlanks = (y: number, m: number, weekStart: 0 | 1) => (new Date(y, m, 1).getDay() - weekStart + 7) % 7;
export const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const shiftMonth = (y: number, m: number, delta: number) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
/** Monday..Sunday of the week containing `now`. */
export function currentWeek(now = new Date()) {
  const mondayOffset = (now.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset + i);
    return { dayLetter: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], dateNum: String(d.getDate()), dateKey: todayKey(d) };
  });
}
export const addMonthsKey = (key: string, months: number) => { const [y, m, d] = key.split('-').map(Number); const t = new Date(y, m - 1 + months, 1); return dayKey(t.getFullYear(), t.getMonth(), Math.min(d, daysInMonth(t.getFullYear(), t.getMonth()))); };
