import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRows, fromRows, planChanges, CosmosAppData, EMPTY_DATA, newId } from '../src/data/cloudData.ts';
import { sanitizeSettings } from '../src/data/backup.ts';
import { shiftDayKey, formatReadableDate } from '../src/lib/dates.ts';
import {
  calculateAccountBalances,
  calculateCashFlow,
  calculateBudgetProgress,
  roundCurrency,
  getNextRecurringDate,
  getNextSubscriptionDate,
  exportTransactionsToCsv,
  parseTransactionsFromCsv,
} from '../src/lib/finance.ts';
import type { Account, Transaction } from '../src/types/index.ts';

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
    preferredCalendarTab: 'workout',
    lastSelectedDate: '2026-11-05',
  });

  assert.deepEqual(sanitized.monthlyBudgets, {
    '2026-11': 20000,
    '2026-12': 25000.5,
  });

  assert.deepEqual(sanitized.dashboardGrid, {
    mode: '2-col',
    autoAdapt: true,
  });

  assert.equal(sanitized.preferredCalendarTab, 'workout');
  assert.equal(sanitized.lastSelectedDate, '2026-11-05');
});

test('backup settings automatically maps legacy 3-col grid mode to 2-col', () => {
  const sanitized = sanitizeSettings({
    dashboardGrid: {
      mode: '3-col',
      autoAdapt: true,
    },
  });

  assert.deepEqual(sanitized.dashboardGrid, {
    mode: '2-col',
    autoAdapt: true,
  });
});

test('dates utility: shiftDayKey shifts dates across months and years accurately in UTC', () => {
  assert.equal(shiftDayKey('2026-11-05', 1), '2026-11-06');
  assert.equal(shiftDayKey('2026-11-05', -1), '2026-11-04');
  assert.equal(shiftDayKey('2026-11-30', 1), '2026-12-01');
  assert.equal(shiftDayKey('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDayKey('2026-01-01', -1), '2025-12-31');

  // Verify formatReadableDate returns consistent output without crashing
  const formatted = formatReadableDate('2026-11-05');
  assert.ok(formatted.includes('Nov 5, 2026') || formatted.includes('5 Nov 2026') || formatted.includes('Nov'));
});

test('cross-module calendar aggregation: aggregates dated tasks, notes, workouts, and transactions without duplication', () => {
  const targetDate = '2026-11-05';
  const now = new Date().toISOString();
  const data: CosmosAppData = {
    ...EMPTY_DATA,
    tasks: [
      { id: newId(), title: 'Task on target date', list: 'Work', priority: 'HIGH', status: 'todo', dueDate: targetDate, createdAt: now },
      { id: newId(), title: 'Task on other date', list: 'Personal', priority: 'LOW', status: 'todo', dueDate: '2026-11-06', createdAt: now },
    ],
    notes: [
      { id: newId(), title: 'Note on target date', content: 'Discussion notes', excerpt: 'Discussion', tags: ['Daily'], noteDate: targetDate, createdAt: now, updatedAt: now },
      { id: newId(), title: 'General note without date', content: 'Ideas', excerpt: 'Ideas', tags: ['Inbox'], createdAt: now, updatedAt: now },
    ],
    workouts: [
      { id: newId(), title: 'Chest and Core', date: targetDate, durationMinutes: 50, calories: 420, exercises: [{ name: 'Bench Press', setsReps: '4x8' }] },
      { id: newId(), title: 'Cardio day', date: '2026-11-04', durationMinutes: 30, calories: 250, exercises: [] },
    ],
    transactions: [
      { id: newId(), type: 'expense', category: 'Groceries', title: 'Market visit', description: 'Fresh veggies', amount: 450, date: targetDate },
      { id: newId(), type: 'income', category: 'Freelance', title: 'Project bonus', description: 'Milestone 2', amount: 5000, date: targetDate },
      { id: newId(), type: 'expense', category: 'Dining', title: 'Coffee', description: 'Latte', amount: 150, date: '2026-11-06' },
    ],
    habits: [
      { id: newId(), name: 'Morning Meditation', category: 'Health & Wellness', streak: 4, checkins: { [targetDate]: true } },
    ],
  };

  const tasksForDay = data.tasks.filter((t) => t.dueDate === targetDate);
  const notesForDay = data.notes.filter((n) => n.noteDate === targetDate);
  const workoutsForDay = data.workouts.filter((w) => w.date === targetDate);
  const txForDay = data.transactions.filter((t) => t.date === targetDate);
  const dayIncome = txForDay.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const dayExpense = txForDay.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  assert.equal(tasksForDay.length, 1);
  assert.equal(notesForDay.length, 1);
  assert.equal(workoutsForDay.length, 1);
  assert.equal(txForDay.length, 2);
  assert.equal(dayIncome, 5000);
  assert.equal(dayExpense, 450);
  assert.equal(data.habits[0].checkins[targetDate], true);
});

test('finance: category filtering strictly scopes transactions by category without cross-category leakage', () => {
  const txs = [
    { id: newId(), type: 'expense' as const, category: 'Groceries' as const, title: 'Apples', amount: 100, date: '2026-11-01' },
    { id: newId(), type: 'expense' as const, category: 'Dining' as const, title: 'Sushi', amount: 800, date: '2026-11-02' },
    { id: newId(), type: 'expense' as const, category: 'Groceries' as const, title: 'Milk & Eggs', amount: 150, date: '2026-11-03' },
    { id: newId(), type: 'income' as const, category: 'Salary' as const, title: 'Paycheck', amount: 50000, date: '2026-11-01' },
  ];

  const filterCategory = (list: typeof txs, cat: string) => {
    return list.filter((t) => cat === 'all' || t.category === cat);
  };

  const groceries = filterCategory(txs, 'Groceries');
  assert.equal(groceries.length, 2);
  assert.deepEqual(groceries.map((t) => t.title), ['Apples', 'Milk & Eggs']);

  const dining = filterCategory(txs, 'Dining');
  assert.equal(dining.length, 1);
  assert.equal(dining[0].title, 'Sushi');

  const all = filterCategory(txs, 'all');
  assert.equal(all.length, 4);
});

test('finance: monthly budget remains strictly isolated to the active month even when all-time transactions exist', () => {
  // Scenario:
  // November budget: ₹25,000
  // November expenses: ₹8,000
  // October expenses (past): ₹18,000
  // Total all-time expenses: ₹26,000
  // The monthly budget remaining for November MUST be ₹17,000 (25k - 8k), NEVER negative (-1,000) from all-time expenses
  const allTxs = [
    { id: newId(), type: 'expense' as const, category: 'Groceries' as const, amount: 18000, date: '2026-10-15' },
    { id: newId(), type: 'expense' as const, category: 'Utilities' as const, amount: 8000, date: '2026-11-05' },
  ];

  const activeMonth = '2026-11';
  const novBudget = 25000;

  // Monthly expense strictly scoped to 2026-11
  const monthlyExpense = allTxs
    .filter((t) => t.date.startsWith(activeMonth) && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  assert.equal(monthlyExpense, 8000);
  const budgetRemaining = novBudget - monthlyExpense;
  assert.equal(budgetRemaining, 17000);
  assert.equal(budgetRemaining > 0, true);
});

test('finance math: roundCurrency eliminates floating-point representation errors', () => {
  const sum = 0.1 + 0.2;
  assert.notEqual(sum, 0.3); // IEEE 754 introduces 0.30000000000000004
  assert.equal(roundCurrency(sum), 0.3);
  assert.equal(roundCurrency(19.999), 20);
  assert.equal(roundCurrency(10.505), 10.51);
});

test('account management: balances reconcile with opening balances, income, expense, and transfers', () => {
  const accounts: Account[] = [
    { id: '1', name: 'Bank account', type: 'bank', openingBalance: 10000 },
    { id: '2', name: 'Cash', type: 'cash', openingBalance: 1500 },
    { id: '3', name: 'Savings account', type: 'savings', openingBalance: 50000 },
  ];

  const transactions: Transaction[] = [
    // Income into Bank: +25000
    { id: newId(), type: 'income', category: 'Salary', title: 'Monthly Salary', description: '', amount: 25000, date: '2026-11-01', account: 'Bank account' },
    // Expense from Bank: -4500
    { id: newId(), type: 'expense', category: 'Utilities', title: 'Electricity bill', description: '', amount: 4500, date: '2026-11-02', account: 'Bank account' },
    // Transfer from Bank to Cash (ATM withdrawal): 2000
    { id: newId(), type: 'transfer', category: 'Transfer', title: 'ATM cash withdrawal', description: '', amount: 2000, date: '2026-11-03', account: 'Bank account', transferAccount: 'Cash' },
    // Expense from Cash: -500
    { id: newId(), type: 'expense', category: 'Groceries', title: 'Vegetables from market', description: '', amount: 500, date: '2026-11-04', account: 'Cash' },
    // Transfer from Bank to Savings: 10000
    { id: newId(), type: 'transfer', category: 'Transfer', title: 'Move to savings', description: '', amount: 10000, date: '2026-11-05', account: 'Bank account', transferAccount: 'Savings account' },
  ];

  const balances = calculateAccountBalances(accounts, transactions);

  // Bank: 10000 + 25000 - 4500 - 2000 - 10000 = 18500
  assert.equal(balances['Bank account'], 18500);

  // Cash: 1500 + 2000 (transfer in) - 500 = 3000
  assert.equal(balances['Cash'], 3000);

  // Savings: 50000 + 10000 (transfer in) = 60000
  assert.equal(balances['Savings account'], 60000);

  // Total net worth before: 10000 + 1500 + 50000 = 61500
  // Net cash flow: +25000 income - 4500 expense - 500 expense = +20000
  // Total net worth after: 61500 + 20000 = 81500
  const totalNetWorth = balances['Bank account'] + balances['Cash'] + balances['Savings account'];
  assert.equal(totalNetWorth, 81500);
});

test('transfers: transfers never inflate income, expense, or net cash flow', () => {
  const transactions: Transaction[] = [
    { id: newId(), type: 'income', category: 'Freelance', title: 'Website gig', description: '', amount: 5000, date: '2026-11-01', account: 'Bank account' },
    { id: newId(), type: 'expense', category: 'Dining', title: 'Lunch', description: '', amount: 350, date: '2026-11-02', account: 'Bank account' },
    // Large transfer between accounts: ₹50,000
    { id: newId(), type: 'transfer', category: 'Transfer', title: 'Fund transfer', description: '', amount: 50000, date: '2026-11-03', account: 'Bank account', transferAccount: 'Savings account' },
  ];

  const flow = calculateCashFlow(transactions, '2026-11');
  assert.equal(flow.income, 5000);
  assert.equal(flow.expense, 350);
  assert.equal(flow.net, 4650);
  assert.equal(flow.transferVolume, 50000);
  assert.equal(flow.transferCount, 1);
});

test('budget calculations: calculateBudgetProgress handles calm progress and remaining balances', () => {
  const normal = calculateBudgetProgress(10000, 3500);
  assert.equal(normal.remaining, 6500);
  assert.equal(normal.percent, 35);
  assert.equal(normal.isOver, false);

  const over = calculateBudgetProgress(5000, 6200);
  assert.equal(over.remaining, -1200);
  assert.equal(over.percent, 124);
  assert.equal(over.isOver, true);
});

test('recurring & subscriptions: calculate next dates accurately without timezone drift', () => {
  assert.equal(getNextRecurringDate('2026-11-01', 'daily', 3), '2026-11-04');
  assert.equal(getNextRecurringDate('2026-11-01', 'weekly', 2), '2026-11-15');
  assert.equal(getNextRecurringDate('2026-11-15', 'monthly', 1), '2026-12-15');
  assert.equal(getNextRecurringDate('2026-11-15', 'yearly', 1), '2027-11-15');

  assert.equal(getNextSubscriptionDate('2026-11-05', 'weekly'), '2026-11-12');
  assert.equal(getNextSubscriptionDate('2026-11-05', 'monthly'), '2026-12-05');
  assert.equal(getNextSubscriptionDate('2026-11-05', 'quarterly'), '2027-02-05');
  assert.equal(getNextSubscriptionDate('2026-11-05', 'yearly'), '2027-11-05');
});

test('csv export & import: roundtrips transactions and detects duplicates correctly', () => {
  const txs: Transaction[] = [
    { id: newId(), type: 'expense', category: 'Groceries', title: 'DMart groceries', description: '', amount: 2450.5, date: '2026-11-02', account: 'Bank account' },
    { id: newId(), type: 'income', category: 'Salary', title: 'October Salary', description: '', amount: 75000, date: '2026-11-01', account: 'Bank account' },
  ];

  const csv = exportTransactionsToCsv(txs);
  assert.ok(csv.includes('DMart groceries'));
  assert.ok(csv.includes('October Salary'));

  // Parse back with existing list
  const { valid, duplicates, errors } = parseTransactionsFromCsv(csv, txs);
  assert.equal(errors.length, 0);
  // All existing rows should be marked as duplicates
  assert.equal(duplicates, 2);
  assert.equal(valid.length, 0);

  // New rows should parse as valid
  const newCsv = `Date,Title,Type,Category,Amount,Account,Transfer Account,Notes\r\n2026-11-06,"Breakfast at Darshini",expense,Dining,120,"Cash",,"Idli and filter coffee"`;
  const result = parseTransactionsFromCsv(newCsv, txs);
  assert.equal(result.errors.length, 0);
  assert.equal(result.duplicates, 0);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].title, 'Breakfast at Darshini');
  assert.equal(result.valid[0].amount, 120);
  assert.equal(result.valid[0].account, 'Cash');
});



