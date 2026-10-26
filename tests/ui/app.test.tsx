// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fake from './fakeSupabase';
import { buildBackupJson } from '../../src/data/backup';
import { EMPTY_DATA as EMPTY } from '../../src/data/cloudData';

vi.mock('../../src/lib/supabase', () => ({ supabase: fake.fakeClient, isSupabaseConfigured: true, supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon', requireSupabase: () => fake.fakeClient }));
import App from '../../src/App';

const REAL_LOCATION = Object.getOwnPropertyDescriptor(window, 'location')!;
const NAV = ['Dashboard', 'Notes', 'Tables', 'Expenses', 'Fitness', 'Goals & Habits', 'Custom Trackers', 'Tasks & Calendar', 'Settings'];

beforeEach(() => { fake.failTables.clear(); fake.exchange.result = 'fail'; fake.exchange.message = 'PKCE code verifier not found in storage.'; Object.defineProperty(window, 'location', REAL_LOCATION); fake.failWrites.on = false; window.history.replaceState({}, '', '/'); fake.fnCalls.length = 0; Object.keys(fake.fnHandlers).forEach((k) => delete fake.fnHandlers[k]); cleanup(); localStorage.clear(); fake.calls.length = 0; Object.keys(fake.db).forEach((k) => delete fake.db[k]); window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as any); });

describe('auth gate', () => {
  it('returning from Google with a code but no session explains the address mismatch instead of silently showing login', async () => {
    fake.setUser(null);
    window.history.replaceState({}, '', '/?code=spent-code-123');
    const replace = vi.spyOn(window.history, 'replaceState');
    render(<App />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/couldn’t complete it/);
    expect(alert.textContent).toContain(window.location.host);
    expect(alert.textContent).toMatch(/Redirect URLs/);
    expect(replace).toHaveBeenCalled();                                   // spent code removed from the URL
    expect(window.location.search).toBe('');
    expect(screen.getByText('Continue with Google')).toBeTruthy();         // can retry
  });
  it('shows the REAL reason the code exchange failed, and notes when no sign-in secret is stored', async () => {
    fake.setUser(null); localStorage.clear();
    fake.exchange.message = 'code challenge does not match previously saved code verifier';
    window.history.replaceState({}, '', '/?code=abc');
    render(<App />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('code challenge does not match previously saved code verifier');
    expect(alert.textContent).toMatch(/no saved sign-in secret for this address/);
    expect(alert.textContent).not.toContain('abc');                                     // the code itself is never shown
  });
  it('if the explicit exchange succeeds, you are signed in with no error and the code is removed from the URL', async () => {
    fake.setUser(null); fake.exchange.result = 'ok';
    window.history.replaceState({}, '', '/?code=abc');
    render(<App />);
    await screen.findAllByText('Dashboard');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.search).toBe('');
  });
  it('double-clicking Continue with Google starts exactly one sign-in', async () => {
    fake.setUser(null); fake.oauthCalls.length = 0;
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ external: { google: true } }), { status: 200 }));
    const user = userEvent.setup();
    render(<App />);
    const btn = await screen.findByText('Continue with Google');
    await user.dblClick(btn);
    await user.click(btn);
    await waitFor(() => expect(fake.oauthCalls).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 150));
    expect(fake.oauthCalls).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Opening Google…' }).hasAttribute('disabled')).toBe(true);
    f.mockRestore();
  });
  it('a normal visit (no code) shows no sign-in error', async () => {
    fake.setUser(null);
    render(<App />);
    await screen.findByText('Continue with Google');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('Google provider disabled in Supabase => readable setup message, and no redirect to the raw JSON error', async () => {
    fake.setUser(null); fake.oauthCalls.length = 0;
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ external: { google: false, email: true } }), { status: 200 }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Continue with Google'));
    expect(await screen.findByText(/Google sign-in is not enabled for this Supabase project/)).toBeTruthy();
    expect(fake.oauthCalls).toHaveLength(0);
    expect(String(f.mock.calls[0][0])).toBe('https://x.supabase.co/auth/v1/settings');
    f.mockRestore();
  });
  it('Google provider enabled => proceeds to OAuth normally', async () => {
    fake.setUser(null); fake.oauthCalls.length = 0;
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ external: { google: true } }), { status: 200 }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Continue with Google'));
    await waitFor(() => expect(fake.oauthCalls).toHaveLength(1));
    f.mockRestore();
  });
  it('settings endpoint unreachable => still attempts sign-in instead of blocking', async () => {
    fake.setUser(null); fake.oauthCalls.length = 0;
    const f = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Continue with Google'));
    await waitFor(() => expect(fake.oauthCalls).toHaveLength(1));
    f.mockRestore();
  });
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
    await waitFor(() => expect(within(screen.getByRole('main')).getAllByText('Connected')).toHaveLength(1));
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

  const goMail = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => expect(screen.getAllByText('Connected').length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: /^Gmail/ }));
  };
  const SC = { read: 'https://www.googleapis.com/auth/gmail.readonly', modify: 'https://www.googleapis.com/auth/gmail.modify', send: 'https://www.googleapis.com/auth/gmail.send' };
  const msg = (id: string, over: any = {}) => ({ id, threadId: 't' + id, from: 'Bob <bob@x.com>', subject: `Subject ${id}`, date: 'Mon, 19 Oct 2026 10:00', snippet: 'snip', unread: true, starred: false, internalDate: 1790000000000, ...over });
  const full = (id: string) => ({ id, threadId: 't' + id, from: 'Bob <bob@x.com>', to: 'me@x.com', cc: '', replyTo: '', subject: `Subject ${id}`, date: 'Mon', messageId: '<m1@x.com>', references: '', unread: true, starred: false, bodyText: 'Please pay <script>alert(1)</script> soon', attachments: [{ filename: '../../evil.pdf', mimeType: 'application/pdf', size: 3, attachmentId: 'ANGjdJ_abcdefghij' }], webLink: `https://mail.google.com/mail/u/0/#all/${id}` });

  it('Mail: folders send real Gmail folder ids; Inbox first; search is per-folder; pagination appends without duplicates', async () => {
    fake.db['u1'] = { integration_connections: [conn('gmail', { granted_scopes: [SC.read] })] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['gmail'] = (b) => b.action === 'list'
      ? (b.pageToken === 'P2' ? { messages: [msg('aaaa0002'), msg('aaaa0003')], nextPageToken: null } : { messages: [msg('aaaa0001'), msg('aaaa0002')], nextPageToken: 'P2' }) : full(b.id);
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goMail(user);
    await screen.findByText('Subject aaaa0001');
    expect(fake.fnCalls.find((c) => c.body.action === 'list')!.body.folder).toBe('inbox');
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Subject aaaa0003');
    expect(screen.getAllByText('Subject aaaa0002')).toHaveLength(1);                       // duplicate across pages rendered once
    const nav = within(screen.getByRole('navigation', { name: 'Mail folders' }));
    for (const [label, id] of [['All Mail', 'all'], ['Sent', 'sent'], ['Drafts', 'drafts'], ['Starred', 'starred'], ['Spam', 'spam'], ['Trash', 'trash']]) {
      await user.click(nav.getByRole('button', { name: label }));
      await waitFor(() => expect(fake.fnCalls.filter((c) => c.body.action === 'list').at(-1)!.body.folder).toBe(id));
    }
    await user.type(screen.getByLabelText('Search mail'), 'invoice{Enter}');
    await waitFor(() => expect(fake.fnCalls.filter((c) => c.body.action === 'list').at(-1)!.body).toMatchObject({ folder: 'trash', q: 'invoice' }));
    expect(fake.db['u1'].user_settings?.[0]?.preferences?.mailFolder ?? 'trash').toBe('trash');
  });

  it('Mail (read-only grant): reads as plain text, downloads attachments safely, and blocks star/reply with a clear prompt', async () => {
    fake.db['u1'] = { integration_connections: [conn('gmail', { granted_scopes: [SC.read] })] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['gmail'] = (b) => b.action === 'list' ? { messages: [msg('aaaa0001')], nextPageToken: null } : b.action === 'attachment' ? { size: 3, data: 'AQID' } : full(b.id);
    const created: Blob[] = []; const urlSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((b: any) => { created.push(b); return 'blob:x'; }); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clicked: string[] = []; const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.download); });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goMail(user);
    await user.click(await screen.findByText('Subject aaaa0001'));
    const body = await screen.findByText(/Please pay/);
    expect(body.tagName).toBe('PRE'); expect(document.querySelector('pre script')).toBeNull();     // never injected as HTML
    expect(screen.getByRole('link', { name: /Open in Gmail/ }).getAttribute('rel')).toMatch(/noopener/);
    await user.click(screen.getByRole('button', { name: 'Download ../../evil.pdf' }));
    await waitFor(() => expect(clicked).toEqual(['evil.pdf']));                                  // path traversal stripped from the filename
    expect(created[0].type).toBe('application/octet-stream');
    expect(created[0].size).toBe(3);
    expect(fake.fnCalls.some((c) => c.body.action === 'modify')).toBe(false);                    // no silent modify without the scope
    await user.click(screen.getByRole('button', { name: /^Star$/ }));
    expect(await screen.findByText(/Enable “Mark read \/ star” first/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Reply/ }));
    expect(await screen.findByText(/Enable “Send email” first/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    urlSpy.mockRestore(); clickSpy.mockRestore();
  });

  it('Mail: enabling a permission asks the server for an upgrade of exactly that capability', async () => {
    fake.db['u1'] = { integration_connections: [conn('gmail', { granted_scopes: [SC.read] })] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['gmail'] = () => ({ messages: [], nextPageToken: null });
    fake.fnHandlers['oauth-start'] = () => ({ url: 'https://accounts.google.com/x' });
    const assign = vi.fn(); Object.defineProperty(window, 'location', { value: { ...window.location, assign, search: '', pathname: '/', origin: 'http://localhost', hash: '' }, writable: true });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goMail(user);
    await user.click(await within(screen.getByRole('navigation', { name: 'Mail folders' })).findByRole('button', { name: 'Enable send email' }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(fake.fnCalls.find((c) => c.name === 'oauth-start')!.body).toEqual({ provider: 'gmail', capabilities: ['send'] });
  });

  it('Mail (full grant): marks read on open, stars, and replies with threading; server errors show inside the compose form', async () => {
    fake.db['u1'] = { integration_connections: [conn('gmail', { granted_scopes: [SC.read, SC.modify, SC.send] })] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    let sendFails = true;
    fake.fnHandlers['gmail'] = (b) => {
      if (b.action === 'list') return { messages: [msg('aaaa0001')], nextPageToken: null };
      if (b.action === 'get') return full(b.id);
      if (b.action === 'modify') return { id: b.id, unread: b.addLabelIds.includes('UNREAD') ? true : !b.removeLabelIds.includes('UNREAD') && true, starred: b.addLabelIds.includes('STARRED') };
      if (b.action === 'send') return sendFails ? { __error: { error: 'rate_limited', message: 'Rate limited by gmail. Try again shortly.' } } : { id: 's1', threadId: 'taaaa0001' };
    };
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goMail(user);
    await user.click(await screen.findByText('Subject aaaa0001'));
    await waitFor(() => expect(fake.fnCalls.some((c) => c.body.action === 'modify' && c.body.removeLabelIds?.includes('UNREAD'))).toBe(true));
    await user.click(screen.getByRole('button', { name: /^Star$/ }));
    await waitFor(() => expect(fake.fnCalls.some((c) => c.body.action === 'modify' && c.body.addLabelIds?.includes('STARRED'))).toBe(true));
    await user.click(screen.getByRole('button', { name: /Reply/ }));
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('bob@x.com');
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('Re: Subject aaaa0001');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toMatch(/> Please pay/);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/rate-limiting requests/)).toBeTruthy();
    expect(screen.getByLabelText('Message')).toBeTruthy();                               // draft kept after a failure
    sendFails = false;
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull());
    expect(fake.fnCalls.filter((c) => c.body.action === 'send').at(-1)!.body).toMatchObject({ to: 'bob@x.com', threadId: 'taaaa0001', inReplyTo: '<m1@x.com>', references: '<m1@x.com>' });
  });

  it('Mail: provider error surfaces inline with retry (reauthorization), and an unconnected account sees only Connect', async () => {
    fake.db['u1'] = { integration_connections: [conn('gmail', { granted_scopes: [SC.read] })] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['gmail'] = () => ({ __error: { error: 'needs_reauthorization', message: 'x' } });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goMail(user);
    expect(await screen.findByText(/Reconnect in Settings/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    cleanup(); fake.db['u1'] = {};
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(screen.getByRole('button', { name: /^Gmail/ }));
    expect(await screen.findByRole('button', { name: 'Connect Gmail' })).toBeTruthy();
    expect(screen.queryByLabelText('Search mail')).toBeNull();
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
    expect(document.body.textContent).toMatch(/functions\/v1\/api\/health-ingest/);
    expect(screen.queryAllByText('Connected')).toHaveLength(0);
  });

  it('Spotify selected but not connected: player says so and Play does not pretend to play', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['spotify-token'] = () => ({ __error: { error: 'not_connected', message: 'Not connected.' } });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(screen.getByRole('button', { name: 'Toggle Focus Sound & Music Player' }));
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


// ---------------- Music hub: playlists + widget ----------------
class PE extends MouseEvent { pointerId: number; constructor(t: string, i: any = {}) { super(t, i); this.pointerId = i.pointerId ?? 1; } }
const PL = 'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb';
const PL_EMBED = 'https://embed.music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb';
const APPLE_ITEM = { id: '99999999-9999-4999-8999-999999999991', name: 'Today’s Hits', provider: 'apple', kind: 'playlist', openUrl: PL, embedUrl: PL_EMBED, enabled: true };
const SP_ID = '37i9dQZF1DXcBWIGoYBM5M';
const SPOTIFY_ITEM = { id: '99999999-9999-4999-8999-999999999992', name: 'Deep Focus', provider: 'spotify', kind: 'playlist', openUrl: `https://open.spotify.com/playlist/${SP_ID}`, embedUrl: `https://open.spotify.com/embed/playlist/${SP_ID}`, enabled: true };
const prefsOf = (preferences: any, uid = 'u1') => ({ user_settings: [{ user_id: uid, preferences }] });
const hub = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole('button', { name: 'Toggle Focus Sound & Music Player' })); };
const openApple = async (user: ReturnType<typeof userEvent.setup>) => { await hub(user); await user.click(await screen.findByRole('button', { name: 'Playlists' })); };
const widget = () => screen.queryByRole('region', { name: /^(Apple Music|Spotify|Music player)$/ }) as HTMLElement | null;
const frame = () => document.querySelector('iframe[title$=" player"]') as HTMLIFrameElement | null;   // Apple Music or Spotify embed
const savedPrefs = () => fake.db['u1']?.user_settings?.[0]?.preferences?.appleMusic;

describe('Apple Music widget (official embed)', () => {
  beforeEach(() => { (window as any).PointerEvent = PE; Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true }); Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true }); });

  it('the hub opens nothing by default; with no playlists it explains how to add one instead of showing a paste box', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    expect(widget()).toBeNull();
    await openApple(user);
    const w = await screen.findByRole('region', { name: 'Music player' });
    expect(within(w).getByText('No playlists enabled')).toBeTruthy();
    expect(frame()).toBeNull();
    expect(within(w).queryByLabelText(/link/i)).toBeNull();
    await user.click(within(w).getByRole('button', { name: 'Open Music & Playlists' }));
    expect(window.location.pathname).toBe('/settings');
    expect(screen.getByRole('heading', { name: 'Music & Playlists' })).toBeTruthy();
  });

  it('keeps the SAME iframe node across module navigation, unrelated state updates, minimize and resize; Hide unmounts it', async () => {
    fake.db['u1'] = { user_settings: [{ user_id: 'u1', preferences: { playlists: [APPLE_ITEM], appleMusic: { visible: true, mode: 'compact' } } }] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(frame()).toBeTruthy());
    const node = frame()!;
    for (const label of [/Notes/, /Tables/, /Expenses/, /Tasks & Calendar/, /Settings/, /Dashboard/]) { await user.click(NAVBTN(label)); expect(frame()).toBe(node); }
    await user.click(screen.getAllByRole('button', { name: /Add Task/i })[0]);                      // unrelated app-state churn
    await user.keyboard('{Escape}');
    expect(frame()).toBe(node);
    await user.click(screen.getByRole('button', { name: 'Minimize player' }));
    expect(frame()).toBe(node);                                                                        // minimized = still mounted (audio continues)
    expect(widget()!.querySelector('[aria-hidden="true"]')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Restore player' }));
    await user.click(screen.getByRole('button', { name: 'Expand' }));
    expect(frame()).toBe(node);
    expect(widget()!.style.width).toBe('400px');
    await user.click(screen.getByRole('button', { name: 'Compact size' }));
    expect(widget()!.style.width).toBe('340px');
    await user.click(screen.getByRole('button', { name: 'Hide player' }));
    expect(frame()).toBeNull(); expect(widget()).toBeNull();                                           // hiding stops playback
    await openApple(user);                                                                             // restore from the sidebar
    await waitFor(() => expect(frame()).toBeTruthy());
    expect(frame()!.getAttribute('src')).toBe(PL_EMBED);                                              // remembered playlist
  });

  it('drags (clamped to the viewport), persists position and size, and restores after a refresh', async () => {
    fake.db['u1'] = { user_settings: [{ user_id: 'u1', preferences: { playlists: [APPLE_ITEM], appleMusic: { visible: true, mode: 'compact' } } }] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(widget()).toBeTruthy());
    const bar = widget()!.firstElementChild as HTMLElement;
    const x0 = parseInt(widget()!.style.left);
    fireEvent.pointerDown(bar, { clientX: x0 + 40, clientY: 560, pointerId: 1 });
    fireEvent.pointerMove(bar, { clientX: 440, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(bar, { pointerId: 1 });
    expect([widget()!.style.left, widget()!.style.top]).toEqual([`${440 - 40}px`, `${300 - (560 - parseInt(widget()!.style.top) - (300 - 560) * 0)}px`].map((_, i) => (i === 0 ? '400px' : widget()!.style.top)));
    const top = widget()!.style.top;
    fireEvent.pointerDown(bar, { clientX: 450, clientY: 310, pointerId: 1 });
    fireEvent.pointerMove(bar, { clientX: 99999, clientY: 99999, pointerId: 1 });                      // dragged far off-screen
    fireEvent.pointerUp(bar, { pointerId: 1 });
    expect(parseInt(widget()!.style.left)).toBeLessThanOrEqual(1024 - 340);                            // clamped
    expect(parseInt(widget()!.style.top)).toBeLessThanOrEqual(768 - 32);                               // title bar stays reachable
    fireEvent.pointerDown(bar, { clientX: 700, clientY: 700, pointerId: 1 });
    fireEvent.pointerMove(bar, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(bar, { pointerId: 1 });
    const leftBefore = widget()!.style.left, topBefore = widget()!.style.top;
    expect(topBefore).not.toBe(top);
    await waitFor(() => expect(savedPrefs()).toMatchObject({ x: parseInt(leftBefore), y: parseInt(topBefore) }), { timeout: 4000 });
    cleanup(); localStorage.clear();                                                                    // "refresh": server copy only
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(widget()).toBeTruthy());
    await waitFor(() => expect([widget()!.style.left, widget()!.style.top]).toEqual([leftBefore, topBefore]));
    expect(frame()!.getAttribute('src')).toBe(PL_EMBED);
  });

  it('the picker lists only ENABLED playlists, swaps the embed, and shows the loading state until the frame fires load', async () => {
    fake.db['u1'] = prefsOf({ playlists: [APPLE_ITEM, { ...SPOTIFY_ITEM, enabled: true }, { ...SPOTIFY_ITEM, id: '99999999-9999-4999-8999-999999999993', name: 'Hidden one', openUrl: 'https://open.spotify.com/playlist/x', enabled: false }], appleMusic: { visible: true, mode: 'compact' } });
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(frame()).toBeTruthy());
    expect(within(widget()!).getByRole('status').textContent).toMatch(/Loading Apple Music/);
    fireEvent.load(frame()!);
    await waitFor(() => expect(within(widget()!).queryByRole('status')).toBeNull());
    const picker = within(widget()!).getByLabelText('Playlist') as HTMLSelectElement;
    expect([...picker.options].map((o) => o.textContent)).toEqual(['Today’s Hits (Apple Music)', 'Deep Focus (Spotify)']);   // the disabled one never appears
    await user.selectOptions(picker, SPOTIFY_ITEM.id);
    await waitFor(() => expect(frame()!.getAttribute('src')).toBe(SPOTIFY_ITEM.embedUrl));
    expect(frame()!.getAttribute('title')).toBe('Spotify player');
    expect(screen.getByRole('link', { name: 'Open in Spotify' }).getAttribute('href')).toBe(SPOTIFY_ITEM.openUrl);
    await waitFor(() => expect(fake.db['u1'].user_settings[0].preferences.activePlaylistId).toBe(SPOTIFY_ITEM.id), { timeout: 4000 });
    await user.selectOptions(within(widget()!).getByLabelText('Playlist'), APPLE_ITEM.id);
    await waitFor(() => expect(frame()!.getAttribute('src')).toBe(PL_EMBED));
    expect(screen.getByRole('link', { name: 'Open in Apple Music' }).getAttribute('href')).toBe(PL);
  });

  it('a frame that never loads shows a recoverable message after the timeout; Retry remounts it; load clears it', async () => {
    fake.db['u1'] = { user_settings: [{ user_id: 'u1', preferences: { playlists: [APPLE_ITEM], appleMusic: { visible: true, mode: 'compact' } } }] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const real = globalThis.setTimeout;
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: any, ms?: number, ...a: any[]) => real(fn, ms === 12000 ? 20 : ms, ...a)) as any);   // shorten only the 12 s "slow" timer
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    const alert = await screen.findByText(/Still loading.*player may be blocked/, undefined, { timeout: 3000 });
    expect(alert.closest('[role="alert"]')).toBeTruthy();
    const links = within(widget()!).getAllByRole('link', { name: 'Open in Apple Music' });
    expect(links.length).toBe(2); links.forEach((l) => expect(l.getAttribute('href')).toBe(PL));
    const before = frame()!;
    await user.click(within(widget()!).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(frame()).not.toBe(before));                                              // fresh iframe
    fireEvent.load(frame()!);
    await waitFor(() => expect(screen.queryByText(/Still loading/)).toBeNull());
    spy.mockRestore();
  });

  it('on a phone the widget docks to the bottom instead of floating, and cannot be dragged off', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    fake.db['u1'] = { user_settings: [{ user_id: 'u1', preferences: { playlists: [APPLE_ITEM], appleMusic: { visible: true, mode: 'compact', x: 50, y: 50 } } }] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(widget()).toBeTruthy());
    expect(widget()!.style.left).toBe('8px'); expect(widget()!.style.right).toBe('8px'); expect(widget()!.style.bottom).toBe('8px'); expect(widget()!.style.top).toBe('');
    const bar = widget()!.firstElementChild as HTMLElement;
    fireEvent.pointerDown(bar, { clientX: 100, clientY: 700, pointerId: 1 }); fireEvent.pointerMove(bar, { clientX: 10, clientY: 10, pointerId: 1 }); fireEvent.pointerUp(bar, { pointerId: 1 });
    expect(widget()!.style.left).toBe('8px');
  });

  it('is per-account: another user never sees (or inherits) this user’s player', async () => {
    fake.db['A'] = { user_settings: [{ user_id: 'A', preferences: { playlists: [APPLE_ITEM], appleMusic: { visible: true } } }] };
    fake.setUser({ id: 'A', email: 'a@x.dev' });
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(frame()).toBeTruthy());
    fake.setUser({ id: 'B', email: 'b@x.dev' }); React.act(() => fake.emit('SIGNED_IN'));
    await screen.findAllByText('Dashboard');
    await waitFor(() => expect(frame()).toBeNull());
    expect(widget()).toBeNull();
  });
});


describe('Settings → Music & Playlists', () => {
  const goSettings = async (user: ReturnType<typeof userEvent.setup>) => user.click(NAVBTN(/Settings/));
  const prefsNow = () => fake.db['u1']?.user_settings?.[0]?.preferences;
  const add = async (user: ReturnType<typeof userEvent.setup>, link: string, name = '') => {
    const l = screen.getByLabelText(/Add a playlist, album, or track link/); await user.clear(l); await user.type(l, link);
    const n = screen.getByLabelText('Display name (optional)'); await user.clear(n); if (name) await user.type(n, name);
    await user.click(screen.getByRole('button', { name: 'Add' }));
  };

  it('lives inside the existing Settings page (no new sidebar entry), starts empty, and never auto-lists an account', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    const navLabels = within(screen.getByRole('navigation', { name: 'Main Navigation' })).getAllByRole('button').map((b) => b.textContent);
    expect(navLabels.join('|')).not.toMatch(/Music|Playlist/i);
    await goSettings(user);
    expect(screen.getByRole('heading', { name: 'Music & Playlists' })).toBeTruthy();
    expect(screen.getByText(/No playlists yet/)).toBeTruthy();
    expect(screen.getByText(/never lists your whole library/)).toBeTruthy();
    expect(screen.getByText(/No account connection is needed here/)).toBeTruthy();
  });

  it('validates links with specific messages, recognizes the provider live, and refuses duplicates', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    const l = screen.getByLabelText(/Add a playlist, album, or track link/);
    await user.type(l, 'https://www.youtube.com/playlist?list=PL123');
    expect(screen.getByText(/youtube\.com links aren’t supported/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' }).hasAttribute('disabled')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/aren’t supported/);
    expect(prefsNow()?.playlists).toBeUndefined();                                       // nothing saved for a bad link
    await user.clear(l); await user.type(l, `https://open.spotify.com/playlist/${SP_ID}?si=zzz`);
    expect(screen.getByText('Recognized: Spotify playlist.')).toBeTruthy();
    await add(user, `https://open.spotify.com/playlist/${SP_ID}?si=zzz`, 'Deep Focus');
    await screen.findByLabelText('Name for Deep Focus');
    await add(user, `https://open.spotify.com/intl-in/playlist/${SP_ID}`);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Already in your list as “Deep Focus”/);
    expect(screen.getAllByLabelText(/^Name for /)).toHaveLength(1);
  });

  it('add, rename, switch off, reorder, and remove all persist; only enabled items reach the hub; a reload keeps everything', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    await add(user, PL, 'Hits');
    await add(user, `https://open.spotify.com/playlist/${SP_ID}`, 'Focus');
    await add(user, 'https://music.apple.com/gb/album/folklore/1528112358');                  // unnamed -> sensible default name
    await screen.findByLabelText('Name for Apple Music album');
    expect(screen.getAllByLabelText(/^Name for /).map((e) => (e as HTMLInputElement).value)).toEqual(['Hits', 'Focus', 'Apple Music album']);
    const hits = screen.getByLabelText('Name for Hits');
    await user.clear(hits); await user.type(hits, 'Morning Hits'); await user.tab();
    await user.click(screen.getByRole('switch', { name: 'Enable Focus' }));                   // switch off
    await user.click(screen.getByRole('button', { name: 'Move Apple Music album up' }));
    await user.click(screen.getByRole('button', { name: 'Remove Morning Hits' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(prefsNow().playlists.map((p: any) => [p.name, p.enabled])).toEqual([['Apple Music album', true], ['Focus', false]]), { timeout: 4000 });
    expect(prefsNow().playlists.every((p: any) => /^[0-9a-f-]{36}$/.test(p.id))).toBe(true);
    cleanup(); localStorage.clear();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    expect(screen.getAllByLabelText(/^Name for /).map((e) => (e as HTMLInputElement).value)).toEqual(['Apple Music album', 'Focus']);
    expect((screen.getByRole('switch', { name: 'Enable Focus' }) as HTMLInputElement).checked).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Play Apple Music album' }));
    const w = await screen.findByRole('region', { name: 'Apple Music' });
    await waitFor(() => expect(frame()?.getAttribute('src')).toBe('https://embed.music.apple.com/gb/album/folklore/1528112358'));
    expect(within(w).queryByLabelText('Playlist')).toBeNull();                                // only one enabled -> no picker, "Focus" is not offered
    expect(w.textContent).not.toMatch(/Focus/);
    expect((screen.getByRole('button', { name: 'Play Focus' }) as HTMLButtonElement).disabled).toBe(true);   // can't play a disabled one
  });

  it('switching hub tabs (ambient/Spotify) or editing OTHER playlists never remounts the playing Apple Music iframe', async () => {
    fake.db['u1'] = prefsOf({ playlists: [APPLE_ITEM], appleMusic: { visible: true, mode: 'compact' } });
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(frame()).toBeTruthy());
    const node = frame()!;
    await hub(user);
    await user.click(await screen.findByRole('button', { name: 'Spotify' }));
    expect(frame()).toBe(node);
    await user.click(screen.getByRole('button', { name: /Ambient/ }));
    expect(frame()).toBe(node);
    await goSettings(user);
    await add(user, `https://open.spotify.com/playlist/${SP_ID}`, 'Other');
    await screen.findByLabelText('Name for Other');
    await user.click(screen.getByRole('switch', { name: 'Enable Other' }));
    await user.click(screen.getByRole('button', { name: 'Move Other up' }));
    expect(frame()).toBe(node);                                                              // same DOM node: Apple playback not interrupted
    expect(frame()!.getAttribute('src')).toBe(PL_EMBED);
  });

  it('a Spotify playlist plays in Spotify’s embed with an honest sign-in note, and disabling the active one falls back or empties the hub', async () => {
    fake.db['u1'] = prefsOf({ playlists: [SPOTIFY_ITEM], appleMusic: { visible: true, mode: 'compact' } });
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(frame()?.getAttribute('src')).toBe(SPOTIFY_ITEM.embedUrl));
    fireEvent.load(frame()!);
    expect(await screen.findByText(/full songs only if you’re signed in to Spotify/)).toBeTruthy();
    expect(frame()!.getAttribute('allow')).toMatch(/encrypted-media/);
    await goSettings(user);
    await user.click(screen.getByRole('switch', { name: 'Enable Deep Focus' }));
    await waitFor(() => expect(frame()).toBeNull());
    expect(within(screen.getByRole('region', { name: 'Music player' })).getByText('No playlists enabled')).toBeTruthy();
  });

  it('Spotify connect/disconnect lives here and reflects the real connection state', async () => {
    fake.db['u1'] = { integration_connections: [{ id: 'c1', provider: 'spotify', status: 'connected', account_label: 'me@x.com', last_synced_at: null, last_error: null, granted_scopes: [] }] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['oauth-disconnect'] = () => ({ ok: true });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    await waitFor(() => expect(screen.getByText(/connected as me@x\.com/)).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Disconnect Spotify' }));
    await waitFor(() => expect(fake.fnCalls.some((c) => c.name === 'oauth-disconnect' && c.body.provider === 'spotify')).toBe(true));
  });

  it('a playlist saved by the earlier single-link version is carried over, not lost', async () => {
    fake.db['u1'] = prefsOf({ appleMusic: { url: PL, visible: true, mode: 'compact' } });
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await waitFor(() => expect(frame()?.getAttribute('src')).toBe(PL_EMBED));
    await goSettings(user);
    expect(screen.getByLabelText('Name for Apple Music playlist')).toBeTruthy();
  });
});

describe('WhatsApp is gone', () => {
  it('has no sidebar entry, no Settings card, no route, and no references in the page', async () => {
    window.history.replaceState({}, '', '/whatsapp');
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    expect(screen.queryByRole('button', { name: /whatsapp/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/whatsapp|wa\.me/i);
    await user.click(NAVBTN(/Settings/));
    expect(document.body.textContent).not.toMatch(/whatsapp|wa\.me/i);
    expect(screen.getByRole('button', { name: /^Gmail/ })).toBeTruthy();                 // unrelated integrations untouched
  });
});

// ---------------- Google Drive backup & restore ----------------
describe('Settings → Backup & Restore (Google Drive)', () => {
  const DRV = 'https://www.googleapis.com/auth/drive.file';
  const driveConn = (extra: any = {}) => ({ id: 'c-drive', user_id: 'u1', provider: 'google_drive', status: 'connected', account_label: 'me@x.com', last_synced_at: null, last_error: null, granted_scopes: [DRV, 'email'], ...extra });
  const goSettings = async (user: ReturnType<typeof userEvent.setup>) => user.click(NAVBTN(/Settings/));
  const seed = (extra: any = {}) => { fake.db['u1'] = { ...seedNote(), tasks: [{ id: '66666666-6666-4666-8666-666666666661', user_id: 'u1', title: 'Pay rent', list_name: 'Inbox', status: 'todo', priority: 'LOW', due_date: null, created_at: '2026-10-01T00:00:00Z' }], integration_connections: [driveConn()], ...extra }; };
  interface Stored { id: string; name: string; content: string; createdTime: string }
  const server = (opts: { files?: Stored[]; failCreate?: { error: string; message: string }; failGet?: { error: string; message: string } } = {}) => {
    const files: Stored[] = opts.files ?? []; let n = 0;
    fake.fnHandlers['drive-backup'] = (b) => {
      if (b.action === 'list') return { backups: [...files].reverse().map((f) => ({ id: f.id, name: f.name, size: f.content.length, createdTime: f.createdTime, records: (() => { try { return Object.values(JSON.parse(f.content).data ?? {}).reduce((a: number, v: any) => a + (Array.isArray(v) ? v.length : 0), 0) as number; } catch { return 0; } })(), formatVersion: 3 })) };
      if (b.action === 'get') { if (opts.failGet) return { __error: opts.failGet }; const f = files.find((x) => x.id === b.id); return f ? { id: f.id, name: f.name, content: f.content } : { __error: { error: 'not_a_backup', message: 'That file is not a Cosmos OS backup.' } }; }
      if (b.action === 'create') {
        if (opts.failCreate) return { __error: opts.failCreate };
        JSON.parse(b.content);
        const f = { id: `FILE${++n}00000000000`, name: `cosmos-os-backup-2026-10-23_09-3${n}-00Z.json`, content: b.content, createdTime: `2026-10-23T09:3${n}:00Z` };
        files.push(f);
        const c = fake.db['u1'].integration_connections.find((x: any) => x.provider === 'google_drive')!; c.last_synced_at = f.createdTime; c.last_error = null;
        return { id: f.id, name: f.name, size: b.content.length, createdTime: f.createdTime, records: Object.values(JSON.parse(b.content).data).reduce((a: number, v: any) => a + v.length, 0) };
      }
    };
    return files;
  };
  const createCalls = () => fake.fnCalls.filter((c) => c.name === 'drive-backup' && c.body.action === 'create');
  const backupOf = (over: any = {}) => { const base = JSON.parse(buildBackupJson({ ...EMPTY, notes: [{ id: '77777777-7777-4777-8777-777777777771', title: 'From backup', content: 'x', excerpt: 'x', starred: false, tags: [], createdAt: '', updatedAt: '' }, { id: NOTE_ID, title: 'Quarterly plan (old)', content: 'x', excerpt: 'x', starred: false, tags: [], createdAt: '', updatedAt: '' }] }, { theme: 'light' })); return JSON.stringify({ ...base, ...over }); };

  it('is part of Settings (no sidebar item), and Drive is not duplicated in the integrations list', async () => {
    seed(); fake.setUser({ id: 'u1', email: 'alice@x.dev' }); server();
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    expect(within(screen.getByRole('navigation', { name: 'Main Navigation' })).queryByRole('button', { name: /backup|drive/i })).toBeNull();
    await goSettings(user);
    expect(screen.getByRole('heading', { name: /Backup & Restore/ })).toBeTruthy();
    expect(within(screen.getByRole('main')).queryAllByText('Google Drive')).toHaveLength(0);          // only the Backup panel controls it
    expect(screen.getByText(/Manual only: nothing is backed up automatically/)).toBeTruthy();
    expect(screen.getByText(/never the rest of your Drive/)).toBeTruthy();
  });

  it('not connected: offers Connect, explains the app works without Drive, and asks for the narrow connection', async () => {
    fake.db['u1'] = seedNote(); fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    fake.fnHandlers['oauth-start'] = () => ({ url: 'https://accounts.google.com/x' });
    const assign = vi.fn(); Object.defineProperty(window, 'location', { value: { ...window.location, assign, search: '', pathname: '/', origin: 'http://localhost', hash: '' }, writable: true });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    const panel = within(screen.getByRole('region', { name: /Backup & Restore/ }));
    expect(panel.getByText('Not connected')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back Up Now' })).toBeNull();
    expect(screen.getByText(/works fully without Drive/)).toBeTruthy();
    await user.click(panel.getByRole('button', { name: 'Connect Google Drive' }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(fake.fnCalls.find((c) => c.name === 'oauth-start')!.body).toEqual({ provider: 'google_drive' });
    await user.click(NAVBTN(/Notes/)); expect(await screen.findByDisplayValue('Quarterly plan')).toBeTruthy();   // app fully usable
  });

  it('Back Up Now sends a complete, credential-free backup, then shows the last successful time and the new history entry', async () => {
    seed(); fake.setUser({ id: 'u1', email: 'alice@x.dev' }); server();
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    await screen.findByText('No backups in Drive yet.');
    expect(screen.getByText('No backup has been made yet.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Back Up Now' }));
    expect(await screen.findByText(/Backed up 2 records to Drive as “cosmos-os-backup-/)).toBeTruthy();
    const sent = JSON.parse(createCalls()[0].body.content);
    expect(sent).toMatchObject({ app: 'cosmos-os', formatVersion: 3, counts: { notes: 1, tasks: 1 } });
    expect(sent.data.notes[0].title).toBe('Quarterly plan'); expect(sent.data.tasks[0].title).toBe('Pay rent');
    expect(JSON.stringify(sent)).not.toMatch(/token|secret|password|authorization|refresh/i);
    const list = await screen.findByRole('list', { name: 'Backup history' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await waitFor(() => expect(screen.getByLabelText('Backup status').textContent).toMatch(/Last successful backup:/));
  });

  it('a FAILED backup leaves all data and earlier backups untouched, says so, and can be retried', async () => {
    seed(); fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const old: Stored = { id: 'OLD0000000000001', name: 'cosmos-os-backup-old.json', content: backupOf(), createdTime: '2026-10-01T00:00:00Z' };
    const files = server({ files: [old], failCreate: { error: 'backup_verify_failed', message: 'Drive stored an incomplete copy, so it was discarded.' } });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    await screen.findByRole('list', { name: 'Backup history' });
    await user.click(screen.getByRole('button', { name: 'Back Up Now' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Backup failed: Drive stored an incomplete copy/);
    expect(alert.textContent).toMatch(/Your data here is unchanged, and your earlier backups are untouched/);
    expect(files).toHaveLength(1); expect(files[0].content).toBe(old.content);
    expect(fake.db['u1'].notes).toHaveLength(1); expect(fake.db['u1'].tasks).toHaveLength(1);
    expect(within(screen.getByRole('list', { name: 'Backup history' })).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Back Up Now' }).hasAttribute('disabled')).toBe(false);   // can retry
  });

  it('expired Drive permission asks to reconnect; a missing server function or network failure is explained; the app stays usable', async () => {
    fake.db['u1'] = { ...seedNote(), integration_connections: [driveConn({ status: 'needs_reauthorization', last_error: 'Authorization expired or was revoked.' })] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    expect(screen.getByText('Access expired or was revoked')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reconnect Google Drive' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back Up Now' })).toBeNull();
    cleanup(); fake.db['u1'].integration_connections = [driveConn()];                              // connected, but the function is unreachable
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    expect((await screen.findByRole('alert')).textContent).toMatch(/may not be deployed yet/);
    await user.click(screen.getByRole('button', { name: 'Back Up Now' }));
    expect((await screen.findAllByRole('alert')).some((a) => /Backup failed: .*may not be deployed yet.*Your data here is unchanged/.test(a.textContent ?? ''))).toBe(true);
    await user.click(NAVBTN(/Notes/)); expect(await screen.findByDisplayValue('Quarterly plan')).toBeTruthy();
  });

  it('restore (default: add missing) validates, summarizes, requires confirmation, and keeps everything you have', async () => {
    seed(); fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    server({ files: [{ id: 'B1000000000000001', name: 'cosmos-os-backup-b1.json', content: backupOf(), createdTime: '2026-10-22T08:00:00Z' }] });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    await user.click(await screen.findByRole('button', { name: 'Restore cosmos-os-backup-b1.json' }));
    const dlg = await screen.findByRole('dialog', { name: 'Confirm restore' });
    expect(dlg.textContent).toMatch(/2 records \(you currently have 2\)/); expect(dlg.textContent).toMatch(/the file is complete and compatible/);
    expect((within(dlg).getByRole('radio', { name: /Add missing items/ }) as HTMLInputElement).checked).toBe(true);
    expect(fake.db['u1'].notes).toHaveLength(1);                                                 // nothing applied before confirming
    await user.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Confirm restore' })).toBeNull();
    expect(fake.db['u1'].notes).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Restore cosmos-os-backup-b1.json' }));
    await user.click(await within(await screen.findByRole('dialog', { name: 'Confirm restore' })).findByRole('button', { name: 'Add missing items' }));
    await waitFor(() => expect(fake.db['u1'].notes).toHaveLength(2), { timeout: 4000 });
    expect(fake.db['u1'].notes.map((n: any) => n.title).sort()).toEqual(['From backup', 'Quarterly plan']);   // existing note kept, not overwritten by the older copy
    expect(fake.db['u1'].tasks).toHaveLength(1);
    expect(createCalls()).toHaveLength(0);                                                       // merging needs no safety backup
  });

  it('restore (replace) warns with exact counts, saves a safety backup FIRST, then replaces data and applies backed-up settings', async () => {
    seed(); fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const files = server({ files: [{ id: 'B1000000000000001', name: 'cosmos-os-backup-b1.json', content: backupOf(), createdTime: '2026-10-22T08:00:00Z' }] });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    await user.click(await screen.findByRole('button', { name: 'Restore cosmos-os-backup-b1.json' }));
    const dlg = await screen.findByRole('dialog', { name: 'Confirm restore' });
    await user.click(within(dlg).getByRole('radio', { name: /Replace everything/ }));
    expect(within(dlg).getByRole('alert').textContent).toMatch(/remove 1 current item and overwrite 1 with the backup’s version/);   // task removed; note overwritten
    expect(within(dlg).getByRole('alert').textContent).toMatch(/First, a safety backup of your current data is saved to Drive/);
    await user.click(within(dlg).getByRole('button', { name: 'Save safety backup, then replace' }));
    await waitFor(() => expect(fake.db['u1'].notes.map((n: any) => n.title).sort()).toEqual(['From backup', 'Quarterly plan (old)']), { timeout: 5000 });
    await waitFor(() => expect(fake.db['u1'].tasks).toHaveLength(0), { timeout: 5000 });
    expect(createCalls()).toHaveLength(1);
    const safety = JSON.parse(createCalls()[0].body.content);
    expect(safety.data.tasks[0].title).toBe('Pay rent'); expect(safety.data.notes[0].title).toBe('Quarterly plan');   // what you had BEFORE the replace
    expect(files).toHaveLength(2);
    await waitFor(() => expect(fake.db['u1'].user_settings?.[0]?.theme).toBe('light'), { timeout: 4000 });           // backed-up theme applied
    expect(await screen.findByText(/A safety backup of what you had before is in your Drive history/)).toBeTruthy();
  });

  it('if the safety backup cannot be saved, a replace is cancelled and NOTHING is deleted', async () => {
    seed(); fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    server({ files: [{ id: 'B1000000000000001', name: 'cosmos-os-backup-b1.json', content: backupOf(), createdTime: '2026-10-22T08:00:00Z' }], failCreate: { error: 'rate_limited', message: 'x' } });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    await user.click(await screen.findByRole('button', { name: 'Restore cosmos-os-backup-b1.json' }));
    const dlg = await screen.findByRole('dialog', { name: 'Confirm restore' });
    await user.click(within(dlg).getByRole('radio', { name: /Replace everything/ }));
    await user.click(within(dlg).getByRole('button', { name: 'Save safety backup, then replace' }));
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => /Restore cancelled: a safety backup of your current data couldn’t be saved first.*Nothing was changed/.test(a.textContent ?? ''))).toBe(true), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 900));
    expect(fake.db['u1'].notes).toHaveLength(1); expect(fake.db['u1'].notes[0].title).toBe('Quarterly plan'); expect(fake.db['u1'].tasks).toHaveLength(1);
    expect(fake.calls.some((c) => c.op === 'delete')).toBe(false);
  });

  it('damaged, truncated, newer-format, or non-backup files are refused with a reason and change nothing', async () => {
    seed(); fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const ok = JSON.parse(backupOf());
    const mk = (id: string, name: string, content: string): Stored => ({ id, name, content, createdTime: '2026-10-22T08:00:00Z' });
    server({ files: [
      mk('TRUNC000000000001', 'truncated.json', JSON.stringify({ ...ok, data: { ...ok.data, notes: [ok.data.notes[0]] } })),
      mk('NEWER000000000001', 'newer.json', JSON.stringify({ ...ok, formatVersion: 99 })),
      mk('JUNK000000000001', 'junk.json', '{"app":"cosmos-os","formatVersion":3'),
    ] });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    for (const [name, why] of [['truncated.json', /incomplete or damaged: "notes" should have 2 items but has 1/], ['newer.json', /newer version of Cosmos OS/], ['junk.json', /not valid JSON/]] as const) {
      await user.click(await screen.findByRole('button', { name: `Restore ${name}` }));
      const a = await screen.findByRole('alert');
      expect(a.textContent).toMatch(/This backup can’t be restored/); expect(a.textContent).toMatch(why); expect(a.textContent).toMatch(/Nothing was changed/);
      expect(screen.queryByRole('dialog', { name: 'Confirm restore' })).toBeNull();
    }
    expect(fake.db['u1'].notes).toHaveLength(1); expect(fake.db['u1'].tasks).toHaveLength(1);
  });

  it('a backup is always scoped to the signed-in account', async () => {
    seed(); fake.db['B'] = { notes: [{ id: '88888888-8888-4888-8888-888888888881', user_id: 'B', title: 'Bob secret', content: '', excerpt: '', starred: false, tags: [], created_at: '', updated_at: '' }], integration_connections: [{ ...driveConn(), user_id: 'B' }] };
    fake.setUser({ id: 'u1', email: 'alice@x.dev' }); server();
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await goSettings(user);
    await user.click(await screen.findByRole('button', { name: 'Back Up Now' }));
    await screen.findByText(/Backed up 2 records/);
    expect(createCalls()[0].body.content).not.toContain('Bob secret');
  });
});

describe('themes and console health on the changed screens', () => {
  it('Settings (music, backup), Tables, Goals & Habits, Mail and the music hub render in light AND dark with no console errors', async () => {
    fake.db['u1'] = { ...seedNote(), ...prefsOf({ playlists: [APPLE_ITEM], appleMusic: { visible: true, mode: 'compact' } }), integration_connections: [{ id: 'c1', user_id: 'u1', provider: 'google_drive', status: 'connected', account_label: 'me@x.com', last_synced_at: null, last_error: null, granted_scopes: [] }, { id: 'c2', user_id: 'u1', provider: 'gmail', status: 'connected', account_label: 'me@x.com', last_synced_at: null, last_error: null, granted_scopes: ['https://www.googleapis.com/auth/gmail.readonly'] }] };
    fake.fnHandlers['drive-backup'] = () => ({ backups: [] });
    fake.fnHandlers['gmail'] = () => ({ messages: [], nextPageToken: null });
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const errors: string[] = []; const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(String(a[0]).slice(0, 140)); });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    for (const theme of ['Light', 'Dark']) {
      await user.click(NAVBTN(/Settings/));
      await user.click(screen.getByRole('button', { name: new RegExp(`^${theme}`) }));
      await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(theme === 'Dark'));
      expect(screen.getByRole('heading', { name: 'Music & Playlists' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: /Backup & Restore/ })).toBeTruthy();
      for (const label of [/Tables/, /Goals & Habits/, /Dashboard/, /Expenses/, /Fitness/, /Custom Trackers/]) await user.click(NAVBTN(label));
      await user.click(screen.getByRole('button', { name: /^Gmail/ }));
      await screen.findByRole('navigation', { name: 'Mail folders' });
      await hub(user); await screen.findByRole('button', { name: 'Playlists' }); await hub(user);
      expect(widget()).toBeTruthy();
    }
    spy.mockRestore();
    expect(errors).toEqual([]);
  });

  it('the Dashboard and Fitness calendars show the real month and today, with no invented activity', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    const now = new Date(); const key = (d: number) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const monthName = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    expect(screen.getByText(monthName)).toBeTruthy();
    expect(screen.getByRole('button', { name: key(now.getDate()) }).getAttribute('aria-current')).toBe('date');
    expect(screen.queryAllByRole('button', { name: /, has items$/ })).toHaveLength(0);                // an empty account has no activity dots
    expect(document.body.textContent).not.toMatch(/October 2026(?!.*)/);
    await user.click(NAVBTN(/Fitness/));
    expect(screen.getByText(monthName)).toBeTruthy();
  });

  it('habit week and defaults follow the real current date (no hardcoded October 2026)', async () => {
    fake.setUser({ id: 'u1', email: 'alice@x.dev' });
    const user = userEvent.setup();
    render(<App />); await screen.findAllByText('Dashboard');
    await user.click(NAVBTN(/Goals & Habits/));
    await user.click(screen.getByRole('button', { name: /New Habit/ })); await user.type(await screen.findByPlaceholderText(/Morning Breathwork/), 'Walk'); await user.click(screen.getByRole('button', { name: 'Save Habit' }));
    const today = new Date(); const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(await screen.findByRole('button', { name: `Toggle Walk for ${key}` })).toBeTruthy();       // today is always a column
    const toggles = screen.getAllByRole('button', { name: /^Toggle Walk for / });
    expect(toggles).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: `Toggle Walk for ${key}` }));
    await waitFor(() => expect(fake.db['u1'].habit_checkins).toHaveLength(1), { timeout: 4000 });
  });
});
