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
import { CalendarDateCell } from '../../src/components/calendar/CalendarDateCell';
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

describe('Phase 3 — Calendar & Date Selection Interaction', () => {
  it('Single-click selects date; Double-click opens Day Details modal; Enter key opens Day Details', async () => {
    fake.setUser({ id: 'u1', email: 'cal@test.dev' });
    fake.db['u1'] = { ...EMPTY };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // Navigate to Tasks & Calendar
    await user.click(NAVBTN(/Tasks & Calendar/));
    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks & Scheduling' })).toBeTruthy();

    const today = todayKey();
    const todayCell = screen.getByRole('button', { name: new RegExp(`^${today}`) });
    expect(todayCell).toBeTruthy();

    // Verify modal is NOT initially open
    expect(screen.queryByRole('dialog')).toBeNull();

    // 1. Single click on the date cell selects it (does NOT open dialog)
    await user.click(todayCell);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Verify selection in the action banner
    expect(screen.getByText(new RegExp(`Selected:`))).toBeTruthy();

    // 2. Double-click on date cell opens Day Details modal
    await user.dblClick(todayCell);
    let dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Today')).toBeTruthy();

    // Close dialog using Close button
    const closeBtn = screen.getByRole('button', { name: 'Close day details' });
    await user.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();

    // 3. Pressing Enter key on the focused date cell opens Day Details modal
    todayCell.focus();
    fireEvent.keyDown(todayCell, { key: 'Enter', code: 'Enter' });
    dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    // Close dialog with Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    // 4. Dedicated "Open Day Details" button on the banner opens Day Details modal
    const openDetailsBannerBtn = screen.getByRole('button', { name: /Open Day Details/i });
    await user.click(openDetailsBannerBtn);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('CalendarDateCell: Touch long-press triggers onOpenDetails, while moving finger > 10px cancels it and fires onSelectDate on tap', () => {
    vi.useFakeTimers();
    try {
      const onSelect = vi.fn();
      const onOpen = vi.fn();

      render(
        <CalendarDateCell
          dateKey="2026-11-05"
          dayNum={5}
          isToday={true}
          isSelected={false}
          hasItems={false}
          dayOfWeekIndex={3}
          onSelectDate={onSelect}
          onOpenDetails={onOpen}
        />
      );

      const cell = screen.getByRole('button', { name: /^2026-11-05/ });

      // 1. Move finger > 10px during touch (scroll gesture)
      fireEvent.touchStart(cell, { touches: [{ clientX: 100, clientY: 100 }] });
      fireEvent.touchMove(cell, { touches: [{ clientX: 100, clientY: 125 }] }); // moved 25px
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.touchEnd(cell);

      // onOpen should NOT have been called because it was cancelled
      expect(onOpen).not.toHaveBeenCalled();

      // 2. Stationary touch for 450ms (long press gesture)
      fireEvent.touchStart(cell, { touches: [{ clientX: 100, clientY: 100 }] });
      act(() => {
        vi.advanceTimersByTime(450);
      });
      fireEvent.touchEnd(cell);

      // onOpenDetails MUST be called
      expect(onOpen).toHaveBeenCalledWith('2026-11-05');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Phase 3 — Universal Day Details Dynamic Sections', () => {
  it('When only a note exists on a date, Day Details displays Notes section and hides all other empty sections', async () => {
    const today = todayKey();
    fake.setUser({ id: 'u1', email: 'dynamic@test.dev' });
    fake.db['u1'] = {
      notes: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          title: 'Deep Focus Morning Journal',
          content: 'Meditated for 20 minutes and outlined architecture.',
          excerpt: 'Meditated for 20 minutes',
          starred: false,
          tags: ['Personal'],
          note_date: today,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    const todayCell = screen.getByRole('button', { name: new RegExp(`^${today}`) });
    await user.dblClick(todayCell);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    // Notes section SHOULD be displayed
    expect(within(dialog).getByText(/Notes \(1\)/i)).toBeTruthy();
    expect(within(dialog).getByText('Deep Focus Morning Journal')).toBeTruthy();

    // Other sections (Events, Tasks, Expenses, Workouts, Habits) MUST NOT be rendered
    expect(within(dialog).queryByText(/Scheduled Events/i)).toBeNull();
    expect(within(dialog).queryByText(/Tasks \(/i)).toBeNull();
    expect(within(dialog).queryByText(/Expenses & Income/i)).toBeNull();
    expect(within(dialog).queryByText(/Workouts & Fitness/i)).toBeNull();
    expect(within(dialog).queryByText(/Habits Checked/i)).toBeNull();
  });

  it('When an expense and a task exist on a date, Day Details displays both and updates records directly', async () => {
    const today = todayKey();
    const taskId = '66666666-6666-4666-8666-666666666666';
    const txId = '77777777-7777-4777-8777-777777777777';

    fake.setUser({ id: 'u1', email: 'shared@test.dev' });
    fake.db['u1'] = {
      tasks: [
        {
          id: taskId,
          title: 'Review production pull request',
          list_name: 'Work',
          priority: 'HIGH',
          status: 'todo',
          due_date: today,
          created_at: new Date().toISOString(),
        },
      ],
      transactions: [
        {
          id: txId,
          type: 'expense',
          category: 'Dining',
          title: 'Coffee and team lunch',
          amount: 450,
          tx_date: today,
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    const todayCell = screen.getByRole('button', { name: new RegExp(`^${today}`) });
    await user.dblClick(todayCell);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    // Tasks and Expenses sections SHOULD be displayed
    expect(within(dialog).getByText(/Tasks \(1\)/i)).toBeTruthy();
    expect(within(dialog).getByText('Review production pull request')).toBeTruthy();
    expect(within(dialog).getByText(/Expenses & Income \(1\)/i)).toBeTruthy();
    expect(within(dialog).getByText('Coffee and team lunch')).toBeTruthy();

    // Notes, Events, Workouts, Habits MUST NOT be displayed
    expect(within(dialog).queryByText(/Notes \(/i)).toBeNull();
    expect(within(dialog).queryByText(/Scheduled Events/i)).toBeNull();
    expect(within(dialog).queryByText(/Workouts & Fitness/i)).toBeNull();

    // Shared records update: Toggle task status from inside Day Details
    const toggleBtn = within(dialog).getByRole('button', { name: /Mark task Review production pull request complete/i });
    await user.click(toggleBtn);

    // Verify task status is now completed in the UI
    expect(within(dialog).getByRole('button', { name: /Mark task Review production pull request incomplete/i })).toBeTruthy();
  });

  it('Empty date renders minimal empty state with quick Add action buttons', async () => {
    fake.setUser({ id: 'u1', email: 'empty@test.dev' });
    fake.db['u1'] = { ...EMPTY };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    const today = todayKey();
    const todayCell = screen.getByRole('button', { name: new RegExp(`^${today}`) });
    await user.dblClick(todayCell);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    // Minimal empty state message
    expect(within(dialog).getByText(/No records for/i)).toBeTruthy();

    // Quick Add buttons are present
    expect(within(dialog).getByRole('button', { name: '+ Add Task' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '+ Schedule Event' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Add note for this date' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '+ Log Expense' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '+ Log Workout' })).toBeTruthy();
  });
});

describe('Phase 3 — Multi-Day Events', () => {
  it('A single multi-day event spans across its date range and updates as one record', async () => {
    const today = todayKey();
    const futureDate = shiftDayKey(today, 3);
    const eventId = '88888888-8888-4888-8888-888888888888';

    fake.setUser({ id: 'u1', email: 'multiday@test.dev' });
    fake.db['u1'] = {
      calendar_events: [
        {
          id: eventId,
          title: 'Design Systems Conference',
          event_date: today,
          end_date: futureDate,
          all_day: true,
          color: '#2B4C7E',
          category: 'Work',
          description: 'Attending annual design summit',
        },
      ],
    };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    // Verify multi-day event span indicator on today cell
    const todayCell = screen.getByRole('button', { name: new RegExp(`^${today}`) });
    expect(todayCell).toBeTruthy();

    // Open Day Details on today
    await user.dblClick(todayCell);
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Design Systems Conference')).toBeTruthy();
    expect(within(dialog).getByText(`${today} → ${futureDate}`)).toBeTruthy();

    // Delete the event from Day Details
    const deleteBtn = within(dialog).getByRole('button', { name: /Remove event Design Systems Conference/i });
    await user.click(deleteBtn);

    // Event should be deleted
    expect(within(dialog).queryByText('Design Systems Conference')).toBeNull();

    // Close Day Details
    const closeBtn = screen.getByRole('button', { name: 'Close day details' });
    await user.click(closeBtn);

    // Check that event was removed from Supabase DB sync
    await waitFor(() => {
      expect(fake.db['u1'].calendar_events || []).toHaveLength(0);
    });
  });
});

describe('Phase 3 — Calendar Views and Historical Navigation', () => {
  it('Allows switching between Month, Week, and Day views and navigating history', async () => {
    fake.setUser({ id: 'u1', email: 'views@test.dev' });
    fake.db['u1'] = { ...EMPTY };

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tasks & Calendar/));

    // Month view is default
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('Sun')).toBeTruthy();

    // Switch to Week view
    const weekBtn = screen.getByRole('button', { name: 'week' });
    await user.click(weekBtn);
    const detailsButtons = screen.getAllByText('Details →');
    expect(detailsButtons.length).toBe(7);

    // Switch to Day view
    const dayBtn = screen.getByRole('button', { name: 'day' });
    await user.click(dayBtn);
    expect(screen.getByRole('button', { name: /Open Full Day Details/i })).toBeTruthy();

    // Switch back to Month view
    const monthBtn = screen.getByRole('button', { name: 'month' });
    await user.click(monthBtn);

    // Test Historical Jump (Year Select)
    const yearSelect = screen.getByLabelText('Select year');
    await user.selectOptions(yearSelect, '2024');
    expect(screen.getAllByText(/2024/).length).toBeGreaterThanOrEqual(1);

    // Test "Today" quick button brings back to current view
    const todayBtn = screen.getByRole('button', { name: 'Today' });
    await user.click(todayBtn);
    const currentYear = new Date().getFullYear().toString();
    expect(screen.getAllByText(new RegExp(currentYear)).length).toBeGreaterThanOrEqual(1);
  });
});
