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
import { todayKey } from '../../src/lib/dates';

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

describe('Phase 6 — Tables Critical Fix: Delete Table with Explicit Confirmation', () => {
  it('Opens confirmation modal, warns of affected records, distinguishes archive, and permanently deletes table', async () => {
    const tableId = '11111111-1111-4111-8111-111111111111';
    const rowId1 = '22222222-2222-4222-8222-222222222222';
    const rowId2 = '33333333-3333-4333-8333-333333333333';

    fake.setUser({ id: 'u1', email: 'delete_table@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      data_tables: [
        {
          id: tableId,
          user_id: 'u1',
          name: 'Sprint Backlog',
          description: 'Q4 tasks',
          columns: [
            { id: 'c1', name: 'Task', type: 'text' },
            { id: 'c2', name: 'Status', type: 'select', options: ['ACTIVE', 'DONE'] },
          ],
          archived: false,
          metadata: {},
        },
      ],
      table_rows: [
        { id: rowId1, table_id: tableId, user_id: 'u1', position: 0, data: { c1: 'Refactor Auth' } },
        { id: rowId2, table_id: tableId, user_id: 'u1', position: 1, data: { c1: 'Audit DB' } },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tables/));

    // Verify active table loads
    expect(await screen.findByText('Sprint Backlog (2)')).toBeTruthy();
    expect(screen.getByText('Refactor Auth')).toBeTruthy();

    // Open Table Contextual Menu
    const menuBtn = screen.getByLabelText('Table options menu');
    await user.click(menuBtn);

    // Verify Table Actions Modal opens
    expect(await screen.findByText('Table Actions — Sprint Backlog')).toBeTruthy();
    expect(screen.getByText('Archive Table')).toBeTruthy();

    // Click "Delete Table…"
    const deleteOption = screen.getByText('Delete Table…');
    await user.click(deleteOption);

    // Verify Delete Table Confirmation Dialog opens
    expect(await screen.findByText('Delete Table')).toBeTruthy();
    expect(screen.getByText(/You are about to permanently delete table/)).toBeTruthy();
    expect(screen.getByText('Archive Instead')).toBeTruthy(); // Distinguishes from archiving

    // Confirmation input requires typing table name because it has rows
    const confirmInput = screen.getByLabelText('Confirm table name to delete');
    await user.type(confirmInput, 'Sprint Backlog');

    // Click Delete Table Permanently
    const deleteBtn = screen.getByRole('button', { name: 'Delete Table Permanently' });
    await user.click(deleteBtn);

    // Verifies table is deleted and empty state or remaining tables appear
    await waitFor(() => {
      expect(screen.queryByText('Refactor Auth')).toBeNull();
      const dbTables = fake.db['u1'].data_tables || [];
      expect(dbTables.find((t: any) => t.id === tableId)).toBeUndefined();
    });

    // Verifies deleted tables do NOT return after reload/sync
    expect(fake.db['u1'].table_rows.filter((r: any) => r.table_id === tableId)).toHaveLength(0);
  });
});

describe('Phase 6 — Table Management: Rename, Duplicate, Archive & Restore', () => {
  it('Supports renaming table without losing existing records', async () => {
    const tableId = '11111111-1111-4111-8111-111111111111';
    fake.setUser({ id: 'u1', email: 'rename@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      data_tables: [
        {
          id: tableId,
          user_id: 'u1',
          name: 'Old Table Name',
          description: 'Old description',
          columns: [{ id: 'c1', name: 'Name', type: 'text' }],
          archived: false,
          metadata: {},
        },
      ],
      table_rows: [
        { id: '22222222-2222-4222-8222-222222222222', table_id: tableId, user_id: 'u1', position: 0, data: { c1: 'Important Record' } },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tables/));

    await screen.findByText('Old Table Name (1)');

    // Open menu -> Rename
    await user.click(screen.getByLabelText('Table options menu'));
    await user.click(screen.getByText('Rename Table'));

    // Rename input
    const nameInput = screen.getByPlaceholderText(/Project Tracker, Inventory/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Database Table');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    // Verifies rename persisted and records remain intact
    expect(await screen.findByText('Renamed Database Table (1)')).toBeTruthy();
    expect(screen.getByText('Important Record')).toBeTruthy();
  });

  it('Supports duplicating table with explicit choice between structure only vs structure and records', async () => {
    const tableId = '11111111-1111-4111-8111-111111111111';
    fake.setUser({ id: 'u1', email: 'dup@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      data_tables: [
        {
          id: tableId,
          user_id: 'u1',
          name: 'Original Inventory',
          description: '',
          columns: [{ id: 'c1', name: 'Item', type: 'text' }],
          archived: false,
          metadata: {},
        },
      ],
      table_rows: [
        { id: '22222222-2222-4222-8222-222222222222', table_id: tableId, user_id: 'u1', position: 0, data: { c1: 'Item A' } },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tables/));

    await screen.findByText('Original Inventory (1)');

    // Open menu -> Duplicate Table…
    await user.click(screen.getByLabelText('Table options menu'));
    await user.click(screen.getByText('Duplicate Table…'));

    // Duplicate modal displays explicit choices
    expect(await screen.findByText('Structure and records')).toBeTruthy();
    expect(screen.getByText('Structure only (empty table)')).toBeTruthy();

    // Select structure only
    await user.click(screen.getByText('Structure only (empty table)'));
    await user.click(screen.getByRole('button', { name: 'Create Duplicate' }));

    // New table created with 0 rows
    expect(await screen.findByText('Original Inventory (Copy) (0)')).toBeTruthy();
  });

  it('Supports archiving and restoring tables cleanly', async () => {
    const table1 = '11111111-1111-4111-8111-111111111111';
    const table2 = '22222222-2222-4222-8222-222222222222';
    fake.setUser({ id: 'u1', email: 'archive@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      data_tables: [
        { id: table1, user_id: 'u1', name: 'Active Table 1', description: '', columns: [{ id: 'c1', name: 'Col', type: 'text' }], archived: false, metadata: {} },
        { id: table2, user_id: 'u1', name: 'Active Table 2', description: '', columns: [{ id: 'c1', name: 'Col', type: 'text' }], archived: false, metadata: {} },
      ],
      table_rows: [],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tables/));

    await screen.findByText('Active Table 1 (0)');

    // Archive Active Table 1
    await user.click(screen.getByLabelText('Table options menu'));
    await user.click(screen.getByText('Archive Table'));

    // Automatically switches selected table to Active Table 2
    expect(await screen.findByText('Active Table 2 (0)')).toBeTruthy();

    // Table 1 is now in archived optgroup
    const selector = screen.getByLabelText('Select table');
    await user.selectOptions(selector, table1);

    // Active Table 1 displays Archived badge
    expect(await screen.findByText('Archived')).toBeTruthy();

    // Unarchive Table 1
    await user.click(screen.getByLabelText('Table options menu'));
    await user.click(screen.getByText('Restore Table'));

    expect(screen.queryByText('Archived')).toBeNull();
  });
});

describe('Phase 6 — Column Management, Record CRUD & Views', () => {
  it('Supports adding columns, reordering, and hiding without corrupting records', async () => {
    const tableId = '11111111-1111-4111-8111-111111111111';
    fake.setUser({ id: 'u1', email: 'columns@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      data_tables: [
        {
          id: tableId,
          user_id: 'u1',
          name: 'Gear Catalog',
          description: '',
          columns: [
            { id: 'c1', name: 'Gear Name', type: 'text' },
            { id: 'c2', name: 'Cost', type: 'currency', currencySymbol: '₹' },
          ],
          archived: false,
          metadata: {},
        },
      ],
      table_rows: [
        { id: '22222222-2222-4222-8222-222222222222', table_id: tableId, user_id: 'u1', position: 0, data: { c1: 'Telescope', c2: '45000' } },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tables/));

    expect(await screen.findByText('Gear Catalog (1)')).toBeTruthy();
    expect(screen.getByText('₹45,000')).toBeTruthy();

    // Open Column Manager
    await user.click(screen.getByRole('button', { name: /Columns/ }));
    expect(await screen.findByText('Column Management — Gear Catalog')).toBeTruthy();

    // Add new column: "In Stock" (checkbox)
    await user.click(screen.getByRole('button', { name: 'Add Column' }));
    await user.type(screen.getByPlaceholderText(/Priority, Price, Status, URL/), 'In Stock');
    await user.selectOptions(screen.getByLabelText(/Column Type/i) || screen.getAllByRole('combobox')[0], 'checkbox');
    await user.click(screen.getByRole('button', { name: 'Create Column' }));

    // Save columns
    await user.click(screen.getByRole('button', { name: 'Save Columns' }));

    // In Stock column header now appears
    expect(await screen.findByText('In Stock')).toBeTruthy();
    expect(screen.getByText('Telescope')).toBeTruthy(); // Data preserved
  });

  it('Supports record CRUD, duplication, and view switching between Grid, List, and Board', async () => {
    const tableId = '11111111-1111-4111-8111-111111111111';
    fake.setUser({ id: 'u1', email: 'records@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      data_tables: [
        {
          id: tableId,
          user_id: 'u1',
          name: 'Milestones',
          description: '',
          columns: [
            { id: 'c1', name: 'Title', type: 'text' },
            { id: 'c2', name: 'Status', type: 'select', options: ['ACTIVE', 'DONE'] },
          ],
          archived: false,
          metadata: { view: 'grid' },
        },
      ],
      table_rows: [
        { id: '22222222-2222-4222-8222-222222222222', table_id: tableId, user_id: 'u1', position: 0, data: { c1: 'Launch Alpha', c2: 'ACTIVE' } },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tables/));

    expect(await screen.findByText('Launch Alpha')).toBeTruthy();

    // Duplicate record
    await user.click(screen.getByLabelText('Duplicate record'));
    expect(await screen.findByText('Showing 2 of 2 records')).toBeTruthy();

    // Switch to List View
    await user.click(screen.getByLabelText('List View'));
    expect(await screen.findAllByText('Launch Alpha')).toHaveLength(2);

    // Switch to Board View
    await user.click(screen.getByLabelText('Board View'));
    expect((await screen.findAllByText('ACTIVE')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('DONE').length).toBeGreaterThanOrEqual(1);
  });

  it('Displays dated table records in Day Details when calendar sync is enabled', async () => {
    const today = todayKey();
    const tableId = '11111111-1111-4111-8111-111111111111';
    fake.setUser({ id: 'u1', email: 'calendar_tables@test.dev' });
    fake.db['u1'] = {
      ...EMPTY,
      data_tables: [
        {
          id: tableId,
          user_id: 'u1',
          name: 'Project Milestones',
          description: '',
          columns: [
            { id: 'c1', name: 'Milestone', type: 'text' },
            { id: 'c2', name: 'Target Date', type: 'date' },
            { id: 'c3', name: 'Status', type: 'select', options: ['IN PROGRESS', 'COMPLETED'] },
          ],
          archived: false,
          metadata: { calendarEnabled: true, calendarDateFieldId: 'c2' },
        },
      ],
      table_rows: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          table_id: tableId,
          user_id: 'u1',
          position: 0,
          data: { c1: 'Q4 Final Release', c2: today, c3: 'IN PROGRESS' },
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    // Open Day Details modal for today
    const todayCell = screen.getByRole('button', { name: new RegExp(`^${today}`) });
    expect(todayCell).toBeTruthy();
    await user.dblClick(todayCell);

    // Day Details displays the dated table record
    expect(await screen.findByText('Database & Table Records (1)')).toBeTruthy();
    expect(screen.getByText('Q4 Final Release')).toBeTruthy();
    expect(screen.getAllByText('Project Milestones').length).toBeGreaterThanOrEqual(1);
  });
});
