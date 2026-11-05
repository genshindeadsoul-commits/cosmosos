// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, within, fireEvent, act } from '@testing-library/react';
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

describe('Phase 4 — One Source of Truth & Synchronized Task Completion', () => {
  it('Task created globally or in workspace appears across all views and syncs completion everywhere', async () => {
    const today = todayKey();
    fake.setUser({ id: 'u1', email: 'sync@test.dev' });
    fake.db['u1'] = { ...EMPTY };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // 1. Quick add a task from the Dashboard inline entry
    const dashInput = screen.getByPlaceholderText('+ Add task for today...');
    await user.type(dashInput, 'Deploy Phase 4 Microservice');
    const sendBtn = screen.getByRole('button', { name: 'Send task' });
    await user.click(sendBtn);

    // Verify it appears in Dashboard today's tasks
    expect(await screen.findByText('Deploy Phase 4 Microservice')).toBeTruthy();

    // 2. Navigate to Tasks & Calendar workspace
    await user.click(NAVBTN(/Tasks & Calendar/));
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks & Scheduling' })).toBeTruthy();

    // Switch to Today tab
    const todayTab = screen.getByRole('button', { name: 'Today workspace' });
    await user.click(todayTab);

    // The same task MUST appear in the Today workspace
    expect(await screen.findByText('Deploy Phase 4 Microservice')).toBeTruthy();

    // 3. Complete the task in Today workspace
    const toggleBtn = screen.getByRole('button', { name: 'Toggle task Deploy Phase 4 Microservice' });
    await user.click(toggleBtn);

    // Should now be under Completed Today
    expect(await screen.findByText(/Completed Today/i)).toBeTruthy();

    // 4. Return to Dashboard: task completion MUST be synchronized!
    await user.click(NAVBTN(/Dashboard/));
    expect(await screen.findByText('All caught up for today!')).toBeTruthy();
    expect(screen.queryByText('Deploy Phase 4 Microservice')).toBeNull();
  });
});

describe('Phase 4 — Unified Task Workspace Views', () => {
  it('Today View: displays overdue tasks with warning and supports one-click reschedule to Today', async () => {
    const today = todayKey();
    const overdueDate = shiftDayKey(today, -3);

    fake.setUser({ id: 'u1', email: 'overdue@test.dev' });
    fake.db['u1'] = {
      tasks: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Prepare Tax Documents',
          list_name: 'Personal',
          priority: 'HIGH',
          status: 'todo',
          due_date: overdueDate,
          created_at: new Date().toISOString(),
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    // Switch to Today view
    const todayTab = screen.getByRole('button', { name: 'Today workspace' });
    await user.click(todayTab);

    // Overdue tasks section is displayed with warning
    expect(await screen.findByText(/Overdue Tasks \(1\)/i)).toBeTruthy();
    expect(screen.getByText('Prepare Tax Documents')).toBeTruthy();

    // Click "Reschedule all to Today"
    const rescheduleAllBtn = screen.getByRole('button', { name: /Reschedule all to Today/i });
    await user.click(rescheduleAllBtn);

    // Overdue section clears and task moves to Today's Tasks
    await waitFor(() => {
      expect(screen.queryByText(/Overdue Tasks/i)).toBeNull();
    });
    expect(screen.getByText(/Today's Tasks \(1\)/i)).toBeTruthy();
  });

  it('Upcoming View: groups future tasks cleanly into Tomorrow, This Week, and Later', async () => {
    const today = todayKey();
    const tomorrowDate = shiftDayKey(today, 1);
    const in3Days = shiftDayKey(today, 3);
    const in10Days = shiftDayKey(today, 10);

    fake.setUser({ id: 'u1', email: 'upcoming@test.dev' });
    fake.db['u1'] = {
      tasks: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Doctor Follow-up Consultation',
          list_name: 'Health',
          priority: 'HIGH',
          status: 'todo',
          due_date: tomorrowDate,
          created_at: new Date().toISOString(),
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          title: 'Sprint Planning Meeting',
          list_name: 'Work',
          priority: 'MEDIUM',
          status: 'todo',
          due_date: in3Days,
          created_at: new Date().toISOString(),
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          title: 'Quarterly Cloud Architecture Review',
          list_name: 'Work',
          priority: 'LOW',
          status: 'todo',
          due_date: in10Days,
          created_at: new Date().toISOString(),
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    // Switch to Upcoming view
    const upcomingTab = screen.getByRole('button', { name: 'Upcoming workspace' });
    await user.click(upcomingTab);

    // Verify timeline sections
    expect(await screen.findByText(/Tomorrow \(1\)/i)).toBeTruthy();
    expect(screen.getByText('Doctor Follow-up Consultation')).toBeTruthy();

    expect(screen.getByText(/This Week \(1\)/i)).toBeTruthy();
    expect(screen.getByText('Sprint Planning Meeting')).toBeTruthy();

    expect(screen.getByText(/Later & Future \(1\)/i)).toBeTruthy();
    expect(screen.getByText('Quarterly Cloud Architecture Review')).toBeTruthy();
  });

  it('All Tasks View: supports live search filtering, status filtering, and bulk operations', async () => {
    const today = todayKey();
    fake.setUser({ id: 'u1', email: 'all@test.dev' });
    fake.db['u1'] = {
      tasks: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          title: 'Alpha Feature Design',
          list_name: 'Work',
          priority: 'HIGH',
          status: 'todo',
          due_date: today,
          created_at: new Date().toISOString(),
        },
        {
          id: '66666666-6666-4666-8666-666666666666',
          title: 'Beta Testing Plan',
          list_name: 'Study',
          priority: 'LOW',
          status: 'todo',
          due_date: today,
          created_at: new Date().toISOString(),
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    // Switch to All Tasks view
    const allTab = screen.getByRole('button', { name: 'All tasks workspace' });
    await user.click(allTab);

    expect(await screen.findByText('Alpha Feature Design')).toBeTruthy();
    expect(screen.getByText('Beta Testing Plan')).toBeTruthy();

    // 1. Live search filter
    const searchInput = screen.getByPlaceholderText(/Search tasks by title/i);
    await user.type(searchInput, 'Alpha');

    expect(screen.getByText('Alpha Feature Design')).toBeTruthy();
    expect(screen.queryByText('Beta Testing Plan')).toBeNull();

    // Clear search
    await user.clear(searchInput);
    expect(await screen.findByText('Beta Testing Plan')).toBeTruthy();

    // 2. Bulk selection
    const selectAlpha = screen.getByRole('checkbox', { name: 'Select task Alpha Feature Design' });
    await user.click(selectAlpha);

    // Floating bulk bar appears
    expect(await screen.findByText('1 tasks selected')).toBeTruthy();

    // Mark Done via bulk action
    const markDoneBtn = screen.getByRole('button', { name: 'Mark Done' });
    await user.click(markDoneBtn);

    // Task becomes completed
    await waitFor(() => {
      expect(fake.db['u1'].tasks.find((t: any) => t.id === '55555555-5555-4555-8555-555555555555')?.status).toBe('completed');
    });
  });
});

describe('Phase 4 — Custom Lists & Safe List Deletion', () => {
  it('Supports creating custom lists, adding tasks, and safely deleting lists by migrating tasks to Inbox', async () => {
    fake.setUser({ id: 'u1', email: 'customlists@test.dev' });
    fake.db['u1'] = { ...EMPTY };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    // Switch to Custom Lists view
    const listsTab = screen.getByRole('button', { name: 'Custom lists workspace' });
    await user.click(listsTab);

    // 1. Click "New List"
    const newListBtn = screen.getByRole('button', { name: 'New List' });
    await user.click(newListBtn);

    // Fill in modal
    const listNameInput = await screen.findByPlaceholderText(/e.g. Project Apollo/i);
    await user.type(listNameInput, 'Home Renovation');
    const createBtn = screen.getByRole('button', { name: 'Create List' });
    await user.click(createBtn);

    // Verify new list pill appears and is selected
    expect(await screen.findByRole('heading', { level: 2, name: 'Home Renovation' })).toBeTruthy();

    // 2. Add a task to this new list
    const inlineTaskInput = screen.getByPlaceholderText('+ Add a task to Home Renovation...');
    await user.type(inlineTaskInput, 'Order Italian marble tiles');
    const addBtn = screen.getByRole('button', { name: 'Add' });
    await user.click(addBtn);

    expect(await screen.findByText('Order Italian marble tiles')).toBeTruthy();

    // 3. Click "Delete List" to trigger safe deletion modal
    const deleteListBtn = screen.getByRole('button', { name: 'Delete List' });
    await user.click(deleteListBtn);

    // Modal opens warning about the 1 task inside
    const modal = await screen.findByRole('dialog', { name: /Delete List Home Renovation/i });
    expect(within(modal).getByText(/This list currently contains/i)).toBeTruthy();
    expect(within(modal).getByText(/Move tasks to:/i)).toBeTruthy();

    // Confirm deletion with default "Move tasks to: Inbox"
    const confirmDeleteBtn = within(modal).getByRole('button', { name: 'Delete List' });
    await user.click(confirmDeleteBtn);

    // List is deleted from custom lists
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: 'Home Renovation' })).toBeNull();
    });

    // Task is NOT deleted! It was moved safely to Inbox!
    await waitFor(() => {
      const savedTask = fake.db['u1'].tasks.find((t: any) => t.title === 'Order Italian marble tiles');
      expect(savedTask).toBeTruthy();
      expect(savedTask?.list_name).toBe('Inbox');
    });
  });
});

describe('Phase 4 — Fast Task Creation with Progressive Disclosure', () => {
  it('TaskCreateCard allows instant capture with Enter key and progressive disclosure for details', async () => {
    fake.setUser({ id: 'u1', email: 'progressive@test.dev' });
    fake.db['u1'] = { ...EMPTY };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    // Switch to Today view
    await user.click(screen.getByRole('button', { name: 'Today workspace' }));

    // Input title and press Enter
    const titleInput = screen.getByPlaceholderText('+ Add a task for today (Press Enter)...');
    await user.type(titleInput, 'Instant Capture Task{enter}');

    // Task is added immediately
    expect(await screen.findByText('Instant Capture Task')).toBeTruthy();
  });
});
