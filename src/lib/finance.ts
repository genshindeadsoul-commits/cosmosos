import { Account, RecurringFrequency, Subscription, Transaction } from '../types';
import { parseCsv, toCsv } from './csv';
import { shiftDayKey, addMonthsKey } from './dates';

/** Safely rounds monetary amounts to 2 decimal places to avoid IEEE-754 floating point errors. */
export function roundCurrency(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Formats a numeric currency amount for display, respecting standard decimal format. */
export function formatCurrency(amount: number, symbol = '₹'): string {
  const rounded = roundCurrency(amount);
  const parts = Math.abs(rounded).toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = parts[1] === '00' ? integerPart : `${integerPart}.${parts[1]}`;
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

/**
 * Calculates accurate reconciled balances for all accounts:
 * Balance = Opening Balance
 *           + Sum(Income where t.account === acc.name)
 *           - Sum(Expense where t.account === acc.name)
 *           - Sum(Transfer where t.account === acc.name)     [Transferred Out]
 *           + Sum(Transfer where t.transferAccount === acc.name) [Transferred In]
 *
 * Transfers between accounts change individual account balances but have NET ZERO impact on overall net worth.
 */
export function calculateAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Record<string, number> {
  const balances: Record<string, number> = {};

  // Initialize with opening balances
  accounts.forEach((acc) => {
    balances[acc.name] = roundCurrency(acc.openingBalance || 0);
  });

  // Reconcile with all transactions
  transactions.forEach((tx) => {
    const amt = roundCurrency(Math.abs(tx.amount || 0));
    if (amt <= 0) return;

    if (tx.type === 'income') {
      const acc = tx.account || 'Bank account';
      balances[acc] = roundCurrency((balances[acc] || 0) + amt);
    } else if (tx.type === 'expense') {
      const acc = tx.account || 'Bank account';
      balances[acc] = roundCurrency((balances[acc] || 0) - amt);
    } else if (tx.type === 'transfer') {
      const fromAcc = tx.account || 'Bank account';
      const toAcc = tx.transferAccount;
      // Money left fromAcc
      balances[fromAcc] = roundCurrency((balances[fromAcc] || 0) - amt);
      // Money arrived in toAcc
      if (toAcc) {
        balances[toAcc] = roundCurrency((balances[toAcc] || 0) + amt);
      }
    }
  });

  return balances;
}

/**
 * Calculates total income, expenses, and net cash flow for a set of transactions.
 * Transfers are strictly excluded from income and expenses to prevent double-counting or artificial inflation.
 */
export function calculateCashFlow(
  transactions: Transaction[],
  monthKey?: string
): {
  income: number;
  expense: number;
  net: number;
  transferVolume: number;
  transferCount: number;
} {
  const filtered = monthKey
    ? transactions.filter((t) => t.date.startsWith(monthKey))
    : transactions;

  let income = 0;
  let expense = 0;
  let transferVolume = 0;
  let transferCount = 0;

  filtered.forEach((t) => {
    const amt = roundCurrency(Math.abs(t.amount || 0));
    if (t.type === 'income') {
      income = roundCurrency(income + amt);
    } else if (t.type === 'expense') {
      expense = roundCurrency(expense + amt);
    } else if (t.type === 'transfer') {
      transferVolume = roundCurrency(transferVolume + amt);
      transferCount++;
    }
  });

  const net = roundCurrency(income - expense);
  return { income, expense, net, transferVolume, transferCount };
}

/** Computes spending progress and remaining budget calmly without panic */
export function calculateBudgetProgress(
  budget: number,
  spent: number
): {
  remaining: number;
  percent: number;
  isOver: boolean;
} {
  const safeBudget = Math.max(0, roundCurrency(budget));
  const safeSpent = Math.max(0, roundCurrency(spent));
  const remaining = roundCurrency(safeBudget - safeSpent);
  const percent = safeBudget > 0 ? roundCurrency((safeSpent / safeBudget) * 100) : 0;
  const isOver = safeBudget > 0 && remaining < 0;

  return { remaining, percent, isOver };
}

/** Calculates the next due date for recurring transactions based on frequency and interval */
export function getNextRecurringDate(
  currentDate: string,
  frequency: RecurringFrequency,
  interval = 1
): string {
  const safeInterval = Math.max(1, interval);
  if (frequency === 'daily') {
    return shiftDayKey(currentDate, safeInterval);
  }
  if (frequency === 'weekly') {
    return shiftDayKey(currentDate, safeInterval * 7);
  }
  if (frequency === 'monthly') {
    return addMonthsKey(currentDate, safeInterval);
  }
  if (frequency === 'yearly') {
    return addMonthsKey(currentDate, safeInterval * 12);
  }
  return addMonthsKey(currentDate, 1);
}

/** Calculates the next renewal date for subscriptions */
export function getNextSubscriptionDate(
  currentDate: string,
  cycle: Subscription['billingCycle']
): string {
  if (cycle === 'weekly') {
    return shiftDayKey(currentDate, 7);
  }
  if (cycle === 'monthly') {
    return addMonthsKey(currentDate, 1);
  }
  if (cycle === 'quarterly') {
    return addMonthsKey(currentDate, 3);
  }
  if (cycle === 'yearly') {
    return addMonthsKey(currentDate, 12);
  }
  return addMonthsKey(currentDate, 1);
}

/** Export transactions to standard RFC 4180 CSV */
export function exportTransactionsToCsv(transactions: Transaction[]): string {
  const header = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Account', 'Transfer Account', 'Notes'];
  const rows = transactions.map((t) => [
    t.date,
    t.title || t.description || t.category,
    t.type,
    t.category,
    roundCurrency(t.amount),
    t.account || 'Bank account',
    t.transferAccount || '',
    t.notes || t.description || '',
  ]);

  return toCsv([header, ...rows]);
}

/** Parse and import transactions from CSV with validation and duplicate prevention */
export function parseTransactionsFromCsv(
  csvText: string,
  existingTransactions: Transaction[]
): {
  valid: Partial<Transaction>[];
  duplicates: number;
  errors: { line: number; message: string }[];
} {
  const parsed = parseCsv(csvText);
  if (parsed.length <= 1) {
    return { valid: [], duplicates: 0, errors: [{ line: 1, message: 'CSV file is empty or missing headers.' }] };
  }

  const [headers, ...dataRows] = parsed;
  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());

  const dateIdx = lowerHeaders.findIndex((h) => h.includes('date'));
  const titleIdx = lowerHeaders.findIndex((h) => h.includes('title') || h.includes('description') || h.includes('name'));
  const typeIdx = lowerHeaders.findIndex((h) => h.includes('type'));
  const catIdx = lowerHeaders.findIndex((h) => h.includes('cat'));
  const amtIdx = lowerHeaders.findIndex((h) => h.includes('amount') || h.includes('cost') || h.includes('price'));
  const accIdx = lowerHeaders.findIndex((h) => h.includes('account') && !h.includes('transfer'));
  const transferAccIdx = lowerHeaders.findIndex((h) => h.includes('transfer'));
  const notesIdx = lowerHeaders.findIndex((h) => h.includes('note') || h.includes('memo'));

  // Signature map for duplicate detection
  const existingSigs = new Set(
    existingTransactions.map((t) => `${t.date}|${(t.title || t.description).trim().toLowerCase()}|${roundCurrency(t.amount)}|${t.type}`)
  );

  const valid: Partial<Transaction>[] = [];
  const errors: { line: number; message: string }[] = [];
  let duplicates = 0;

  dataRows.forEach((row, i) => {
    const lineNum = i + 2;
    const rawDate = dateIdx >= 0 ? (row[dateIdx] || '').trim() : '';
    const rawTitle = titleIdx >= 0 ? (row[titleIdx] || '').trim() : '';
    const rawType = typeIdx >= 0 ? (row[typeIdx] || '').trim().toLowerCase() : '';
    const rawCat = catIdx >= 0 ? (row[catIdx] || '').trim() : '';
    const rawAmt = amtIdx >= 0 ? (row[amtIdx] || '').trim().replace(/,/g, '') : '';
    const rawAcc = accIdx >= 0 ? (row[accIdx] || '').trim() : '';
    const rawTransferAcc = transferAccIdx >= 0 ? (row[transferAccIdx] || '').trim() : '';
    const rawNotes = notesIdx >= 0 ? (row[notesIdx] || '').trim() : '';

    if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      errors.push({ line: lineNum, message: `Invalid date "${rawDate}". Expected YYYY-MM-DD.` });
      return;
    }

    const amt = parseFloat(rawAmt);
    if (!Number.isFinite(amt) || amt <= 0) {
      errors.push({ line: lineNum, message: `Invalid amount "${rawAmt}". Must be positive number.` });
      return;
    }

    const finalType: Transaction['type'] =
      rawType === 'income' ? 'income' : rawType === 'transfer' ? 'transfer' : 'expense';
    const finalTitle = rawTitle || rawCat || 'Untitled Transaction';
    const finalCat = rawCat || (finalType === 'transfer' ? 'Transfer' : 'Miscellaneous');

    const sig = `${rawDate}|${finalTitle.toLowerCase()}|${roundCurrency(amt)}|${finalType}`;
    if (existingSigs.has(sig)) {
      duplicates++;
      return;
    }

    existingSigs.add(sig);
    valid.push({
      date: rawDate,
      title: finalTitle,
      description: finalTitle,
      type: finalType,
      category: finalCat as any,
      amount: roundCurrency(amt),
      account: rawAcc || 'Bank account',
      transferAccount: finalType === 'transfer' ? rawTransferAcc || undefined : undefined,
      notes: rawNotes || undefined,
    });
  });

  return { valid, duplicates, errors };
}
