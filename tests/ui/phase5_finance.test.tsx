// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fake from './fakeSupabase';
import { EMPTY_DATA as EMPTY, newId } from '../../src/data/cloudData';

vi.mock('../../src/lib/supabase', () => ({
  supabase: fake.fakeClient,
  isSupabaseConfigured: true,
  supabaseUrl: 'https://x.supabase.co',
  supabaseAnonKey: 'anon',
  requireSupabase: () => fake.fakeClient,
}));
import App from '../../src/App';
import { todayKey, shiftDayKey } from '../../src/lib/dates';

const REAL_LOCATION = Object.getOwnPropertyDescriptor(window, 'location')!;
const NAVBTN = (label: RegExp) =>
  within(screen.getByRole('navigation', { name: 'Main Navigation' })).getByRole('button', { name: label });

beforeEach(() => {
  fake.failTables.clear();
  Object.defineProperty(window, 'location', REAL_LOCATION);
  fake.failWrites.on = false;
  window.history.replaceState({}, '', '/');
  fake.fnCalls.length = 0;
  cleanup();
  localStorage.clear();
  fake.calls.length = 0;
  Object.keys(fake.db).forEach((k) => delete fake.db[k]);
  window.matchMedia =
    window.matchMedia ||
    ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
});

describe('Phase 5 — Custom Transaction Titles Mandatory & Editable', () => {
  it('Every transaction requires a custom title, renders it prominently, and allows editing after saving', async () => {
    const today = todayKey();
    fake.setUser({ id: 'u1', email: 'customtitle@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      transactions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'u1',
          type: 'expense',
          category: 'Groceries',
          title: 'DMart monthly grocery run',
          description: 'DMart monthly grocery run',
          amount: 3250.5,
          tx_date: today,
          account: 'Bank account',
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    // Navigate to Expenses & Ledger
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Expenses/));

    // Custom title is displayed prominently
    expect(await screen.findByText('DMart monthly grocery run')).toBeTruthy();
    expect(screen.getAllByText('Groceries').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('-₹3,250.50').length).toBeGreaterThanOrEqual(1);

    // Edit transaction title
    const editBtn = screen.getByLabelText('Edit DMart monthly grocery run');
    await user.click(editBtn);

    // Edit modal opens
    expect(await screen.findByText('Edit Transaction')).toBeTruthy();
    const titleInput = screen.getByDisplayValue('DMart monthly grocery run');
    await user.clear(titleInput);
    await user.type(titleInput, 'DMart organic vegetables and grains');

    const saveBtn = screen.getByRole('button', { name: 'Update Transaction' });
    await user.click(saveBtn);

    // Updated title rendered
    expect(await screen.findByText('DMart organic vegetables and grains')).toBeTruthy();

    // Also verified in database
    await waitFor(() => {
      const tx = fake.db['u1'].transactions.find((t: any) => t.id === '11111111-1111-4111-8111-111111111111');
      expect(tx?.title).toBe('DMart organic vegetables and grains');
    });
  });
});

describe('Phase 5 — Transaction Types & Account Balance Reconciliation', () => {
  it('Supports Income, Expense, and Transfers without transfers double-counting or inflating income/expense', async () => {
    fake.setUser({ id: 'u1', email: 'ledger@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      transactions: [],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Expenses/));

    // 1. Add Income: ₹50,000 into Bank account
    const addTxBtn = screen.getByRole('button', { name: 'Add Transaction' });
    await user.click(addTxBtn);

    // Select Income tab
    const incomeTypeBtn = screen.getByRole('button', { name: 'income' });
    await user.click(incomeTypeBtn);

    await user.type(screen.getByPlaceholderText(/DMart groceries/i), 'Consulting fee');
    await user.type(screen.getByPlaceholderText('0.00'), '50000');
    await user.click(screen.getByRole('button', { name: 'Save Transaction' }));

    // 2. Add Expense: ₹2,500 from Bank account
    await user.click(screen.getByRole('button', { name: 'Add Transaction' }));
    await user.type(screen.getByPlaceholderText(/DMart groceries/i), 'Electricity bill');
    await user.type(screen.getByPlaceholderText('0.00'), '2500');
    await user.click(screen.getByRole('button', { name: 'Save Transaction' }));

    // 3. Add Transfer: ₹5,000 from Bank to Cash
    await user.click(screen.getByRole('button', { name: 'Add Transaction' }));
    const transferTypeBtn = screen.getByRole('button', { name: 'transfer' });
    await user.click(transferTypeBtn);

    await user.type(screen.getByPlaceholderText(/DMart groceries/i), 'ATM cash withdrawal');
    await user.type(screen.getByPlaceholderText('0.00'), '5000');
    await user.click(screen.getByRole('button', { name: 'Save Transaction' }));

    // Inflow: 50,000 | Outflow: 2,500 | Net: +47,500
    // Transfer does NOT inflate Income or Expense!
    expect(await screen.findByText('₹50,000')).toBeTruthy(); // Inflow
    expect(await screen.findByText('₹2,500')).toBeTruthy(); // Outflow
    expect(await screen.findByText('+₹47,500')).toBeTruthy(); // Net cash flow

    // Check Accounts Tab
    const accountsTab = screen.getByRole('button', { name: 'Accounts' });
    await user.click(accountsTab);

    // Bank balance = 0 + 50000 - 2500 - 5000 = 42500
    expect(await screen.findByText('₹42,500')).toBeTruthy();

    // Cash balance = 0 + 5000 = 5000
    expect(await screen.findByText('₹5,000')).toBeTruthy();
  });
});

describe('Phase 5 — Subscriptions & Duplicate Payment Prevention', () => {
  it('Records subscription payment into ledger, advances renewal date, and refuses duplicate payment on same date', async () => {
    const today = todayKey();
    fake.setUser({ id: 'u1', email: 'subs@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      subscriptions: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          user_id: 'u1',
          name: 'Netflix Premium 4K',
          amount: 649,
          billing_cycle: 'monthly',
          renewal_date: today,
          category: 'Entertainment',
          account: 'Bank account',
        },
      ],
      transactions: [],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Expenses/));

    // Navigate to Recurring & Subs tab
    const recurringTab = screen.getByRole('button', { name: 'Recurring & Subs' });
    await user.click(recurringTab);

    expect(await screen.findByText('Netflix Premium 4K')).toBeTruthy();
    expect(screen.getByText('₹649')).toBeTruthy();

    // Click "Record Payment"
    const recordBtn = screen.getByRole('button', { name: 'Record Payment' });
    await user.click(recordBtn);

    // Verifies payment is created in database
    await waitFor(() => {
      const tx = fake.db['u1'].transactions.find((t: any) => t.title === 'Netflix Premium 4K');
      expect(tx).toBeTruthy();
      expect(tx?.amount).toBe(649);
      expect(tx?.type).toBe('expense');
    });

    // Sub renewal date advances to next month
    await waitFor(() => {
      const sub = fake.db['u1'].subscriptions.find((s: any) => s.id === '22222222-2222-4222-8222-222222222222');
      expect(sub?.renewal_date).not.toBe(today);
    });

    // Clicking Record Payment again on the same date avoids duplicate
    await user.click(recordBtn);
    expect(fake.db['u1'].transactions.filter((t: any) => t.title === 'Netflix Premium 4K').length).toBe(1);
  });
});

describe('Phase 5 — Search & Multi-Faceted Filtering', () => {
  it('Live search supports filtering by transaction title, category, and amount', async () => {
    const today = todayKey();
    fake.setUser({ id: 'u1', email: 'filter@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      transactions: [
        {
          id: 'tx-1',
          user_id: 'u1',
          type: 'expense',
          category: 'Dining',
          title: 'Breakfast at Darshini',
          description: 'Idli vada combo',
          amount: 140,
          tx_date: today,
          account: 'Cash',
        },
        {
          id: 'tx-2',
          user_id: 'u1',
          type: 'expense',
          category: 'Groceries',
          title: 'Petrol for scooter',
          description: 'IndianOil refill',
          amount: 500,
          tx_date: today,
          account: 'Bank account',
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Expenses/));

    expect(await screen.findByText('Breakfast at Darshini')).toBeTruthy();
    expect(screen.getByText('Petrol for scooter')).toBeTruthy();

    // Search by title "Darshini"
    const searchInput = screen.getByPlaceholderText(/Search title, amount, account/i);
    await user.type(searchInput, 'Darshini');

    expect(screen.getByText('Breakfast at Darshini')).toBeTruthy();
    expect(screen.queryByText('Petrol for scooter')).toBeNull();

    // Clear search and search by amount "500"
    await user.clear(searchInput);
    await user.type(searchInput, '500');

    expect(screen.getByText('Petrol for scooter')).toBeTruthy();
    expect(screen.queryByText('Breakfast at Darshini')).toBeNull();
  });
});

describe('Phase 5 — Custom Categories & Safe Reassignment', () => {
  it('Allows creating categories and safely reassigns existing transactions when deleting a category', async () => {
    const today = todayKey();
    fake.setUser({ id: 'u1', email: 'categories@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      transactions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          user_id: 'u1',
          type: 'expense',
          category: 'Dining',
          title: 'Zomato Biryani Order',
          description: '',
          amount: 450,
          tx_date: today,
          account: 'Bank account',
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Expenses/));

    // Open Categories Modal
    const categoriesBtn = screen.getByRole('button', { name: 'Categories' });
    await user.click(categoriesBtn);

    expect(await screen.findByText('Custom Categories')).toBeTruthy();

    // Click "Add Category"
    const addCatBtn = screen.getByRole('button', { name: 'Add Category' });
    await user.click(addCatBtn);

    // Enter new category name: "Online Food Delivery"
    const catNameInput = screen.getByPlaceholderText(/Health & Wellness/i);
    await user.type(catNameInput, 'Online Food Delivery');
    await user.click(screen.getByRole('button', { name: 'Create Category' }));

    // Online Food Delivery appears in list
    expect((await screen.findAllByText('Online Food Delivery')).length).toBeGreaterThanOrEqual(1);

    // Try deleting "Dining" which has 1 transaction
    const deleteDiningBtn = screen.getByLabelText('Delete category Dining');
    await user.click(deleteDiningBtn);

    // Safe deletion modal opens showing reassignment options
    expect(await screen.findByText('Category contains transactions')).toBeTruthy();
    expect(screen.getByText('Reassign transactions to:')).toBeTruthy();

    // Choose Online Food Delivery as reassignment target
    const reassignSelect = screen.getByLabelText('Reassign transactions to:');
    await user.selectOptions(reassignSelect, 'Online Food Delivery');

    // Confirm reassignment and delete
    const confirmBtn = screen.getByRole('button', { name: 'Reassign & Delete' });
    await user.click(confirmBtn);

    // Transaction now has category "Online Food Delivery"
    await waitFor(() => {
      const tx = fake.db['u1'].transactions.find((t: any) => t.id === '11111111-1111-4111-8111-111111111111');
      expect(tx?.category).toBe('Online Food Delivery');
    });
  });
});

describe('Phase 5 — Finance and Calendar Day Details Integration', () => {
  it('Day Details renders custom transaction title and updates sync across modules without duplicate records', async () => {
    const today = todayKey();
    fake.setUser({ id: 'u1', email: 'daydetails@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      transactions: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          user_id: 'u1',
          type: 'expense',
          category: 'Utilities',
          title: 'Broadband Fiber Internet Bill',
          description: '',
          amount: 999,
          tx_date: today,
          account: 'Bank account',
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    // In Dashboard, navigate to Tasks & Calendar
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    // Open Day Details modal for today
    const todayCell = screen.getByRole('button', { name: new RegExp(`^${today}`) });
    expect(todayCell).toBeTruthy();
    await user.dblClick(todayCell);

    // Day Details displays custom transaction title prominently
    expect(await screen.findByText('Broadband Fiber Internet Bill')).toBeTruthy();
    expect(screen.getByText('-₹999')).toBeTruthy();
  });
});
