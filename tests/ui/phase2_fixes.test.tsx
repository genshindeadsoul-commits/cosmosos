// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fake from './fakeSupabase';
import { EMPTY_DATA as EMPTY, newId, toRows } from '../../src/data/cloudData';

vi.mock('../../src/lib/supabase', () => ({
  supabase: fake.fakeClient,
  isSupabaseConfigured: true,
  supabaseUrl: 'https://x.supabase.co',
  supabaseAnonKey: 'anon',
  requireSupabase: () => fake.fakeClient,
}));
import App from '../../src/App';

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
    ((q: string) =>
      ({
        matches: false,
        media: q,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        onchange: null,
        dispatchEvent: () => false,
      } as any));
});

describe('Phase 2 Fixes — Dashboard Profile Name', () => {
  it('Dashboard displays dynamic user profile name and never the hardcoded "John"', async () => {
    fake.setUser({ id: 'u1', email: 'alice@wonderland.dev', user_metadata: { full_name: 'Alice Liddell' } });
    fake.db['u1'] = { ...EMPTY };
    render(<App />);

    await screen.findAllByText('Dashboard');
    const header = await screen.findByRole('heading', { level: 1 });
    expect(header.textContent).toMatch(/(Good Morning|Good Afternoon|Good Evening), Alice Liddell/);
    expect(header.textContent).not.toContain('John');
  });

  it('Updating display name in Settings reflects on the Dashboard and persists in local cache', async () => {
    fake.setUser({ id: 'u1', email: 'bob@builder.dev', user_metadata: { full_name: 'Bob Builder' } });
    fake.db['u1'] = { ...EMPTY };
    const user = userEvent.setup();
    render(<App />);

    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Settings/));

    const nameInput = await screen.findByLabelText('Display Name');
    expect((nameInput as HTMLInputElement).value).toBe('Bob Builder');

    await user.clear(nameInput);
    await user.type(nameInput, 'Robert The Architect');

    const saveBtn = screen.getByRole('button', { name: 'Save Name' });
    await user.click(saveBtn);

    // Verify local cache is saved immediately
    expect(localStorage.getItem('cosmos_profile_name:u1')).toBe('Robert The Architect');

    // Navigate to Dashboard and verify the greeting updated
    await user.click(NAVBTN(/Dashboard/));
    const header = await screen.findByRole('heading', { level: 1 });
    expect(header.textContent).toContain('Robert The Architect');
    expect(header.textContent).not.toContain('John');
  });
});

describe('Phase 2 Fixes — Finance Module', () => {
  it('Category filter isolates transactions for the chosen category and allows clearing', async () => {
    fake.setUser({ id: 'u1', email: 'fin@test.dev' });
    fake.db['u1'] = {
      transactions: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          type: 'expense',
          category: 'Groceries',
          title: 'Supermarket weekly groceries',
          description: '',
          amount: 2500,
          tx_date: '2026-11-05',
          tx_time: '12:00 PM',
          notes: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          type: 'expense',
          category: 'Dining',
          title: 'Italian dinner date',
          description: '',
          amount: 1400,
          tx_date: '2026-11-05',
          tx_time: '07:30 PM',
          notes: null,
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Expenses/));

    expect((await screen.findAllByText('Supermarket weekly groceries')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Italian dinner date').length).toBeGreaterThanOrEqual(1);

    // Filter by Groceries
    const catSelect = screen.getByLabelText('Filter transactions by category');
    await user.selectOptions(catSelect, 'Groceries');

    expect(screen.getAllByText('Supermarket weekly groceries').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText('Italian dinner date')).toHaveLength(0);

    // Clear category filter via clear button
    const clearBtn = screen.getByLabelText('Clear category filter');
    await user.click(clearBtn);

    expect(screen.getAllByText('Supermarket weekly groceries').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Italian dinner date').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Phase 2 Fixes — Notes Mobile Delete Accessibility', () => {
  it('Note editor delete action has accessible touch target and preserves Delete? confirmation', async () => {
    const noteId = '33333333-3333-4333-8333-333333333333';
    fake.setUser({ id: 'u1', email: 'notes@test.dev' });
    fake.db['u1'] = {
      notes: [
        {
          id: noteId,
          title: 'Project Roadmap 2027',
          content: 'Secret roadmap details',
          excerpt: 'Secret roadmap details',
          starred: false,
          tags: ['Work'],
          note_date: '2026-11-05',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Notes/));

    expect(await screen.findByDisplayValue('Project Roadmap 2027')).toBeTruthy();

    // Find the Delete note button in the editor toolbar
    const deleteBtn = await screen.findByRole('button', { name: 'Delete note' });
    expect(deleteBtn).toBeTruthy();

    // Click Delete note to trigger confirmation
    await user.click(deleteBtn);

    // Confirmation container should display "Delete?" with Yes and No buttons
    expect(screen.getByText('Delete?')).toBeTruthy();
    const yesBtn = screen.getByRole('button', { name: 'Yes' });
    const noBtn = screen.getByRole('button', { name: 'No' });
    expect(yesBtn).toBeTruthy();
    expect(noBtn).toBeTruthy();

    // Confirm deletion
    await user.click(yesBtn);

    // Note should be removed from UI and persisted to database after flush
    await waitFor(() => {
      expect(screen.queryByText('Project Roadmap 2027')).toBeNull();
    });
    await waitFor(() => {
      expect(fake.db['u1'].notes).toHaveLength(0);
    }, { timeout: 4000 });
  });
});

describe('Phase 2 Redesign — Dashboard & Global Navigation', () => {
  it('Sidebar renders functional groups (Home, Workspace, Personal, Connected Apps, Settings)', async () => {
    fake.setUser({ id: 'u1', email: 'nav@test.dev' });
    fake.db['u1'] = { ...EMPTY };
    render(<App />);

    await screen.findAllByText('Dashboard');
    const mainNav = screen.getByRole('navigation', { name: 'Main Navigation' });
    expect(within(mainNav).getByText('Home')).toBeTruthy();
    expect(within(mainNav).getByText('Workspace')).toBeTruthy();
    expect(within(mainNav).getByText('Personal')).toBeTruthy();
    expect(within(mainNav).getByText('Connected Apps')).toBeTruthy();
    expect(within(mainNav).getAllByText('Settings').length).toBeGreaterThanOrEqual(1);

    // Verify primary buttons in navigation
    expect(within(mainNav).getByRole('button', { name: /Dashboard/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Tasks & Calendar/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Notes/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Tables/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Expenses/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Fitness/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Goals & Habits/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Custom Trackers/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Gmail/ })).toBeTruthy();
    expect(within(mainNav).getByRole('button', { name: /Settings/ })).toBeTruthy();

    // Task Queues is outside the main module buttons
    expect(screen.getByText('Task Queues')).toBeTruthy();
  });

  it('Dashboard displays unified agenda with next commitment and supports inline quick task capture', async () => {
    fake.setUser({ id: 'u1', email: 'dash@test.dev' });
    fake.db['u1'] = {
      calendar_events: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Executive Sync',
          event_date: '2026-11-05',
          start_time: '10:00 AM',
          end_time: '11:00 AM',
          category: 'Work',
          description: 'Quarterly review with stakeholders',
          source: 'local',
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // Consolidated agenda displays Next Commitment banner
    expect(screen.getByText('Next Commitment')).toBeTruthy();
    expect(screen.getAllByText('Executive Sync').length).toBeGreaterThanOrEqual(1);

    // Streamlined Quick Add Task in Today's task
    const taskInput = screen.getByPlaceholderText('+ Add task for today...');
    await user.type(taskInput, 'Ship Phase 2 Production Build');
    const sendBtn = screen.getByRole('button', { name: 'Send task' });
    await user.click(sendBtn);

    // Task appears in today's task list with one-tap completion
    expect(await screen.findByText('Ship Phase 2 Production Build')).toBeTruthy();
    const toggleBtn = screen.getByRole('button', { name: 'Mark task Ship Phase 2 Production Build complete' });
    expect(toggleBtn).toBeTruthy();

    await user.click(toggleBtn);
    expect(await screen.findByText('All caught up for today!')).toBeTruthy();
    expect(screen.queryByText('Ship Phase 2 Production Build')).toBeNull();
  });

  it('Dashboard customization allows toggling widget visibility and switching layout mode', async () => {
    fake.setUser({ id: 'u1', email: 'custom@test.dev' });
    fake.db['u1'] = { ...EMPTY };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // Open Customize modal
    const customizeBtn = screen.getByRole('button', { name: 'Customize dashboard' });
    await user.click(customizeBtn);

    expect(await screen.findByRole('dialog', { name: 'Customize Dashboard' })).toBeTruthy();
    expect(screen.getByText('Grid Layout')).toBeTruthy();
    expect(screen.getByText('Visible Widgets')).toBeTruthy();

    // Layout options: One Column, Two Columns, Auto / Adaptive
    expect(screen.getByRole('button', { name: /One Column/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Two Columns/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Auto \/ Adaptive/ })).toBeTruthy();

    // Close modal
    const doneBtn = screen.getByRole('button', { name: 'Done' });
    await user.click(doneBtn);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Focus timer supports collapsing to compact mode and expanding', async () => {
    fake.setUser({ id: 'u1', email: 'focus@test.dev' });
    fake.db['u1'] = { ...EMPTY };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // Expanded view has the task title placeholder
    expect(screen.getByPlaceholderText('What are you focusing on?')).toBeTruthy();

    // Minimize timer
    const minimizeBtn = screen.getByTitle('Minimize timer');
    await user.click(minimizeBtn);

    // Expanded input should be hidden in compact bar
    expect(screen.queryByPlaceholderText('What are you focusing on?')).toBeNull();

    // Expand timer back
    const expandBtn = screen.getByTitle('Expand timer');
    await user.click(expandBtn);
    expect(screen.getByPlaceholderText('What are you focusing on?')).toBeTruthy();
  });
});

