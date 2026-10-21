import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv, guessMapping, planCsvImport } from '../src/lib/csv.ts';

test('parses quoted commas, escaped quotes, and embedded newlines in one cell', () => {
  const rows = parseCsv('Name,Note\r\n"Smith, John","He said ""hi""\nsecond line"\r\nAnn,plain\r\n');
  assert.deepEqual(rows, [['Name', 'Note'], ['Smith, John', 'He said "hi"\nsecond line'], ['Ann', 'plain']]);
});
test('handles BOM, LF/CR endings, semicolon and tab delimiters, blank lines', () => {
  assert.deepEqual(parseCsv('\uFEFFa;b\n1;2\n\n3;4'), [['a', 'b'], ['1', '2'], ['3', '4']]);
  assert.deepEqual(parseCsv('a\tb\r1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b\n1,'), [['a', 'b'], ['1', '']]);
});
test('unclosed quote is an error, not silent corruption', () => {
  assert.throws(() => parseCsv('a,b\n"oops,1'), /unclosed quote/);
});
test('export round-trips through import, including awkward cells', () => {
  const src = [['A', 'B'], ['x, y', 'say "no"'], ['multi\nline', '']];
  assert.deepEqual(parseCsv(toCsv(src)), src);
});
test('export neutralizes spreadsheet formulas but leaves negative numbers alone', () => {
  const out = toCsv([['=HYPERLINK("http://evil")', '-5', '+1 555', '@cmd', 'ok']]);
  assert.match(out, /"'=HYPERLINK/); assert.match(out, /"-5"/); assert.match(out, /"'\+1 555"/); assert.match(out, /"'@cmd"/);
});

const cols = [{ id: 'c1', name: 'Name', type: 'text' as const }, { id: 'c2', name: 'Amount', type: 'number' as const },
  { id: 'c3', name: 'Due', type: 'date' as const }, { id: 'c4', name: 'State', type: 'status' as const, options: ['Open', 'Done'] }];
test('maps by header name regardless of column order; unknown headers are skipped', () => {
  const m = guessMapping(['amount', 'Extra', ' name '], cols);
  assert.deepEqual(m, { 0: 'c2', 1: null, 2: 'c1' });
});
test('plan: validates numbers/dates/status, reports line numbers, never silently coerces', () => {
  const m = guessMapping(['Name', 'Amount', 'Due', 'State'], cols);
  const p = planCsvImport([
    ['a', '1,200.50', '2026-10-19', 'Open'], ['b', 'abc', '2026-10-19', 'Open'], ['c', '5', '2026-02-31', 'Open'], ['d', '5', '2026-10-19', 'Maybe'], ['e', '', '', ''],
  ], m, cols, []);
  assert.equal(p.valid.length, 2);
  assert.equal(p.valid[0].c2, '1200.5');
  assert.deepEqual(p.errors.map((e) => e.line), [3, 4, 5]);
  assert.match(p.errors[1].message, /valid date/);
});
test('plan: duplicates against existing rows and within the file are skipped', () => {
  const m = guessMapping(['Name', 'Amount', 'Due', 'State'], cols);
  const existing = [{ id: 'r', c1: 'a', c2: '1', c3: '', c4: '' }];
  const p = planCsvImport([['a', '1', '', ''], ['z', '2', '', ''], ['z', '2', '', '']], m, cols, existing);
  assert.equal(p.valid.length, 1); assert.equal(p.duplicates, 2);
});
test('plan: unmapped table columns import as empty, not undefined', () => {
  const p = planCsvImport([['only name']], { 0: 'c1' }, cols, []);
  assert.deepEqual(p.valid[0], { c1: 'only name', c2: '', c3: '', c4: '' });
});
