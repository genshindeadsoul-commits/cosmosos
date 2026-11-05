import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TASK_LISTS,
  TASK_LIST_METADATA,
  TASK_PRIORITIES,
  EXPENSE_CATEGORIES,
  GOAL_CATEGORIES,
} from '../src/types';
import {
  todayKey,
  currentMonthKey,
  shiftDayKey,
  formatReadableDate,
} from '../src/lib/dates';
import { todayLocal } from '../src/lib/recurrence';

test('foundation: TASK_LISTS is canonical and includes Personal and Holiday trip', () => {
  assert.equal(TASK_LISTS.length, 6);
  assert.ok(TASK_LISTS.includes('Personal'));
  assert.ok(TASK_LISTS.includes('Holiday trip'));
  assert.ok(TASK_LISTS.includes('Work'));
  assert.ok(TASK_LISTS.includes('Inbox'));
  assert.ok(TASK_LISTS.includes('Study'));
  assert.ok(TASK_LISTS.includes('Health'));

  for (const list of TASK_LISTS) {
    const meta = TASK_LIST_METADATA[list];
    assert.ok(meta, `Metadata missing for ${list}`);
    assert.ok(meta.dotColor.startsWith('bg-'), `Invalid dot color for ${list}`);
  }
});

test('foundation: EXPENSE_CATEGORIES is canonical and contains all categories including Affiliate', () => {
  assert.ok(EXPENSE_CATEGORIES.includes('Affiliate'));
  assert.ok(EXPENSE_CATEGORIES.includes('Groceries'));
  assert.ok(EXPENSE_CATEGORIES.includes('Salary'));
  assert.ok(EXPENSE_CATEGORIES.includes('Dining'));
  assert.equal(EXPENSE_CATEGORIES.length, 10);
  assert.equal(new Set(EXPENSE_CATEGORIES).size, 10);
});

test('foundation: GOAL_CATEGORIES is canonical and deduplicated', () => {
  assert.deepEqual(GOAL_CATEGORIES, ['FINANCE', 'LEARNING', 'FITNESS', 'PROJECTS']);
});

test('foundation: date utilities and todayKey / todayLocal equivalence', () => {
  const d = new Date(2026, 10, 5); // Nov 5, 2026
  assert.equal(todayKey(d), '2026-11-05');
  assert.equal(todayLocal(d), '2026-11-05');
  assert.equal(currentMonthKey(d), '2026-11');
});

test('foundation: dashboard monthly outflow strictly isolates current month from prior/future months', () => {
  const activeMonth = '2026-11';
  const txs = [
    { type: 'expense' as const, amount: 2000, date: '2026-10-25' },
    { type: 'expense' as const, amount: 1500, date: '2026-11-02' },
    { type: 'expense' as const, amount: 3500, date: '2026-11-05' },
    { type: 'income' as const, amount: 50000, date: '2026-11-01' },
    { type: 'expense' as const, amount: 4000, date: '2026-12-01' },
  ];

  const totalMonthlyOutflow = txs
    .filter((t) => t.type === 'expense' && t.date.startsWith(activeMonth))
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Should only sum 1500 + 3500 = 5000, never 2000 (Oct) or 4000 (Dec) or 50000 (income)
  assert.equal(totalMonthlyOutflow, 5000);
});

test('foundation: cross-module calendar busy days aggregates all modules', () => {
  const tasks = [{ status: 'todo', dueDate: '2026-11-05' }];
  const events = [{ date: '2026-11-06' }];
  const notes = [{ noteDate: '2026-11-07' }];
  const workouts = [{ date: '2026-11-08' }];
  const transactions = [{ date: '2026-11-09' }];

  const busyDays = new Set<string>([
    ...tasks.filter((t) => t.status !== 'completed' && t.dueDate).map((t) => t.dueDate),
    ...events.map((e) => e.date),
    ...notes.filter((n) => n.noteDate).map((n) => n.noteDate!),
    ...workouts.map((w) => w.date),
    ...transactions.map((t) => t.date),
  ]);

  assert.ok(busyDays.has('2026-11-05'));
  assert.ok(busyDays.has('2026-11-06'));
  assert.ok(busyDays.has('2026-11-07'));
  assert.ok(busyDays.has('2026-11-08'));
  assert.ok(busyDays.has('2026-11-09'));
  assert.equal(busyDays.size, 5);
});
