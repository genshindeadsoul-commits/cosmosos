import type { TableColumn } from '../types';

/** RFC 4180 parser: quoted fields, escaped quotes, embedded commas/newlines, CRLF/LF/CR, BOM, and ,;\t delimiters. */
export function parseCsv(input: string): string[][] {
  let text = input.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? '';
  const count = (ch: string) => (firstLine.match(new RegExp(ch === '\t' ? '\\t' : `\\${ch}`, 'g')) ?? []).length;
  const delim = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false, i = 0;
  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { inQuotes = true; i++; continue; }
    if (c === delim) { endField(); i++; continue; }
    if (c === '\r') { endRow(); i += text[i + 1] === '\n' ? 2 : 1; continue; }
    if (c === '\n') { endRow(); i++; continue; }
    field += c; i++;
  }
  if (inQuotes) throw new Error('The file has an unclosed quote, so it can’t be read reliably.');
  if (field !== '' || row.length > 0) endRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Spreadsheet apps execute cells starting with = + - @ as formulas. Prefix them so exported data stays data. */
const guard = (v: string) => (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? `'${v}` : v);
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => `"${guard(String(v ?? '')).replace(/"/g, '""')}"`;
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

// ---------- import planning ----------
export type Mapping = Record<number, string | null>;   // file column index -> table column id (null = skip)

export function guessMapping(headers: string[], columns: TableColumn[]): Mapping {
  const byName = new Map(columns.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const used = new Set<string>();
  const m: Mapping = {};
  headers.forEach((h, i) => {
    const id = byName.get(h.trim().toLowerCase());
    m[i] = id && !used.has(id) ? id : null;
    if (m[i]) used.add(m[i]!);
  });
  return m;
}

const isRealDate = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};

export interface ImportPlan {
  valid: Record<string, string>[];
  errors: { line: number; message: string }[];
  duplicates: number;
}

/** `dataRows` excludes the header. Line numbers are 1-based file lines (header = line 1). */
export function planCsvImport(dataRows: string[][], mapping: Mapping, columns: TableColumn[], existing: Record<string, any>[]): ImportPlan {
  const colById = new Map(columns.map((c) => [c.id, c]));
  const sig = (r: Record<string, any>) => JSON.stringify(columns.map((c) => String(r[c.id] ?? '')));
  const seen = new Set(existing.map(sig));
  const plan: ImportPlan = { valid: [], errors: [], duplicates: 0 };
  dataRows.forEach((cells, idx) => {
    const line = idx + 2;
    const rec: Record<string, string> = {};
    let err: string | null = null;
    for (const [i, id] of Object.entries(mapping)) {
      if (!id) continue;
      const col = colById.get(id)!;
      const raw = (cells[+i] ?? '').trim();
      rec[id] = raw;
      if (raw === '') continue;
      if (col.type === 'number' && !Number.isFinite(Number(raw.replace(/,/g, '')))) err = `“${raw}” isn’t a number (${col.name})`;
      else if (col.type === 'number') rec[id] = String(Number(raw.replace(/,/g, '')));
      if (col.type === 'date' && !isRealDate(raw)) err = `“${raw}” isn’t a valid date, use YYYY-MM-DD (${col.name})`;
      if (col.type === 'status' && col.options?.length && !col.options.includes(raw)) err = `“${raw}” isn’t one of ${col.options.join(', ')} (${col.name})`;
    }
    columns.forEach((c) => { if (!(c.id in rec)) rec[c.id] = ''; });
    if (err) { plan.errors.push({ line, message: err }); return; }
    const s = sig(rec);
    if (seen.has(s)) { plan.duplicates++; return; }
    seen.add(s); plan.valid.push(rec);
  });
  return plan;
}
