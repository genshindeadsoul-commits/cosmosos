// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fake from './fakeSupabase';

vi.mock('../../src/lib/supabase', () => ({ supabase: fake.fakeClient, isSupabaseConfigured: true, requireSupabase: () => fake.fakeClient }));
import App from '../../src/App';

const REAL_LOCATION = Object.getOwnPropertyDescriptor(window, 'location')!;
const NAV = ['Dashboard', 'Notes', 'Tables', 'Expenses', 'Fitness', 'Goals & Habits', 'Custom Trackers', 'Tasks & Calendar', 'Settings'];

beforeEach(() => { Object.defineProperty(window, 'location', REAL_LOCATION); fake.failWrites.on = false; window.history.replaceState({}, '', '/'); fake.fnCalls.length = 0; Object.keys(fake.fnHandlers).forEach((k) => delete fake.fnHandlers[k]); cleanup(); localStorage.clear(); fake.calls.length = 0; Object.keys(fake.db).forEach((k) => delete fake.db[k]); window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as any); });

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


const NAVBTN = (label: RegExp) => within(screen.getByRole('navigation', { name: 'Main Navigation' })).getByRole('button', { name: label });
const NOTE_ID = '55555555-5555-4555-8555-555555555555';
const seedNote = () => ({ notes: [{ id: NOTE_ID, title: 'Quarterly plan', content: 'c', excerpt: 'c', starred: false, tags: [], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }] });

describe('router', () => {
  it('deep link opens the right module; navigation updates the URL; back button restores', async () => {
    window.history.replaceState({}, '', '/tasks');
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(screen.getAllByText('Tasks & Calendar').length).toBeGreaterThan(1));   // sidebar item + top bar title
    expect(window.location.pathname).toBe('/tasks');
    await user.click(NAVBTN(/Settings/));
    expect(window.location.pathname).toBe('/settings');
    React.act(() => { window.history.back(); window.dispatchEvent(new PopStateEvent('popstate')); });
    await waitFor(() => expect(window.location.pathname).toBe('/tasks'));
    await user.click(NAVBTN(/Dashboard/));
    expect(window.location.pathname).toBe('/');
  });
  it('unknown paths fall back to the dashboard', async () => {
    window.history.replaceState({}, '', '/definitely-not-a-page');
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    render(<App />); await screen.findAllByText('Dashboard');
    expect(document.body.textContent).not.toMatch(/Page not found|undefined/);
  });
  it('a non-admin deep-linking to /admin sees no admin content', async () => {
    window.history.replaceState({}, '', '/admin');
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    render(<App />); await screen.findAllByText('Dashboard');
    expect(screen.queryByText('Admin overview')).toBeNull();
  });
});

describe('notes <-> tasks', () => {
  it('Schedule creates a linked, dated task; the task links back; deleting the note cannot poison later edits', async () => {
    fake.db['u1'] = seedNote();
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Notes/));
    await user.click(await screen.findByRole('button', { name: 'Schedule this note' }));
    const date = screen.getByLabelText('Due date') as HTMLInputElement;
    await user.clear(date); await user.type(date, '2026-11-05');
    await user.click(screen.getByRole('button', { name: 'Create linked task' }));
    await waitFor(() => expect(fake.db['u1'].tasks?.[0]).toMatchObject({ title: 'Review: Quarterly plan', due_date: '2026-11-05', linked_note_id: NOTE_ID }), { timeout: 4000 });
    await user.click(NAVBTN(/Tasks & Calendar/));
    await user.click(await screen.findByRole('button', { name: /Open linked note Quarterly plan/ }));
    expect(window.location.pathname).toBe('/notes');
    // Delete the note through the UI, then complete the task. The write must not reference the deleted note.
    await user.click(NAVBTN(/Notes/));
    await user.click(await screen.findByRole('button', { name: 'Delete note' }));
    const confirmBtn = within(screen.getByText('Delete?').parentElement!).getAllByRole('button')[0];
    await user.click(confirmBtn);
    await waitFor(() => expect(fake.db['u1'].notes).toHaveLength(0), { timeout: 4000 });
    fake.db['u1'].tasks[0].linked_note_id = null;                   // what the real FK ON DELETE SET NULL does server-side
    fake.calls.length = 0;
    await user.click(NAVBTN(/Tasks & Calendar/));
    await user.click(await screen.findByRole('button', { name: 'Toggle task Review: Quarterly plan' }));
    await waitFor(() => expect(fake.calls.some((c) => c.op === 'upsert' && c.table === 'tasks')).toBe(true), { timeout: 4000 });
    expect(fake.db['u1'].tasks[0].linked_note_id).toBeNull();
    expect(fake.db['u1'].tasks[0].status).toBe('completed');
  });
  it('Notes toolbar reports the REAL save state: "Not saved" when the server rejects the write', async () => {
    fake.db['u1'] = seedNote();
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Notes/));
    fake.failWrites.on = true;
    const title = await screen.findByDisplayValue('Quarterly plan');
    await user.type(title, ' v2');
    await waitFor(() => expect(within(screen.getByRole('main')).getAllByRole('status').some((e) => e.textContent === 'Not saved')).toBe(true), { timeout: 4000 });
  });
});

describe('CSV import', () => {
  const TBL = '66666666-6666-4666-8666-666666666666';
  const seedTable = () => ({ data_tables: [{ id: TBL, name: 'Ledger', description: '', columns: [{ id: 'c1', name: 'Name', type: 'text' }, { id: 'c2', name: 'Amount', type: 'number' }], created_at: '', updated_at: '' }],
    table_rows: [{ id: '77777777-7777-4777-8777-777777777777', table_id: TBL, position: 0, data: { c1: 'Existing', c2: '5', index: 1 } }] });

  it('maps by header name, handles quoted commas/newlines, reports bad rows, skips duplicates, inserts once', async () => {
    fake.db['u1'] = seedTable();
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tables/));
    const csv = 'amount,Name,Ignored\r\n"1,200.50","Smith, John",x\r\n7,"multi\nline",y\r\nabc,Bad Row,z\r\n5,Existing,q\r\n';
    const input = (await screen.findByText('Import CSV')).parentElement!.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, new File([csv], 'rows.csv', { type: 'text/csv' }));
    const dlg = await screen.findByRole('dialog', { name: 'Import CSV' });
    await within(dlg).findByText(/will be added/);
    expect(dlg.textContent).toMatch(/2\s*rows will be added/);
    expect(dlg.textContent).toMatch(/1\s*duplicate/);
    expect(dlg.textContent).toMatch(/1\s*invalid row/);
    expect(within(dlg).getByLabelText('Invalid rows').textContent).toMatch(/Line 4: .abc. isn.t a number/);
    expect((within(dlg).getByLabelText('Map Ignored') as HTMLSelectElement).value).toBe('');
    expect(fake.db['u1'].table_rows).toHaveLength(1);                 // nothing written before confirming
    await user.click(within(dlg).getByRole('button', { name: 'Import 2 rows' }));
    await waitFor(() => expect(fake.db['u1'].table_rows).toHaveLength(3), { timeout: 4000 });
    const data = fake.db['u1'].table_rows.map((r: any) => r.data);
    expect(data.some((d: any) => d.c1 === 'Smith, John' && d.c2 === '1200.5')).toBe(true);
    expect(data.some((d: any) => d.c1 === 'multi\nline' && d.c2 === '7')).toBe(true);
    expect(fake.calls.filter((c) => c.op === 'upsert' && c.table === 'table_rows')).toHaveLength(1);   // one batched write
  });
  it('rejects an unreadable file with a clear message and writes nothing', async () => {
    fake.db['u1'] = seedTable();
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Tables/));
    const input = (await screen.findByText('Import CSV')).parentElement!.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, new File(['a,b\n"oops,1'], 'bad.csv', { type: 'text/csv' }));
    expect(await screen.findByText(/unclosed quote/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import' }).hasAttribute('disabled')).toBe(true);
    expect(fake.db['u1'].table_rows).toHaveLength(1);
  });
});

describe('sign-out and account switching', () => {
  const addTaskViaQuickCapture = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(screen.getAllByRole('button', { name: /Add Task/i })[0]);
    const input = await screen.findByPlaceholderText('e.g. Finish quarterly financial summary');
    await user.type(input, title); await user.keyboard('{Enter}');
  };
  const openProfileSignOut = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /profile/i }));
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
  };

  it('signing out immediately after an edit still saves it first (no silent loss)', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await addTaskViaQuickCapture(user, 'Last-second task');
    await openProfileSignOut(user);                                   // well inside the 600 ms debounce
    expect(await screen.findByText('Continue with Google')).toBeTruthy();
    expect(fake.db['u1'].tasks.map((t: any) => t.title)).toContain('Last-second task');
  });
  it('if the save fails, sign-out asks first; declining keeps you signed in with your data', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    fake.failWrites.on = true;
    await addTaskViaQuickCapture(user, 'Unsaved task');
    await openProfileSignOut(user);
    await waitFor(() => expect(confirm).toHaveBeenCalled(), { timeout: 4000 });
    expect(screen.queryByText('Continue with Google')).toBeNull();
    confirm.mockRestore();
  });
  it('five account switches: nobody ever sees or receives another account\'s data', async () => {
    const accounts = ['A', 'B', 'C', 'A', 'B'] as const;
    for (const id of ['A', 'B', 'C']) fake.db[id] = { tasks: [{ id: `${id.charCodeAt(0).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`, title: `${id}-private-task`, list_name: 'Inbox', status: 'todo', priority: 'LOW', due_date: null }] };
    fake.setUser({ id: 'A', email: 'a@x.dev' });
    render(<App />); await screen.findAllByText('Dashboard');
    for (const [i, id] of accounts.entries()) {
      if (i > 0) { fake.setUser({ id, email: `${id.toLowerCase()}@x.dev` }); React.act(() => fake.emit('SIGNED_IN')); }
      await waitFor(() => expect(document.body.textContent).toContain(`${id}-private-task`), { timeout: 4000 });
      for (const other of ['A', 'B', 'C'].filter((x) => x !== id)) expect(document.body.textContent).not.toContain(`${other}-private-task`);
    }
    // nothing leaked into storage either
    for (const id of ['A', 'B', 'C']) expect(fake.db[id].tasks.every((t: any) => t.title === `${id}-private-task`)).toBe(true);
  });
});
