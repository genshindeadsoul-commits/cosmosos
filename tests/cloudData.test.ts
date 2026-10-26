import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRows, fromRows, planChanges, computeStreak, newId, isUuid, EMPTY_DATA, CosmosAppData, healIds, findInvalidIds, describeSaveFailures } from '../src/data/cloudData.ts';

const hid = newId(), tid = newId(), nid = newId(), tblId = newId();
const sample = (): CosmosAppData => ({
  ...EMPTY_DATA,
  notes: [{ id: nid, title: 'N', content: 'c', excerpt: 'c', starred: true, tags: ['a'], createdAt: '', updatedAt: '' }],
  tasks: [{ id: newId(), title: 'T', list: 'Inbox', status: 'todo', priority: 'LOW', dueDate: '', createdAt: '', linkedNoteId: nid }],
  habits: [{ id: hid, name: 'H', category: 'x', streak: 0, checkins: { '2026-10-18': true, '2026-10-19': true, '2026-10-10': false } }],
  trackers: [{ id: tid, name: 'Water', unit: 'ml', targetPerDay: 2000, entries: [{ id: newId(), date: '2026-10-19', value: 500 }] }],
  tables: [{ id: tblId, name: 'T', description: '', updatedAt: '', columns: [{ id: 'c1', name: 'A', type: 'text' }],
    rows: [{ id: newId(), c1: 'x' }, { id: newId(), c1: 'y' }] }],
  transactions: [{ id: newId(), type: 'expense', category: 'Dining', description: 'Lunch', amount: 12.5, date: '2026-10-19' }],
});

test('ids are uuids', () => assert.ok(isUuid(newId())));

test('first diff after load is empty (no spurious writes)', () => {
  const rows = toRows(sample());
  assert.equal(planChanges(rows, toRows(fromRows(rows))).isEmpty, true);
});

test('false check-ins are not persisted; true ones are', () => {
  assert.equal(toRows(sample()).habit_checkins.length, 2);
});

test('expense amounts are stored non-negative; sign comes from type', () => {
  const d = sample(); d.transactions[0].amount = -12.5;
  assert.equal(toRows(d).transactions[0].amount, 12.5);
});

test('editing one note upserts exactly that row', () => {
  const a = sample(); const b = structuredClone(a); b.notes[0].title = 'Edited';
  const plan = planChanges(toRows(a), toRows(b));
  assert.equal(plan.upserts.notes?.length, 1);
  assert.equal(Object.keys(plan.upserts).length, 1);
  assert.equal(Object.keys(plan.deletes).length, 0);
});

test('un-checking a habit deletes only that check-in', () => {
  const a = sample(); const b = structuredClone(a); b.habits[0].checkins['2026-10-19'] = false;
  const plan = planChanges(toRows(a), toRows(b));
  assert.deepEqual(plan.deletes.habit_checkins, [{ habit_id: hid, checkin_date: '2026-10-19' }]);
  assert.equal(plan.upserts.habit_checkins, undefined);
});

test('deleting a table row and reordering is detected', () => {
  const a = sample(); const b = structuredClone(a); b.tables[0].rows.shift();
  const plan = planChanges(toRows(a), toRows(b));
  assert.equal(plan.deletes.table_rows?.length, 1);
  assert.equal(plan.upserts.table_rows?.length, 1); // remaining row's position changed 1 -> 0
});

test('same data twice produces no duplicate writes', () => {
  const a = sample();
  assert.equal(planChanges(toRows(a), toRows(structuredClone(a))).isEmpty, true);
});

test('streak: counts back from today, or from yesterday if today unchecked', () => {
  const today = new Date(2026, 9, 19);
  assert.equal(computeStreak({ '2026-10-19': true, '2026-10-18': true, '2026-10-17': true }, today), 3);
  assert.equal(computeStreak({ '2026-10-18': true, '2026-10-17': true }, today), 2);
  assert.equal(computeStreak({ '2026-10-16': true }, today), 0);
  assert.equal(computeStreak({}, today), 0);
});

test('missing values stay distinguishable from zero for optional text/date fields', () => {
  const d = sample();
  const row = toRows(d).tasks[0];
  assert.equal(row.due_date, null);
  assert.equal(fromRows(toRows(d)).tasks[0].dueDate, '');
});

import { parseBackup } from '../src/data/backup.ts';
test('backup: legacy ids are re-keyed and note links survive', () => {
  const r = parseBackup(JSON.stringify({ notes: [{ id: 'note-1', title: 'a', tags: [] }], tasks: [{ id: 'task-1', title: 't', linkedNoteId: 'note-1', dueDate: '2026-10-19' }] }));
  assert.ok(r.ok);
  if (r.ok) { assert.ok(isUuid(r.data.notes[0].id)); assert.equal(r.data.tasks[0].linkedNoteId, r.data.notes[0].id); assert.equal(r.counts.remapped, 2); }
});
test('backup: malformed / empty / bad-date input is rejected without partial import', () => {
  assert.equal(parseBackup('not json').ok, false);
  assert.equal(parseBackup('{}').ok, false);
  assert.equal(parseBackup(JSON.stringify({ transactions: [{ id: 'x', description: 'd', date: 'yesterday', amount: 1 }] })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ tasks: 'nope' })).ok, false);
});

import { nextOccurrence } from '../src/lib/recurrence.ts';
test('recurrence: daily/weekly cross month and year boundaries', () => {
  assert.equal(nextOccurrence('2026-12-31', 'daily'), '2027-01-01');
  assert.equal(nextOccurrence('2026-12-28', 'weekly'), '2027-01-04');
  assert.equal(nextOccurrence('2028-02-28', 'daily'), '2028-02-29'); // leap year
});
test('recurrence: monthly clamps to month end and returns to the anchor day', () => {
  assert.equal(nextOccurrence('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(nextOccurrence('2026-02-28', 'monthly', 31), '2026-03-31');
  assert.equal(nextOccurrence('2026-12-15', 'monthly'), '2027-01-15');
});
test('recurrence survives the row mapping', () => {
  const d = { ...EMPTY_DATA, tasks: [{ id: newId(), title: 'Rent', list: 'Inbox' as const, status: 'todo' as const, priority: 'LOW' as const, dueDate: '2026-11-01', createdAt: '', recurrence: 'monthly' as const }] };
  assert.equal(fromRows(toRows(d)).tasks[0].recurrence, 'monthly');
});

test('backup: impossible calendar dates (Feb 31) are rejected, not rolled over', () => {
  assert.equal(parseBackup(JSON.stringify({ transactions: [{ id: 'x', description: 'd', date: '2026-02-31', amount: 1 }] })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ transactions: [{ id: 'x', description: 'd', date: '2028-02-29', amount: 1 }] })).ok, true);
});


// ---------- ID safety: the "r-1792730074210" class of bug ----------
const legacy = (): CosmosAppData => ({
  ...EMPTY_DATA,
  notes: [{ id: 'note-1', title: 'N', content: '', excerpt: '', starred: false, tags: [], createdAt: '', updatedAt: '' }],
  tasks: [{ id: 't-17', title: 'T', list: 'Inbox', status: 'todo', priority: 'LOW', dueDate: '', createdAt: '', linkedNoteId: 'note-1' },
          { id: newId(), title: 'Dangling', list: 'Inbox', status: 'todo', priority: 'LOW', dueDate: '', createdAt: '', linkedNoteId: 'note-gone' }],
  events: [{ id: 'e-1', title: 'E', date: '2026-10-19', startTime: '', endTime: '', category: 'x', source: 'local' }],
  transactions: [{ id: 'tx-1', type: 'expense', category: 'Dining', description: 'd', amount: 1, date: '2026-10-19' }],
  subscriptions: [{ id: 'sub-1', name: 'S', amount: 1, billingCycle: 'monthly', renewalDate: '2026-10-19' }],
  workouts: [{ id: 'w-1', title: 'W', date: '2026-10-19', durationMinutes: 1, calories: 1, exercises: [] }],
  goals: [{ id: 'g-1', title: 'G', category: 'FINANCE' as any, current: 0, target: 1, unit: '', targetDate: '', completed: false }],
  habits: [{ id: 'h-1', name: 'H', category: 'x', streak: 0, checkins: { '2026-10-19': true } }],
  trackers: [{ id: 'trk-1', name: 'T', unit: 'ml', targetPerDay: 1, entries: [{ id: 'en-1', date: '2026-10-19', value: 1 }] }],
  tables: [{ id: 'table-1', name: 'T', description: '', updatedAt: '', columns: [{ id: 'c1', name: 'A', type: 'text' }], rows: [{ id: 'r-1792730074210', c1: 'x' }, { id: 'r-1792730074211', c1: 'y' }] }],
});

test('healIds repairs the exact id from the bug report, in every collection, without breaking relationships', () => {
  const { data, map } = healIds(legacy());
  assert.ok(map.has('r-1792730074210'));
  const rows = toRows(data);
  for (const [table, list] of Object.entries(rows)) for (const row of list) for (const col of ['id', 'habit_id', 'table_id', 'tracker_id', 'linked_note_id']) {
    if (col in row && row[col] != null) assert.ok(isUuid(row[col]), `${table}.${col} = ${row[col]}`);
  }
  assert.equal(data.tasks[0].linkedNoteId, data.notes[0].id);                 // link follows the re-keyed note
  assert.equal(data.tasks[1].linkedNoteId, undefined);                         // dangling link dropped, never sent to the FK
  assert.equal(rows.table_rows.every((r) => r.table_id === data.tables[0].id), true);
  assert.equal(rows.tracker_entries[0].tracker_id, data.trackers[0].id);
  assert.equal(rows.habit_checkins[0].habit_id, data.habits[0].id);
  assert.deepEqual(data.tables[0].rows.map((r) => r.c1), ['x', 'y']);          // content untouched
  assert.equal(findInvalidIds(planChanges(toRows(EMPTY_DATA), rows)).length, 0);
});
test('healIds is a no-op (same reference) for valid data, and stable on repeat', () => {
  const ok = fromRows(toRows({ ...EMPTY_DATA, notes: [{ id: newId(), title: 'a', content: '', excerpt: '', starred: false, tags: [], createdAt: '', updatedAt: '' }] }));
  assert.equal(healIds(ok).data, ok);
  const once = healIds(legacy()).data;
  assert.equal(healIds(once).data, once);                                     // idempotent: no churn, no render loop
  const a = healIds(legacy()), b = healIds(legacy());
  assert.notEqual(a.data.notes[0].id, b.data.notes[0].id);                    // fresh ids each time, never collisions
});
test('findInvalidIds catches a bad id before it reaches the database', () => {
  const bad = legacy();
  const plan = planChanges(toRows(EMPTY_DATA), toRows(bad));
  const found = findInvalidIds(plan);
  assert.ok(found.some((f) => f.table === 'table_rows' && f.value === 'r-1792730074210'));
  assert.ok(found.some((f) => f.table === 'tasks' && f.value === 'note-1'));
});
test('save errors become one actionable sentence per module', () => {
  assert.match(describeSaveFailures([{ table: 'table_rows', message: 'invalid input syntax for type uuid: "r-1"' }]), /Couldn’t save Tables \(an item had an invalid ID\)\. Your edits are kept on this page\. Press Retry\./);
  assert.match(describeSaveFailures([{ table: 'habits', message: 'x', code: '42501' }, { table: 'habit_checkins', message: 'y' }]), /Habits \(your account isn’t allowed to save this\)/);
  assert.match(describeSaveFailures([{ table: 'notes', message: 'TypeError: Failed to fetch' }]), /Notes \(network problem\)/);
  assert.match(describeSaveFailures([{ table: 'tasks', message: 'x', code: '23503' }]), /no longer exists/);
  assert.match(describeSaveFailures([{ table: 'goals', message: 'JWT expired' }]), /session expired/);
  const multi = describeSaveFailures([{ table: 'transactions', message: 'a' }, { table: 'workouts', message: 'b' }]);
  assert.ok(multi.includes('Expenses') && multi.includes('Fitness'));
});
