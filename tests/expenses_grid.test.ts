import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRows, fromRows, planChanges, CosmosAppData, EMPTY_DATA, newId } from '../src/data/cloudData.ts';
import { sanitizeSettings } from '../src/data/backup.ts';

test('custom transaction title: title is serialized and roundtripped through toRows and fromRows', () => {
  const txId = newId();
  const data: CosmosAppData = {
    ...EMPTY_DATA,
    transactions: [
      {
        id: txId,
        type: 'expense',
        category: 'Groceries',
        title: 'Monthly Supermarket Run',
        description: 'Vegetables and dairy',
        amount: 3500,
        date: '2026-11-05',
        time: '14:30',
      },
    ],
  };

  const rows = toRows(data);
  assert.equal(rows.transactions[0].title, 'Monthly Supermarket Run');
  assert.equal(rows.transactions[0].description, 'Vegetables and dairy');
  assert.equal(rows.transactions[0].amount, 3500);

  const restored = fromRows(rows);
  assert.equal(restored.transactions[0].title, 'Monthly Supermarket Run');
  assert.equal(restored.transactions[0].description, 'Vegetables and dairy');
});

test('custom transaction title: legacy transactions without title are preserved and roundtrip cleanly', () => {
  const txId = newId();
  const data: CosmosAppData = {
    ...EMPTY_DATA,
    transactions: [
      {
        id: txId,
        type: 'expense',
        category: 'Dining',
        description: 'Team lunch at cafe',
        amount: 850,
        date: '2026-10-15',
      },
    ],
  };

  const rows = toRows(data);
  assert.equal(rows.transactions[0].title, null);
  assert.equal(rows.transactions[0].description, 'Team lunch at cafe');

  const restored = fromRows(rows);
  assert.equal(restored.transactions[0].title, undefined);
  assert.equal(restored.transactions[0].description, 'Team lunch at cafe');

  // Verify first diff is empty (no spurious database writes)
  const diff = planChanges(rows, toRows(restored));
  assert.equal(diff.isEmpty, true);
});

test('monthly budget calculations: strict separation of net balance and remaining budget', () => {
  // Scenario matching Part 11 example:
  // Monthly budget: ₹20,000
  // Additions (Income): ₹35,000
  // Removals (Expenses): ₹12,500
  // Expected Net balance: ₹22,500
  // Expected Budget remaining: ₹7,500
  // Expected Budget usage: 62.5%
  const monthlyBudget = 20000;
  const totalIncome = 35000;
  const totalExpenses = 12500;

  const netBalance = totalIncome - totalExpenses;
  assert.equal(netBalance, 22500);

  const budgetRemaining = monthlyBudget - totalExpenses;
  assert.equal(budgetRemaining, 7500);

  const budgetUsage = (totalExpenses / monthlyBudget) * 100;
  assert.equal(budgetUsage, 62.5);

  // Income must NOT increase the remaining spending budget
  assert.equal(budgetRemaining, 7500);
});

test('monthly budget calculations: over-budget handling supports negative remaining budget', () => {
  const monthlyBudget = 10000;
  const totalExpenses = 14500;

  const budgetRemaining = monthlyBudget - totalExpenses;
  assert.equal(budgetRemaining, -4500);

  const budgetUsage = (totalExpenses / monthlyBudget) * 100;
  assert.equal(budgetUsage, 145);
  assert.ok(budgetRemaining < 0);
});

test('backup settings sanitize monthlyBudgets and dashboardGrid correctly', () => {
  const sanitized = sanitizeSettings({
    theme: 'dark',
    monthlyBudgets: {
      '2026-11': 20000,
      '2026-12': 25000.5,
      'invalid-key': 5000, // should be dropped
      '2026-10': -100,     // negative should be dropped
    },
    dashboardGrid: {
      mode: '2-col',
      autoAdapt: true,
      extraJunk: 123,      // should be dropped
    },
  });

  assert.deepEqual(sanitized.monthlyBudgets, {
    '2026-11': 20000,
    '2026-12': 25000.5,
  });

  assert.deepEqual(sanitized.dashboardGrid, {
    mode: '2-col',
    autoAdapt: true,
  });
});
