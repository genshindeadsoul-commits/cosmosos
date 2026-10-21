// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fake from './fakeSupabase';

vi.mock('../../src/lib/supabase', () => ({ supabase: fake.fakeClient, isSupabaseConfigured: true, requireSupabase: () => fake.fakeClient }));
import App from '../../src/App';

const NAV = ['Dashboard', 'Notes', 'Tables', 'Expenses', 'Fitness', 'Goals & Habits', 'Custom Trackers', 'Tasks & Calendar', 'Settings'];

beforeEach(() => { fake.fnCalls.length = 0; Object.keys(fake.fnHandlers).forEach((k) => delete fake.fnHandlers[k]); cleanup(); localStorage.clear(); fake.calls.length = 0; Object.keys(fake.db).forEach((k) => delete fake.db[k]); window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as any); });

describe('auth gate', () => {
  it('shows login (and no private UI) with no session', async () => {
    fake.setUser(null);
    render(<App />);
    expect(await screen.findByText('Continue with Google')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });
  it('registers exactly one auth observer', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    render(<App />);
    await screen.findAllByText('Dashboard');
    expect(fake.fakeClient.__listenerCount()).toBe(1);
  });
});

describe('empty account', () => {
  it('opens every module without crashing and shows no seeded sample data', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    const errors: any[] = []; const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a); });
    render(<App />);
    await screen.findAllByText('Dashboard');
    const nav = within(screen.getByRole('navigation', { name: 'Main Navigation' }));
    for (let round = 0; round < 5; round++) for (const label of NAV) {
      await user.click(nav.getByRole('button', { name: new RegExp(label) }));
      expect(document.body.textContent).not.toMatch(/John Doe|genshindeadsoul|Review legal terms/);
    }
    spy.mockRestore();
    expect(errors.map((e) => String(e[0]).slice(0, 120))).toEqual([]);
  });
  it('has exactly one nav, one theme selector (Settings only), no admin entry for a normal user', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    expect(screen.getAllByRole('navigation', { name: 'Main Navigation' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Admin/ })).toBeNull();
    expect(screen.queryAllByRole('button', { name: /dark|light|theme/i }).filter((b) => !/Appearance/.test(b.textContent || ''))).toHaveLength(0);
    await user.click(within(screen.getByRole('navigation', { name: 'Main Navigation' })).getByRole('button', { name: /Settings/ }));
    expect(document.body.textContent).toMatch(/Light/);
  });
  it('admin sees Admin nav only when the DB says so', async () => {
    fake.setUser({ id: 'adm', email: 'boss@x.dev' }, true);
    render(<App />);
    await screen.findAllByText('Dashboard');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Admin/ })).toBeTruthy());
  });
});

describe('persistence', () => {
  it('quick-capture a task writes it once, and a fresh session reloads it', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    await user.click(screen.getAllByRole('button', { name: /Add Task/i })[0]);
    const input = await screen.findByPlaceholderText('e.g. Finish quarterly financial summary');
    expect(input).toBeTruthy();
    await user.type(input!, 'Pay rent');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(fake.calls.filter((c) => c.op === 'upsert' && c.table === 'tasks')).toHaveLength(1), { timeout: 4000 });
    expect(fake.db['u1'].tasks[0].title).toBe('Pay rent');
    cleanup();
    render(<App />);
    await screen.findAllByText('Dashboard');
    expect((await screen.findAllByText(/Pay rent/)).length).toBeGreaterThan(0);
  });
  it('account B never sees account A data after switching', async () => {
    fake.db['A'] = { tasks: [{ id: '11111111-1111-4111-8111-111111111111', title: 'A-only secret task', list_name: 'Inbox', status: 'todo', priority: 'LOW', due_date: null }] };
    fake.setUser({ id: 'A', email: 'a@x.dev' });
    render(<App />);
    await screen.findAllByText('Dashboard');
    expect(document.body.textContent).toMatch(/A-only secret task/);
    fake.setUser({ id: 'B', email: 'b@x.dev' });
    React.act(() => fake.emit('SIGNED_IN'));
    await waitFor(() => expect(document.body.textContent).toMatch(/b/));
    await screen.findAllByText('Dashboard');
    expect(document.body.textContent).not.toMatch(/A-only secret task/);
  });
});

describe('recurring tasks and search navigation', () => {
  const rid = '33333333-3333-4333-8333-333333333333';
  const seed = () => { fake.db['u1'] = { tasks: [{ id: rid, title: 'Weekly review', list_name: 'Work', status: 'todo', priority: 'LOW', due_date: '2026-10-19', recurrence: 'weekly' }],
    calendar_events: [{ id: '44444444-4444-4444-8444-444444444444', title: 'Dentist visit', event_date: '2026-10-22', start_time: '09:00 AM', end_time: '10:00 AM', category: 'General', source: 'local' }] }; };

  it('completing a weekly task creates exactly one next occurrence, once', async () => {
    seed(); fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(within(screen.getByRole('navigation', { name: 'Main Navigation' })).getByRole('button', { name: /Tasks & Calendar/ }));
    await user.click(await screen.findByRole('button', { name: 'Toggle task Weekly review' }));
    await waitFor(() => expect(fake.db['u1'].tasks).toHaveLength(2), { timeout: 4000 });
    const open = fake.db['u1'].tasks.filter((t) => t.status !== 'completed');
    expect(open).toHaveLength(1);
    expect(open[0].due_date).toBe('2026-10-26');
    expect(open[0].recurrence).toBe('weekly');
    expect(open[0].id).not.toBe(rid);
  });

  it('search finds a calendar event and lands on it in the Tasks & Calendar view', async () => {
    seed(); fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(screen.getByRole('button', { name: /search/i }));
    await user.type(await screen.findByPlaceholderText(/search/i), 'dentist');
    await screen.findAllByText('Event'); await user.click((await screen.findAllByText('Dentist visit')).at(-1)!);
    await waitFor(() => expect(document.querySelector('[data-record-id="44444444-4444-4444-8444-444444444444"]')).toBeTruthy());
    expect(document.querySelector('[data-record-id="44444444-4444-4444-8444-444444444444"]')!.className).toMatch(/ring-2/);
  });

  it('new task/event forms default to today and blank times, not stale hardcoded values', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(within(screen.getByRole('navigation', { name: 'Main Navigation' })).getByRole('button', { name: /Tasks & Calendar/ }));
    expect(document.body.innerHTML).not.toMatch(/2026-10-18|Google Meet|02:30 PM/);
  });
});


describe('integrations (UI against mocked server functions)', () => {
  const gotoSettings = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(within(screen.getByRole('navigation', { name: 'Main Navigation' })).getByRole('button', { name: /Settings/ }));
  const conn = (provider: string, extra: any = {}) => ({ id: `c-${provider}`, provider, status: 'connected', account_label: 'me@gmail.com', last_synced_at: null, last_error: null, ...extra });

  it('shows only truthful statuses: nothing is "Connected" unless the database says so', async () => {
    fake.db['u1'] = { integration_connections: [conn('gmail')] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await gotoSettings(user);
    await waitFor(() => expect(screen.getAllByText('Connected')).toHaveLength(1));
    expect(document.body.textContent).toMatch(/me@gmail\.com/);
    expect(document.body.textContent).not.toMatch(/Disconnected/);
  });

  it('Connect asks the server for an OAuth URL and redirects there; no secrets involved client-side', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['oauth-start'] = (b) => ({ url: `https://accounts.google.com/o/oauth2/v2/auth?state=abc&p=${b.provider}` });
    const assign = vi.fn(); Object.defineProperty(window, 'location', { value: { ...window.location, assign, search: '', pathname: '/', origin: 'http://localhost', hash: '' }, writable: true });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await gotoSettings(user);
    await user.click(await within(screen.getByRole('main')).findByText('Gmail'));
    await user.click(await screen.findByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.stringContaining('accounts.google.com')));
    expect(fake.fnCalls[0]).toEqual({ name: 'oauth-start', body: { provider: 'gmail' } });
  });

  it('server not configured => readable error, status stays not connected', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['oauth-start'] = () => ({ __error: { error: 'not_configured', message: 'Missing server secrets: GOOGLE_CLIENT_ID' } });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await gotoSettings(user);
    await user.click(await within(screen.getByRole('main')).findByText('Gmail'));
    await user.click(await screen.findByRole('button', { name: 'Connect' }));
    expect(await screen.findByText(/isn.t set up on the server yet/)).toBeTruthy();
    expect(screen.queryAllByText('Connected')).toHaveLength(0);
  });

  it('undeployed function => says so instead of pretending', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await gotoSettings(user);
    await user.click(await within(screen.getByRole('main')).findByText('Gmail'));
    await user.click(await screen.findByRole('button', { name: 'Connect' }));
    expect(await screen.findByText(/may not be deployed yet/)).toBeTruthy();
  });

  it('OAuth return with an error shows it and cleans the URL', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const replace = vi.spyOn(window.history, 'replaceState');
    Object.defineProperty(window, 'location', { value: { ...window.location, search: '?integration=gmail&integration_error=Permission%20was%20declined.', pathname: '/', origin: 'http://localhost', hash: '' }, writable: true });
    render(<App />); await screen.findAllByText('Dashboard');
    expect(await screen.findByText('Permission was declined.')).toBeTruthy();
    expect(replace).toHaveBeenCalled();
  });

  it('Gmail: connected user searches all mail, reads a message as plain text, creates a task (persisted)', async () => {
    fake.db['u1'] = { integration_connections: [conn('gmail')] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['gmail'] = (b) => b.action === 'list'
      ? { messages: [{ id: 'aaaa1111bbbb2222', threadId: 't', from: 'Bob <bob@x.com>', subject: b.q ? `Match for ${b.q}` : 'Invoice 42', date: 'Mon, 19 Oct 2026 10:00', snippet: 'please pay', unread: true }], nextPageToken: null }
      : { id: b.id, from: 'Bob <bob@x.com>', subject: 'Invoice 42', date: 'Mon', bodyText: 'Please pay <script>alert(1)</script> soon', attachments: [], webLink: 'https://mail.google.com/mail/u/0/#all/aaaa1111bbbb2222' };
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(screen.getByText('All Mail')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /Gmail/ }));
    expect(await screen.findByText('Invoice 42')).toBeTruthy();
    await user.type(screen.getByLabelText('Search mail'), 'from:bob{Enter}');
    expect(await screen.findByText('Match for from:bob')).toBeTruthy();
    expect(fake.fnCalls.some((c) => c.name === 'gmail' && c.body.action === 'list' && c.body.q === 'from:bob')).toBe(true);
    await user.click(screen.getByText('Match for from:bob'));
    const body = await screen.findByText(/Please pay/);
    expect(body.tagName).toBe('PRE');                              // plain text, never injected HTML
    expect(document.querySelector('script[src], pre script')).toBeNull();
    const link = screen.getByRole('link', { name: /Open in Gmail/ });
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    await user.click(screen.getByRole('button', { name: /Create task/ }));
    await waitFor(() => expect(fake.db['u1'].tasks?.some((t: any) => t.title === 'Email: Invoice 42' && /mail\.google\.com/.test(t.description))).toBe(true), { timeout: 4000 });
    expect(JSON.stringify(fake.db['u1'].tasks)).not.toMatch(/Please pay/);   // body is never stored
  });

  it('Gmail: provider error surfaces inline with retry (e.g. reauthorization)', async () => {
    fake.db['u1'] = { integration_connections: [conn('gmail')] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['gmail'] = () => ({ __error: { error: 'needs_reauthorization', message: 'x' } });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(screen.getByText('All Mail')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /Gmail/ }));
    expect(await screen.findByText(/Reconnect in Settings/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('Calendar import: re-running updates changed events and never duplicates', async () => {
    fake.db['u1'] = { integration_connections: [conn('google_calendar')] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    let title = 'Standup';
    fake.fnHandlers['calendar-import'] = () => ({ events: [{ providerId: 'g1', title, date: '2026-10-22', startTime: '09:00 AM', endTime: '09:30 AM' }, { providerId: 'g2', title: 'All hands', date: '2026-10-23', startTime: '', endTime: '' }], truncated: false });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await gotoSettings(user);
    await user.click(await screen.findByRole('button', { name: /Import events now/ }));
    await waitFor(() => expect(fake.db['u1'].calendar_events).toHaveLength(2), { timeout: 4000 });
    await user.click(await screen.findByRole('button', { name: /Import events now/ }));
    title = 'Standup (moved)';
    await user.click(await screen.findByRole('button', { name: /Import events now/ }));
    await waitFor(() => expect(fake.db['u1'].calendar_events.find((e: any) => e.provider_id === 'g1')!.title).toBe('Standup (moved)'), { timeout: 4000 });
    expect(fake.db['u1'].calendar_events).toHaveLength(2);
    expect(fake.db['u1'].calendar_events.every((e: any) => e.source === 'google_calendar')).toBe(true);
  });

  it('Health: token is revealed once with an ingest URL; connector stays not-connected until data arrives', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await gotoSettings(user);
    await user.click(await within(screen.getByRole('main')).findByText('Health Connect / Google Fit'));
    await user.click(await screen.findByRole('button', { name: 'Generate' }));
    expect(await screen.findByText(/cosmos_h_(ab){32}/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /saved it/ }));
    expect(screen.queryByText(/cosmos_h_(ab){32}/)).toBeNull();     // gone after dismissal, not retrievable
    expect(document.body.textContent).toMatch(/functions\/v1\/health-ingest/);
    expect(screen.queryAllByText('Connected')).toHaveLength(0);
  });

  it('Spotify selected but not connected: player says so and Play does not pretend to play', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['spotify-token'] = () => ({ __error: { error: 'not_connected', message: 'Not connected.' } });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(screen.getByRole('button', { name: /music|player/i }));
    await user.click(await screen.findByRole('button', { name: /spotify/i }));
    expect(await screen.findByText(/Connect in Settings/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Authorized Client|Spotify Editorial/);
  });
});
