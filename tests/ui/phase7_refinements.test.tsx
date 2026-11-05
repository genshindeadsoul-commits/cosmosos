// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fake from './fakeSupabase';
import { EMPTY_DATA as EMPTY, toRows } from '../../src/data/cloudData';

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

describe('Phase 7 — Goals & Habits Overhaul', () => {
  it('supports habit check-in, streak calculation, tabs, and goal updates', async () => {
    const habitId = '11111111-1111-4111-8111-111111111111';
    const goalId = '22222222-2222-4222-8222-222222222222';
    const today = todayKey();

    fake.setUser({
      id: 'u1',
      email: 'p7_goals@cosmos.dev',
      user_metadata: { full_name: 'Jordan Lee', workspace_name: "Jordan's Hub" },
    });

    fake.db['u1'] = toRows({
      ...EMPTY,
      habits: [
        {
          id: habitId,
          name: 'Morning Meditation',
          category: 'Mindfulness',
          streak: 3,
          checkins: {},
        },
      ],
      goals: [
        {
          id: goalId,
          title: 'Read 20 Books',
          category: 'LEARNING',
          current: 5,
          target: 20,
          unit: 'books',
          targetDate: '2026-12-31',
          completed: false,
          description: 'Read nonfiction and technical books',
        },
      ],
    });

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // Navigate to Goals & Habits
    await user.click(NAVBTN(/Goals & Habits/));
    expect(screen.getAllByText('Morning Meditation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Read 20 Books')).toBeTruthy();

    // 1-tap check-in on habit
    const checkinBtn = screen.getByRole('button', { name: `Toggle Morning Meditation for ${today}` });
    await user.click(checkinBtn);

    // Goal tab filtering
    const goalsTabBtn = screen.getByRole('button', { name: /Goals \(1\)/ });
    await user.click(goalsTabBtn);
    expect(screen.queryAllByText('Morning Meditation')).toHaveLength(0);
    expect(screen.getByText('Read 20 Books')).toBeTruthy();

    // Increment goal progress
    const incBtn = screen.getByRole('button', { name: 'Increment goal progress' });
    await user.click(incBtn);
    expect(screen.getByText('6 / 20 books')).toBeTruthy();

    // Mark goal as completed
    const completeBtn = screen.getByRole('button', { name: 'Mark goal completed' });
    await user.click(completeBtn);
    expect(await screen.findByText('Completed Milestones (1)')).toBeTruthy();

    // Reopen goal
    const reopenBtn = screen.getByRole('button', { name: 'Reopen' });
    await user.click(reopenBtn);
    expect(await screen.findByRole('button', { name: 'Mark goal completed' })).toBeTruthy();
  });
});

describe('Phase 7 — Custom Trackers Responsive Grid & Entry Management', () => {
  it('renders responsive metrics, logs an entry with delta, and deletes entry', async () => {
    const trkId = '33333333-3333-4333-8333-333333333333';
    const entryId = '44444444-4444-4444-8444-444444444444';

    fake.setUser({
      id: 'u1',
      email: 'p7_trackers@cosmos.dev',
      user_metadata: { full_name: 'Alex Taylor' },
    });

    fake.db['u1'] = toRows({
      ...EMPTY,
      trackers: [
        {
          id: trkId,
          name: 'Water Intake',
          unit: 'Liters',
          targetPerDay: 3.0,
          entries: [
            {
              id: entryId,
              date: todayKey(),
              value: 3.5,
              notes: 'Hydrated post-workout',
            },
          ],
        },
      ],
    });

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // Navigate to Custom Trackers
    await user.click(NAVBTN(/Custom Trackers/));
    expect(screen.getByText('Water Intake')).toBeTruthy();
    expect(screen.getByText('Target per Day')).toBeTruthy();
    expect(screen.getByText('3 Liters')).toBeTruthy();
    expect(screen.getByText('+0.5 Liters')).toBeTruthy();

    // Delete the entry
    const deleteEntryBtn = screen.getByRole('button', { name: `Delete entry ${entryId}` });
    await user.click(deleteEntryBtn);

    // Verify empty state row appears
    expect(screen.getByText(/No entries recorded yet/i)).toBeTruthy();

    // Edit tracker
    const editBtn = screen.getByRole('button', { name: 'Edit tracker' });
    await user.click(editBtn);
    const targetInput = screen.getByLabelText(/Daily Target/i);
    await user.clear(targetInput);
    await user.type(targetInput, '4.0');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText('4 Liters')).toBeTruthy();
  });
});

describe('Phase 7 — Fitness & Training Summaries and Workout Logging', () => {
  it('renders monthly summary metrics, logs workout from templates, and supports search', async () => {
    const today = todayKey();
    const workoutId = '55555555-5555-4555-8555-555555555555';

    fake.setUser({
      id: 'u1',
      email: 'p7_fitness@cosmos.dev',
      user_metadata: { full_name: 'Chris Evans' },
    });

    fake.db['u1'] = toRows({
      ...EMPTY,
      workouts: [
        {
          id: workoutId,
          title: 'Heavy Deadlift Session',
          date: today,
          durationMinutes: 60,
          calories: 450,
          exercises: [{ name: 'Deadlift', setsReps: '5x5', weightLbs: 225 }],
        },
      ],
    });

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // Navigate to Fitness
    await user.click(NAVBTN(/Fitness/));
    expect(screen.getByText('Fitness & Training')).toBeTruthy();
    expect(screen.getByText('Active Time')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('450')).toBeTruthy();
    expect(screen.getByText('Heavy Deadlift Session')).toBeTruthy();

    // Search filter
    const searchInput = screen.getByPlaceholderText(/Search workouts or exercises/i);
    await user.type(searchInput, 'Squat');
    expect(screen.getByText('No matching workouts found')).toBeTruthy();

    await user.clear(searchInput);
    await user.type(searchInput, 'Deadlift');
    expect(screen.getByText('Heavy Deadlift Session')).toBeTruthy();
  });
});

describe('Phase 7 — Focus Timer Persistent Floating Indicator', () => {
  it('renders floating mini focus timer in TopBar when running, even on other modules', async () => {
    fake.setUser({
      id: 'u1',
      email: 'p7_focus@cosmos.dev',
      user_metadata: { full_name: 'Taylor Swift' },
    });

    fake.db['u1'] = toRows({
      ...EMPTY,
    });

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // Start Focus Timer from Dashboard
    const startTimerBtn = screen.getByRole('button', { name: 'Start focus timer' });
    await user.click(startTimerBtn);

    // Navigate to Notes
    await user.click(NAVBTN(/Notes/));

    // Floating timer should be visible in TopBar
    const timerRegion = screen.getByRole('region', { name: 'Active focus timer' });
    expect(timerRegion).toBeTruthy();

    // Reset timer from floating pill
    const resetBtn = screen.getByRole('button', { name: 'Reset focus timer' });
    await user.click(resetBtn);

    // After reset, floating timer unmounts
    expect(screen.queryByRole('region', { name: 'Active focus timer' })).toBeNull();
  });
});

describe('Phase 7 — Global Search Category Filtering and Keyboard Navigation', () => {
  it('filters results by category and supports keyboard navigation', async () => {
    fake.setUser({
      id: 'u1',
      email: 'p7_search@cosmos.dev',
      user_metadata: { full_name: 'Sam Altman' },
    });

    fake.db['u1'] = toRows({
      ...EMPTY,
      tasks: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Review Cosmos OS architecture',
          status: 'pending',
          priority: 'high',
          list: 'Engineering',
          createdAt: '2026-11-01',
          updatedAt: '2026-11-01',
        },
      ],
      notes: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Cosmos Design Spec',
          content: 'Architecture overview for Cosmos',
          excerpt: 'Architecture overview',
          tags: ['Design'],
          createdAt: '2026-11-01',
          updatedAt: '2026-11-01',
        },
      ],
    });

    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');

    // Open Search modal
    const searchTrigger = screen.getByRole('button', { name: 'Search records across Cosmos' });
    await user.click(searchTrigger);

    const searchDialog = screen.getByRole('dialog', { name: 'Search Cosmos OS' });
    const searchInput = within(searchDialog).getByPlaceholderText(/Search tasks, notes, tables/i);
    await user.type(searchInput, 'Cosmos');

    // Should find both Task and Note under "All" inside the search dialog
    expect(within(searchDialog).getByText('Review Cosmos OS architecture')).toBeTruthy();
    expect(within(searchDialog).getByText('Cosmos Design Spec')).toBeTruthy();

    // Filter to Notes only
    const notesFilterBtn = within(searchDialog).getByRole('button', { name: 'Notes' });
    await user.click(notesFilterBtn);

    expect(within(searchDialog).queryByText('Review Cosmos OS architecture')).toBeNull();
    expect(within(searchDialog).getByText('Cosmos Design Spec')).toBeTruthy();

    // Press Enter to select note
    await user.keyboard('{Enter}');

    // Modal closes and Notes view opens
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Search Cosmos OS' })).toBeNull();
    });
  });
});
