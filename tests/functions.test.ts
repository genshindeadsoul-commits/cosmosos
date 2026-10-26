import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptJson, decryptJson, sha256Hex } from '../supabase/functions/api/_shared/crypto.ts';
import * as H from '../supabase/functions/api/_shared/handlers.ts';
import { extractBody, normalizeGoogleEvent, validateHealthPayload } from '../supabase/functions/api/_shared/parse.ts';
import { gmailAction, buildRawMessage, parseRecipients } from '../supabase/functions/api/_shared/gmailApi.ts';
import { driveAction, FOLDER_NAME } from '../supabase/functions/api/_shared/driveApi.ts';
import { HttpError, type Ctx, type DbPort, type ConnPatch } from '../supabase/functions/api/_shared/ports.ts';

const KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
const ENV = { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec', SPOTIFY_CLIENT_ID: 'sid', SPOTIFY_CLIENT_SECRET: 'ssec',
  TOKEN_ENCRYPTION_KEY: KEY, SUPABASE_URL: 'https://x.supabase.co', APP_URL: 'https://app.example' };

function memDb() {
  const states = new Map<string, any>(), conns = new Map<string, any>(), secrets = new Map<string, string>(), tokens = new Map<string, any>(), workouts: any[] = [];
  let n = 0;
  const db: DbPort = {
    async insertState(state, userId, provider) { states.set(state, { userId, provider, exp: Date.now() + 600000 }); },
    async consumeState(s) { const r = states.get(s); states.delete(s); return !r || r.exp < Date.now() ? null : { userId: r.userId, provider: r.provider }; },
    async getConnection(u, p) { const c = conns.get(`${u}|${p}`); return c ? { id: c.id, status: c.status, granted_scopes: c.granted_scopes ?? [] } : null; },
    async saveConnection(u, p, patch: ConnPatch) { const k = `${u}|${p}`; const c = conns.get(k) ?? { id: `c${++n}`, status: 'not_connected' }; conns.set(k, { ...c, ...patch }); return c.id; },
    async getSecret(id) { return secrets.get(id) ?? null; }, async saveSecret(id, e) { secrets.set(id, e); }, async deleteSecret(id) { secrets.delete(id); },
    async findIngestToken(h) { return tokens.get(h) ?? null; }, async touchIngestToken() {},
    async existingExternalIds(u, ids) { return new Set(workouts.filter((w) => w.user_id === u && ids.includes(w.external_id)).map((w) => w.external_id)); },
    async insertWorkouts(u, rows) { rows.forEach((r) => workouts.push({ ...r, user_id: u })); return rows.length; },
  };
  return { db, states, conns, secrets, tokens, workouts };
}
type Route = (url: string, init?: RequestInit) => { status?: number; body: unknown } | undefined;
function mkCtx(routes: Route, mem = memDb(), env: Record<string, string | undefined> = ENV) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url); calls.push({ url: u, init });
    const r = routes(u, init) ?? { status: 404, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as typeof fetch;
  const ctx: Ctx = { env, db: mem.db, fetch: f, now: () => new Date('2026-10-20T12:00:00Z') };
  return { ctx, mem, calls };
}
const connect = async (mem: ReturnType<typeof memDb>, user: string, provider: any, status: any = 'connected', rt = 'RT-secret', scopes: string[] = []) => {
  const id = await mem.db.saveConnection(user, provider, { status, granted_scopes: scopes });
  await mem.db.saveSecret(id, await encryptJson({ refresh_token: rt }, KEY));
};
const refreshOk: Route = (u) => (u.includes('oauth2.googleapis.com/token') ? { body: { access_token: 'AT', expires_in: 3600 } } : undefined);
const fails = async (p: Promise<unknown>, status: number, code?: string) => {
  await assert.rejects(p, (e: any) => e instanceof HttpError && e.status === status && (!code || e.code === code));
};

// ---------- crypto ----------
test('crypto: roundtrip, random IV, tamper and wrong-key detection', async () => {
  const a = await encryptJson({ refresh_token: 'abc' }, KEY), b = await encryptJson({ refresh_token: 'abc' }, KEY);
  assert.notEqual(a, b);
  assert.deepEqual(await decryptJson(a, KEY), { refresh_token: 'abc' });
  assert.ok(!a.includes('abc'));
  const parts = a.split('.'); parts[2] = parts[2].slice(0, -4) + (parts[2].endsWith('AAAA') ? 'BBBB' : 'AAAA');
  await assert.rejects(decryptJson(parts.join('.'), KEY));
  await assert.rejects(decryptJson(a, Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')));
  await assert.rejects(encryptJson({}, Buffer.from('short').toString('base64')));
});

// ---------- oauth start ----------
test('oauth start: 501 when server secrets are missing, 400 for unknown provider, state+scopes in URL otherwise', async () => {
  const { ctx } = mkCtx(() => undefined, memDb(), { ...ENV, GOOGLE_CLIENT_SECRET: undefined });
  await fails(H.startOAuth('u1', { provider: 'gmail' }, ctx), 501, 'not_configured');
  const ok = mkCtx(() => undefined);
  await fails(H.startOAuth('u1', { provider: 'myspace' }, ok.ctx), 400);
  const { url } = await H.startOAuth('u1', { provider: 'gmail' }, ok.ctx);
  const u = new URL(url);
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.readonly email');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://x.supabase.co/functions/v1/api/oauth-callback');
  assert.ok(ok.mem.states.has(u.searchParams.get('state')!));
  assert.ok(!url.includes('gsec'), 'client secret must never be in the browser URL');
});

// ---------- oauth callback ----------
const gmailRoutes = (verifyStatus = 200, scope = 'https://www.googleapis.com/auth/gmail.readonly email'): Route => (u) => {
  if (u.includes('oauth2.googleapis.com/token')) return { body: { access_token: 'AT', refresh_token: 'RT-secret', scope } };
  if (u.includes('/gmail/v1/users/me/profile')) return { status: verifyStatus, body: { emailAddress: 'me@gmail.com' } };
};
test('callback: connected only after the verification API call succeeds; token stored encrypted and never in the redirect', async () => {
  const { ctx, mem, calls } = mkCtx(gmailRoutes());
  const { url } = await H.startOAuth('u1', { provider: 'gmail' }, ctx);
  const state = new URL(url).searchParams.get('state')!;
  const to = await H.finishOAuth({ code: 'c', state }, ctx);
  assert.match(to, /result=connected/);
  assert.ok(!to.includes('RT-secret') && !to.includes('AT'));
  assert.equal(mem.conns.get('u1|gmail').status, 'connected');
  assert.equal(mem.conns.get('u1|gmail').account_label, 'me@gmail.com');
  const stored = [...mem.secrets.values()][0];
  assert.ok(!stored.includes('RT-secret'));
  assert.deepEqual(await decryptJson(stored, KEY), { refresh_token: 'RT-secret' });
  assert.ok(calls.some((c) => c.url.includes('/users/me/profile')), 'a real API verification call was made');
});
test('callback: failed verification => status error, NOT connected, nothing stored', async () => {
  const { ctx, mem } = mkCtx(gmailRoutes(403));
  const state = new URL((await H.startOAuth('u1', { provider: 'gmail' }, ctx)).url).searchParams.get('state')!;
  const to = await H.finishOAuth({ code: 'c', state }, ctx);
  assert.match(to, /integration_error/);
  assert.equal(mem.conns.get('u1|gmail').status, 'error');
  assert.equal(mem.secrets.size, 0);
});
test('callback: user unticked the required permission => error, nothing stored', async () => {
  const { ctx, mem } = mkCtx(gmailRoutes(200, 'email'));
  const state = new URL((await H.startOAuth('u1', { provider: 'gmail' }, ctx)).url).searchParams.get('state')!;
  assert.match(await H.finishOAuth({ code: 'c', state }, ctx), /not.granted/i);
  assert.equal(mem.conns.get('u1|gmail').status, 'error');
  assert.equal(mem.secrets.size, 0);
});
test('callback: state is one-time; reuse, forgery, and declined consent are all handled', async () => {
  const { ctx } = mkCtx(gmailRoutes());
  const state = new URL((await H.startOAuth('u1', { provider: 'gmail' }, ctx)).url).searchParams.get('state')!;
  assert.match(await H.finishOAuth({ code: 'c', state }, ctx), /connected/);
  assert.match(await H.finishOAuth({ code: 'c', state }, ctx), /expired|already used/i);
  assert.match(await H.finishOAuth({ code: 'c', state: 'forged' }, ctx), /expired|already used/i);
  assert.match(await H.finishOAuth({ error: 'access_denied' }, ctx), /declined/i);
});

// ---------- token refresh ----------
test('refresh: invalid_grant marks needs_reauthorization; users cannot borrow each other\'s connection', async () => {
  const { ctx, mem } = mkCtx((u) => (u.includes('oauth2.googleapis.com/token') ? { status: 400, body: { error: 'invalid_grant' } } : undefined));
  await connect(mem, 'A', 'gmail');
  await fails(gmailAction('A', { action: 'list' }, ctx), 401, 'needs_reauthorization');
  assert.equal(mem.conns.get('A|gmail').status, 'needs_reauthorization');
  await fails(gmailAction('B', { action: 'list' }, ctx), 409, 'not_connected');   // B has no connection of their own
});
test('refresh: a rotated refresh token is re-encrypted and saved', async () => {
  const { ctx, mem } = mkCtx((u) => (u.includes('accounts.spotify.com/api/token') ? { body: { access_token: 'SAT', expires_in: 3600, refresh_token: 'RT-new' } } : undefined));
  await connect(mem, 'A', 'spotify');
  const r = await H.spotifyToken('A', ctx);
  assert.deepEqual(r, { access_token: 'SAT', expires_in: 3600 });
  assert.deepEqual(await decryptJson([...mem.secrets.values()][0], KEY), { refresh_token: 'RT-new' });
});
test('spotify: uses Basic auth with the server secret; secret never returned to the browser', async () => {
  const { ctx, mem, calls } = mkCtx((u) => (u.includes('accounts.spotify.com/api/token') ? { body: { access_token: 'SAT' } } : undefined));
  await connect(mem, 'A', 'spotify');
  const r = JSON.stringify(await H.spotifyToken('A', ctx));
  assert.ok((calls[0].init!.headers as any).Authorization.startsWith('Basic '));
  assert.ok(!r.includes('ssec') && !r.includes('RT-secret'));
});

// ---------- gmail ----------
const b64 = (s: string) => Buffer.from(s).toString('base64url');
test('gmail list: All Mail semantics (no label filter), query passed through, metadata normalized', async () => {
  const { ctx, mem, calls } = mkCtx((u) => {
    if (u.includes('oauth2.googleapis.com/token')) return { body: { access_token: 'AT' } };
    if (u.includes('/messages?')) return { body: { messages: [{ id: 'aaaa1111bbbb2222' }], nextPageToken: 'NP', resultSizeEstimate: 99 } };
    if (u.includes('/messages/aaaa1111bbbb2222')) return { body: { id: 'aaaa1111bbbb2222', threadId: 't', snippet: 'hi', labelIds: ['UNREAD'], payload: { headers: [{ name: 'From', value: 'Bob <b@x.com>' }, { name: 'Subject', value: 'Invoice' }, { name: 'Date', value: 'Mon, 19 Oct 2026' }] } } };
  });
  await connect(mem, 'A', 'gmail');
  const r: any = await gmailAction('A', { action: 'list', q: 'from:bob older_than:1y' }, ctx);
  const listUrl = new URL(calls.find((c) => c.url.includes('/messages?'))!.url);
  assert.equal(listUrl.searchParams.get('labelIds'), null);
  assert.equal(listUrl.searchParams.get('q'), 'from:bob older_than:1y');
  assert.deepEqual(r.messages[0], { id: 'aaaa1111bbbb2222', threadId: 't', from: 'Bob <b@x.com>', subject: 'Invoice', date: 'Mon, 19 Oct 2026', snippet: 'hi', unread: true, starred: false, internalDate: null });
  assert.equal(r.nextPageToken, 'NP');
  assert.equal((calls.at(-1)!.init!.headers as any).Authorization, 'Bearer AT');
});
test('gmail get: rejects malformed ids (no path injection), returns plain text + attachment names + web link', async () => {
  const { ctx, mem, calls } = mkCtx((u) => {
    if (u.includes('oauth2.googleapis.com/token')) return { body: { access_token: 'AT' } };
    if (u.includes('/messages/aaaa1111bbbb2222')) return { body: { id: 'aaaa1111bbbb2222', payload: { headers: [], mimeType: 'multipart/mixed', parts: [
      { mimeType: 'text/plain', body: { data: b64('Hello plain') } }, { mimeType: 'text/html', body: { data: b64('<b>Hello html</b>') } },
      { mimeType: 'application/pdf', filename: 'inv.pdf', body: { attachmentId: 'x', size: 10 } }] } } };
  });
  await connect(mem, 'A', 'gmail');
  await fails(gmailAction('A', { action: 'get', id: '../../drafts' }, ctx), 400);
  await fails(gmailAction('A', { action: 'nope' }, ctx), 400);
  const r: any = await gmailAction('A', { action: 'get', id: 'aaaa1111bbbb2222' }, ctx);
  assert.equal(r.bodyText, 'Hello plain');
  assert.deepEqual(r.attachments, [{ filename: 'inv.pdf', mimeType: 'application/pdf', size: 10, attachmentId: 'x' }]);
  assert.equal(r.webLink, 'https://mail.google.com/mail/u/0/#all/aaaa1111bbbb2222');
  assert.equal(calls.filter((c) => c.url.includes('../')).length, 0);
});
test('gmail errors: 429 => rate_limited, 401 from API => needs_reauthorization, 403 permission => forbidden', async () => {
  for (const [status, body, code] of [[429, {}, 'rate_limited'], [403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }, 'rate_limited'], [403, { error: 'denied' }, 'forbidden'], [401, {}, 'needs_reauthorization']] as const) {
    const { ctx, mem } = mkCtx((u) => (u.includes('oauth2') ? { body: { access_token: 'AT' } } : u.includes('/messages?') ? { status, body } : undefined));
    await connect(mem, 'A', 'gmail');
    await fails(gmailAction('A', { action: 'list' }, ctx), status === 403 && code === 'rate_limited' ? 429 : status, code);
  }
});
test('html-only mail is reduced to text, scripts removed', () => {
  const t = extractBody({ mimeType: 'text/html', body: { data: b64('<style>x{}</style><p>Hi&nbsp;you</p><script>alert(1)</script><div>Bye</div>') } }).text;
  assert.ok(t.includes('Hi you') && t.includes('Bye') && !t.includes('alert') && !t.includes('<'));
});

// ---------- calendar ----------
test('calendar: timed, all-day, and cancelled events; wall-clock time preserved; pagination capped at 3 pages', async () => {
  assert.deepEqual(normalizeGoogleEvent({ id: 'e1', summary: 'Standup', start: { dateTime: '2026-10-22T09:30:00-04:00' }, end: { dateTime: '2026-10-22T10:00:00-04:00' } }),
    { providerId: 'e1', title: 'Standup', description: undefined, date: '2026-10-22', startTime: '09:30 AM', endTime: '10:00 AM', location: undefined });
  assert.equal(normalizeGoogleEvent({ id: 'e2', start: { date: '2026-12-25' }, end: { date: '2026-12-26' } })!.startTime, '');
  assert.equal(normalizeGoogleEvent({ id: 'e3', status: 'cancelled', start: { date: '2026-12-25' } }), null);
  assert.equal(normalizeGoogleEvent({ id: 'e4', start: { dateTime: '2026-10-22T00:15:00Z' } })!.startTime, '12:15 AM');
  assert.equal(normalizeGoogleEvent({ id: 'e5', start: { dateTime: '2026-10-22T12:00:00Z' } })!.startTime, '12:00 PM');
  let page = 0;
  const { ctx, mem } = mkCtx((u) => {
    if (u.includes('oauth2')) return { body: { access_token: 'AT' } };
    if (u.includes('/events?')) { page++; return { body: { items: [{ id: `p${page}`, summary: 'x', start: { date: '2026-11-01' } }], nextPageToken: 'more' } }; }
  });
  await connect(mem, 'A', 'google_calendar');
  const r: any = await H.calendarImport('A', ctx);
  assert.equal(page, 3); assert.equal(r.events.length, 3); assert.equal(r.truncated, true);
  assert.equal(mem.conns.get('A|google_calendar').last_synced_at, '2026-10-20T12:00:00.000Z');
});

// ---------- sheets ----------
test('sheets: validates spreadsheet id and range; returns capped values', async () => {
  const { ctx, mem } = mkCtx((u) => (u.includes('oauth2') ? { body: { access_token: 'AT' } } : u.includes('/values/') ? { body: { values: [['a', 'b'], ['1', '2']] } } : u.includes('fields=properties.title') ? { body: { properties: { title: 'Budget' } } } : undefined));
  await connect(mem, 'A', 'google_sheets');
  await fails(H.sheetsPreview('A', { spreadsheetId: '../x' }, ctx), 400);
  const r: any = await H.sheetsPreview('A', { spreadsheetId: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789', range: 'Sheet1!A1:C5' }, ctx);
  assert.deepEqual(r, { title: 'Budget', values: [['a', 'b'], ['1', '2']] });
});

// ---------- health ----------
test('health ingest: auth, validation (null stays null), idempotency, connected only after real data', async () => {
  const mem = memDb();
  const { ctx } = mkCtx(() => undefined, mem);
  const raw = 'cosmos_h_' + 'ab'.repeat(32);
  mem.tokens.set(await sha256Hex(raw), { id: 'tk1', userId: 'A' });
  await fails(H.healthIngest(null, {}, ctx), 401);
  await fails(H.healthIngest('Bearer cosmos_h_' + 'cd'.repeat(32), { workouts: [] }, ctx), 401);
  await fails(H.healthIngest(`Bearer ${raw}`, { workouts: [] }, ctx), 400, 'invalid_payload');
  assert.equal(mem.conns.size, 0, 'rejected requests must not mark the connection connected');
  const body = { workouts: [{ externalId: 'hc-1', title: 'Run', date: '2026-10-19', durationMinutes: null, calories: null }, { externalId: 'hc-2', title: 'Walk', date: '2026-10-19', durationMinutes: 0, calories: 120 }] };
  assert.deepEqual(await H.healthIngest(`Bearer ${raw}`, body, ctx), { received: 2, inserted: 2, duplicates: 0 });
  assert.equal(mem.workouts[0].duration_minutes, null);          // missing != 0
  assert.equal(mem.workouts[1].duration_minutes, 0);             // explicit 0 preserved
  assert.deepEqual(await H.healthIngest(`Bearer ${raw}`, body, ctx), { received: 2, inserted: 0, duplicates: 2 });
  assert.equal(mem.workouts.length, 2);
  assert.equal(mem.workouts.every((w) => w.user_id === 'A' && w.source === 'health_connect'), true);
  assert.equal(mem.conns.get('A|health_connect').status, 'connected');
});
test('health validation rejects bad dates, negatives, oversize batches', () => {
  const w = (o: any) => ({ workouts: [{ externalId: 'x', title: 't', date: '2026-10-19', ...o }] });
  assert.equal(validateHealthPayload(w({ date: '10/19/2026' })).ok, false);
  assert.equal(validateHealthPayload(w({ date: '2026-02-31' })).ok, false);
  assert.equal(validateHealthPayload(w({ calories: -5 })).ok, false);
  assert.equal(validateHealthPayload(w({ durationMinutes: 1.5 })).ok, false);
  assert.equal(validateHealthPayload({ workouts: Array(101).fill(w({}).workouts[0]) }).ok, false);
  assert.equal(validateHealthPayload(w({})).ok, true);
});

// ---------- disconnect ----------
test('disconnect: revokes at Google (best effort), deletes the stored secret, clears status', async () => {
  const { ctx, mem, calls } = mkCtx((u) => (u.includes('oauth2.googleapis.com/token') ? { body: { access_token: 'AT' } } : u.includes('/revoke') ? { body: {} } : undefined));
  await connect(mem, 'A', 'gmail');
  await H.disconnect('A', { provider: 'gmail' }, ctx);
  assert.equal(mem.secrets.size, 0);
  assert.equal(mem.conns.get('A|gmail').status, 'not_connected');
  assert.ok(calls.some((c) => c.url.includes('/revoke')));
  await fails(gmailAction('A', { action: 'list' }, ctx), 409, 'not_connected');
});

// ---------- router: the single entrypoint's authentication rules ----------
import { handleRequest } from '../supabase/functions/api/_shared/router.ts';
const BASE = 'https://x.supabase.co/functions/v1/api';
const verifier = (valid: Record<string, string>) => async (t: string) => valid[t] ?? null;
const req = (route: string, init: RequestInit = {}) => new Request(`${BASE}/${route}`, { method: 'POST', ...init });

test('router: every user route rejects a missing, malformed, or invalid token BEFORE running any handler', async () => {
  for (const route of ['oauth-start', 'oauth-disconnect', 'gmail', 'calendar-import', 'sheets-preview', 'spotify-token']) {
    const { ctx, calls } = mkCtx(() => undefined);
    for (const headers of [{}, { authorization: 'Bearer ' }, { authorization: 'Bearer nope' }, { authorization: 'Basic abc' }] as Record<string, string>[]) {
      const r = await handleRequest(req(route, { headers, body: '{}' }), ctx, verifier({ good: 'u1' }));
      assert.equal(r.status, 401, `${route} with ${JSON.stringify(headers)}`);
    }
    assert.equal(calls.length, 0, `${route} must not reach any provider when unauthenticated`);
  }
});
test('router: a valid token reaches the handler as THAT user, and a different token cannot act as them', async () => {
  const { ctx, mem } = mkCtx((u) => (u.includes('oauth2') ? { body: { access_token: 'AT' } } : u.includes('/messages?') ? { body: { messages: [] } } : undefined));
  await connect(mem, 'u1', 'gmail');
  const ok = await handleRequest(req('gmail', { headers: { authorization: 'Bearer good' }, body: JSON.stringify({ action: 'list' }) }), ctx, verifier({ good: 'u1', other: 'u2' }));
  assert.equal(ok.status, 200);
  const other = await handleRequest(req('gmail', { headers: { authorization: 'Bearer other' }, body: JSON.stringify({ action: 'list' }) }), ctx, verifier({ good: 'u1', other: 'u2' }));
  assert.equal(other.status, 409);                                    // u2 has no connection of their own
});
test('router: oauth-callback needs no JWT but is GET-only and funnels through one-time state', async () => {
  const { ctx } = mkCtx(gmailRoutes());
  const post = await handleRequest(req('oauth-callback'), ctx, verifier({}));
  assert.equal(post.status, 405);
  const state = new URL((await H.startOAuth('u1', { provider: 'gmail' }, ctx)).url).searchParams.get('state')!;
  const ok = await handleRequest(new Request(`${BASE}/oauth-callback?code=c&state=${state}`), ctx, verifier({}));
  assert.equal(ok.status, 302);
  assert.match(ok.headers.get('location')!, /^https:\/\/app\.example\?.*result=connected/);
  const replay = await handleRequest(new Request(`${BASE}/oauth-callback?code=c&state=${state}`), ctx, verifier({}));
  assert.match(replay.headers.get('location')!, /integration_error/);
  const forged = await handleRequest(new Request(`${BASE}/oauth-callback?code=c&state=forged`), ctx, verifier({}));
  assert.match(forged.headers.get('location')!, /integration_error/);
});
test('router: health-ingest ignores Supabase JWTs and accepts only an ingest token', async () => {
  const mem = memDb(); const { ctx } = mkCtx(() => undefined, mem);
  const raw = 'cosmos_h_' + 'ef'.repeat(32);
  mem.tokens.set(await sha256Hex(raw), { id: 't', userId: 'A' });
  const jwt = await handleRequest(req('health-ingest', { headers: { authorization: 'Bearer good' }, body: '{}' }), ctx, verifier({ good: 'A' }));
  assert.equal(jwt.status, 401);
  const body = JSON.stringify({ workouts: [{ externalId: 'a', title: 'Run', date: '2026-10-19' }] });
  const ok = await handleRequest(req('health-ingest', { headers: { authorization: `Bearer ${raw}` }, body }), ctx, verifier({}));
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as any).inserted, 1);
});
test('router: unknown routes 404, prototype-chain names do not resolve, wrong methods 405, OPTIONS gets CORS for the app origin only', async () => {
  const { ctx } = mkCtx(() => undefined);
  assert.equal((await handleRequest(req('nope'), ctx, verifier({}))).status, 404);
  assert.equal((await handleRequest(req('constructor'), ctx, verifier({}))).status, 404);
  assert.equal((await handleRequest(req('__proto__'), ctx, verifier({}))).status, 404);
  assert.equal((await handleRequest(new Request(`${BASE}/gmail`, { method: 'GET' }), ctx, verifier({}))).status, 405);
  const good = await handleRequest(new Request(`${BASE}/gmail`, { method: 'OPTIONS', headers: { origin: 'https://app.example' } }), ctx, verifier({}));
  assert.equal(good.status, 204);
  assert.equal(good.headers.get('access-control-allow-origin'), 'https://app.example');
  const evil = await handleRequest(new Request(`${BASE}/gmail`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), ctx, verifier({}));
  assert.notEqual(evil.headers.get('access-control-allow-origin'), 'https://evil.example');
});
test('router: handler errors never leak internals or tokens', async () => {
  const { ctx } = mkCtx(() => undefined);
  ctx.db.getConnection = async () => { throw new Error('connection string postgres://user:SECRET@host leaked?'); };
  const r = await handleRequest(req('gmail', { headers: { authorization: 'Bearer good' }, body: JSON.stringify({ action: 'list' }) }), { ...ctx, env: ENV }, verifier({ good: 'u1' }));
  const text = await r.text();
  assert.equal(r.status, 500);
  assert.ok(!text.includes('SECRET') && !text.includes('postgres://'));
});


// ---------- gmail: folders, scopes, attachments, modify, send ----------
const GS = { read: 'https://www.googleapis.com/auth/gmail.readonly', modify: 'https://www.googleapis.com/auth/gmail.modify', send: 'https://www.googleapis.com/auth/gmail.send' };
const gmailOk = (extra: Route = () => undefined): Route => (u, i) => (u.includes('oauth2') ? { body: { access_token: 'AT' } } : extra(u, i));

test('gmail folders use real labels; spam/trash opt in to includeSpamTrash; All Mail has no label filter', async () => {
  const want: Record<string, { labels: string[]; spamTrash: boolean }> = {
    inbox: { labels: ['INBOX'], spamTrash: false }, all: { labels: [], spamTrash: false }, sent: { labels: ['SENT'], spamTrash: false },
    drafts: { labels: ['DRAFT'], spamTrash: false }, starred: { labels: ['STARRED'], spamTrash: false },
    spam: { labels: ['SPAM'], spamTrash: true }, trash: { labels: ['TRASH'], spamTrash: true },
  };
  for (const [folder, w] of Object.entries(want)) {
    const { ctx, mem, calls } = mkCtx(gmailOk((u) => (u.includes('/messages?') ? { body: { messages: [] } } : undefined)));
    await connect(mem, 'A', 'gmail');
    await gmailAction('A', { action: 'list', folder, q: 'x' }, ctx);
    const url = new URL(calls.find((c) => c.url.includes('/messages?'))!.url);
    assert.deepEqual(url.searchParams.getAll('labelIds'), w.labels, folder);
    assert.equal(url.searchParams.get('includeSpamTrash') === 'true', w.spamTrash, folder);
    assert.equal(url.searchParams.get('q'), 'x');
  }
  const { ctx, mem } = mkCtx(gmailOk());
  await connect(mem, 'A', 'gmail');
  await fails(gmailAction('A', { action: 'list', folder: 'constructor' }, ctx), 400, 'bad_folder');
  await fails(gmailAction('A', { action: 'list', folder: 'INBOX; DROP' }, ctx), 400, 'bad_folder');
});
test('gmail list never returns the same message twice, and reports starred/unread', async () => {
  const meta = { id: 'aaaa1111bbbb2222', threadId: 't', snippet: 's', labelIds: ['STARRED'], payload: { headers: [] } };
  const { ctx, mem, calls } = mkCtx(gmailOk((u) => (u.includes('/messages?') ? { body: { messages: [{ id: 'aaaa1111bbbb2222' }, { id: 'aaaa1111bbbb2222' }] } } : u.includes('/messages/aaaa') ? { body: meta } : undefined)));
  await connect(mem, 'A', 'gmail');
  const r: any = await gmailAction('A', { action: 'list', folder: 'all' }, ctx);
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].starred, true); assert.equal(r.messages[0].unread, false);
  assert.equal(calls.filter((c) => c.url.includes('/messages/aaaa')).length, 1);
});
test('modify: needs the modify scope; only UNREAD/STARRED may change; read-only grants are refused before any Gmail write', async () => {
  const { ctx, mem, calls } = mkCtx(gmailOk((u, i) => (u.includes('/modify') ? { body: { id: 'aaaa1111bbbb2222', labelIds: ['STARRED'] } } : undefined)));
  await connect(mem, 'A', 'gmail', 'connected', 'RT', [GS.read]);
  await fails(gmailAction('A', { action: 'modify', id: 'aaaa1111bbbb2222', addLabelIds: ['STARRED'] }, ctx), 403, 'scope_not_granted');
  assert.equal(calls.some((c) => c.url.includes('/modify')), false);
  await connect(mem, 'B', 'gmail', 'connected', 'RT', [GS.read, GS.modify]);
  for (const bad of [['TRASH'], ['INBOX'], ['SPAM'], ['UNREAD', 'DELETE']]) await fails(gmailAction('B', { action: 'modify', id: 'aaaa1111bbbb2222', addLabelIds: bad }, ctx), 400, 'bad_labels');
  await fails(gmailAction('B', { action: 'modify', id: 'aaaa1111bbbb2222' }, ctx), 400, 'bad_labels');
  const ok: any = await gmailAction('B', { action: 'modify', id: 'aaaa1111bbbb2222', addLabelIds: ['STARRED'], removeLabelIds: ['UNREAD'] }, ctx);
  assert.equal(ok.starred, true);
  const sent = JSON.parse(String(calls.find((c) => c.url.includes('/modify'))!.init!.body));
  assert.deepEqual(sent, { addLabelIds: ['STARRED'], removeLabelIds: ['UNREAD'] });
  assert.equal((calls.find((c) => c.url.includes('/modify'))!.init as any).method, 'POST');
});
test('send: needs the send scope; validates recipients/subject; blocks header injection; builds correct MIME', async () => {
  const { ctx, mem, calls } = mkCtx(gmailOk((u) => (u.includes('/messages/send') ? { body: { id: 'sent1', threadId: 'th1' } } : undefined)));
  const msg = { action: 'send', to: 'a@example.com', subject: 'Hi', body: 'Hello' };
  await connect(mem, 'A', 'gmail', 'connected', 'RT', [GS.read, GS.modify]);                     // modify alone does NOT enable sending in this app
  await fails(gmailAction('A', msg, ctx), 403, 'scope_not_granted');
  await connect(mem, 'B', 'gmail', 'connected', 'RT', [GS.read, GS.send]);
  for (const bad of [{ to: '' }, { to: 'not-an-email' }, { to: 'a@example.com\r\nBcc: evil@x.com' }, { to: 'a@x.com, ,b' }, { subject: 'Hi\r\nBcc: evil@x.com' }, { subject: '' }, { body: '   ' }, { body: 'x'.repeat(100_001) }, { cc: 'bad' }])
    await fails(gmailAction('B', { ...msg, ...bad }, ctx), 400, 'invalid_message');
  assert.equal(calls.some((c) => c.url.includes('/messages/send')), false, 'nothing may reach Gmail for invalid input');
  const r: any = await gmailAction('B', { ...msg, to: 'a@example.com, b@example.org', cc: ['c@example.com'], subject: 'Héllo wörld', body: 'Line1\nLine2 ünï', threadId: 'aaaa1111bbbb2222', inReplyTo: '<abc@mail.example>', references: '<x@y> <abc@mail.example>' }, ctx);
  assert.deepEqual(r, { id: 'sent1', threadId: 'th1' });
  const payload = JSON.parse(String(calls.find((c) => c.url.includes('/messages/send'))!.init!.body));
  assert.equal(payload.threadId, 'aaaa1111bbbb2222');
  const mime = Buffer.from(payload.raw, 'base64url').toString();
  assert.match(mime, /^To: a@example.com, b@example.org\r\nCc: c@example.com\r\nSubject: =\?UTF-8\?B\?/);
  assert.match(mime, /In-Reply-To: <abc@mail.example>\r\nReferences: <x@y> <abc@mail.example>/);
  const [head, body] = mime.split('\r\n\r\n');
  assert.match(head, /Content-Transfer-Encoding: base64/);
  assert.equal(Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString(), 'Line1\r\nLine2 ünï');
  assert.equal((head.match(/^Bcc:/gim) ?? []).length, 0);
  assert.equal(Buffer.from(/=\?UTF-8\?B\?(.+)\?=/.exec(head)![1], 'base64').toString(), 'Héllo wörld');
});
test('send: malformed reply headers are dropped rather than injected', () => {
  const raw = Buffer.from(buildRawMessage({ to: ['a@example.com'], cc: [], subject: 'S', body: 'b' }), 'base64url').toString();
  assert.ok(!/In-Reply-To|References/.test(raw));
  assert.deepEqual(parseRecipients('a@example.com; b@example.com', 'To', true), ['a@example.com', 'b@example.com']);
  assert.throws(() => parseRecipients(Array(21).fill('a@example.com'), 'To', true));
});
test('attachments: id validation, size cap, and the bytes come back untouched for the client to Blob-ify', async () => {
  const { ctx, mem } = mkCtx(gmailOk((u) => (u.includes('/attachments/BIGBIGBIGBIG') ? { body: { size: 16 * 1024 * 1024, data: '' } } : u.includes('/attachments/') ? { body: { size: 3, data: 'AQID' } } : undefined)));
  await connect(mem, 'A', 'gmail');
  await fails(gmailAction('A', { action: 'attachment', id: 'aaaa1111bbbb2222', attachmentId: '../../x' }, ctx), 400, 'bad_id');
  await fails(gmailAction('A', { action: 'attachment', id: '../x', attachmentId: 'ANGjdJ_abcdefghij' }, ctx), 400, 'bad_id');
  await fails(gmailAction('A', { action: 'attachment', id: 'aaaa1111bbbb2222', attachmentId: 'BIGBIGBIGBIG' }, ctx), 413, 'too_large');
  assert.deepEqual(await gmailAction('A', { action: 'attachment', id: 'aaaa1111bbbb2222', attachmentId: 'ANGjdJ_abcdefghij' }, ctx), { size: 3, data: 'AQID' });
});
test('oauth start: Gmail asks for read-only by default; modify/send only when requested; scopes accumulate; other providers refuse capabilities', async () => {
  const scopes = async (body: any) => { const { ctx } = mkCtx(() => undefined); const u = new URL((await H.startOAuth('u1', body, ctx)).url); return { s: u.searchParams.get('scope')!.split(' '), inc: u.searchParams.get('include_granted_scopes') }; };
  assert.deepEqual(await scopes({ provider: 'gmail' }), { s: [GS.read, 'email'], inc: 'false' });
  assert.deepEqual(await scopes({ provider: 'gmail', capabilities: ['modify'] }), { s: [GS.read, 'email', GS.modify], inc: 'true' });
  assert.deepEqual((await scopes({ provider: 'gmail', capabilities: ['send', 'modify', 'send'] })).s, [GS.read, 'email', GS.send, GS.modify]);
  assert.deepEqual((await scopes({ provider: 'gmail', capabilities: ['delete-everything'] })).s, [GS.read, 'email']);
  const { ctx } = mkCtx(() => undefined);
  await fails(H.startOAuth('u1', { provider: 'spotify', capabilities: ['modify'] }, ctx), 400, 'bad_capabilities');
});


// ---------- Google Drive backups ----------
const GD_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const backupJson = (extra: any = {}) => JSON.stringify({ app: 'cosmos-os', formatVersion: 3, createdAt: '2026-10-23T09:00:00Z', data: { notes: [{ id: 'a' }, { id: 'b' }], tasks: [{ id: 'c' }] }, ...extra });
interface DriveSim { folder?: string | null; files: Record<string, any>; contents: Record<string, string>; deleted: string[]; uploads: number; readBack?: (id: string, original: string) => string }
const driveSim = (init: Partial<DriveSim> = {}): { sim: DriveSim; route: Route } => {
  const sim: DriveSim = { folder: 'FOLDERID1234567', files: {}, contents: {}, deleted: [], uploads: 0, ...init };
  const route: Route = (u, i) => {
    const method = (i?.method ?? 'GET').toUpperCase();
    if (u.includes('oauth2')) return { body: { access_token: 'AT' } };
    if (u.includes('/upload/drive/v3/files') && method === 'POST') {
      sim.uploads++;
      const raw = String(i!.body); const metaStart = raw.indexOf('{'), metaEnd = raw.indexOf('\r\n--', metaStart);
      const meta = JSON.parse(raw.slice(metaStart, metaEnd));
      const content = raw.slice(raw.indexOf('Content-Type: application/json\r\n\r\n', metaEnd) + 'Content-Type: application/json\r\n\r\n'.length, raw.lastIndexOf('\r\n--'));
      const id = `NEWFILE${sim.uploads}1234567`;
      sim.files[id] = { id, name: meta.name, parents: meta.parents, appProperties: meta.appProperties, size: String(content.length), createdTime: '2026-10-23T09:00:01Z' };
      sim.contents[id] = content;
      return { body: { id, name: meta.name, size: String(content.length), createdTime: '2026-10-23T09:00:01Z' } };
    }
    if (u.includes('/drive/v3/files') && method === 'POST') { sim.folder = 'FOLDERID1234567'; return { body: { id: sim.folder } }; }
    if (u.includes('/drive/v3/files/') && method === 'DELETE') { sim.deleted.push(u.split('/files/')[1]); return { status: 204, body: {} }; }
    const m = u.match(/\/drive\/v3\/files\/([A-Za-z0-9_-]+)\?(.*)/);
    if (m && method === 'GET') {
      const f = sim.files[m[1]];
      if (!f) return { status: 404, body: {} };
      if (m[2].includes('alt=media')) return { body: sim.readBack ? sim.readBack(m[1], sim.contents[m[1]]) : sim.contents[m[1]] as any, __text: true } as any;
      return { body: f };
    }
    if (u.includes('/drive/v3/files?')) {
      const q = new URL(u).searchParams.get('q')!;
      if (q.includes('application/vnd.google-apps.folder')) return { body: { files: sim.folder ? [{ id: sim.folder, name: FOLDER_NAME }] : [] } };
      return { body: { files: Object.values(sim.files).filter((f: any) => f.parents.includes(sim.folder) && f.appProperties?.cosmosBackup === '1') } };
    }
  };
  return { sim, route };
};
// Answers each request exactly once. Drive media downloads are plain text; everything else is JSON.
const driveCtx = (r: ReturnType<typeof driveSim>, mem = memDb()) => {
  const base = mkCtx(() => undefined, mem);
  base.ctx.fetch = (async (url: any, init?: RequestInit) => {
    const u = String(url); base.calls.push({ url: u, init });
    const res = (r.route(u, init) ?? { status: 404, body: {} }) as any;
    if (res.__text) return new Response(String(res.body), { status: 200 });
    return new Response(res.status === 204 ? null : JSON.stringify(res.body), { status: res.status ?? 200 });
  }) as typeof fetch;
  return base;
};
const connectDrive = (mem: ReturnType<typeof memDb>, user = 'A') => connect(mem, user, 'google_drive', 'connected', 'RT', [GD_SCOPE, 'email']);

test('drive: oauth asks for the narrow drive.file scope only (plus email), never full Drive', async () => {
  const { ctx } = mkCtx(() => undefined);
  const u = new URL((await H.startOAuth('u1', { provider: 'google_drive' }, ctx)).url);
  assert.deepEqual(u.searchParams.get('scope')!.split(' '), [GD_SCOPE, 'email']);
  assert.ok(!u.searchParams.get('scope')!.includes('/auth/drive ') && !u.searchParams.get('scope')!.endsWith('/auth/drive'));
  assert.equal(u.searchParams.get('access_type'), 'offline');
});
test('drive create: makes the visible folder once, uploads a NEW timestamped file, verifies it, records the success time', async () => {
  const r = driveSim({ folder: null }); const mem = memDb(); const { ctx, calls } = driveCtx(r, mem);
  await connectDrive(mem);
  const res: any = await driveAction('A', { action: 'create', content: backupJson() }, ctx);
  assert.match(res.name, /^cosmos-os-backup-\d{4}-\d\d-\d\d_\d\d-\d\dZ?-?\d*Z?\.json$|^cosmos-os-backup-2026-10-20_12-00-00Z\.json$/);
  assert.equal(res.records, 3);
  assert.equal(r.sim.uploads, 1);
  assert.deepEqual(r.sim.files[res.id].parents, ['FOLDERID1234567']);
  assert.deepEqual(r.sim.files[res.id].appProperties, { cosmosBackup: '1', formatVersion: '3', records: '3' });
  assert.equal(r.sim.contents[res.id], backupJson());                                       // stored byte-for-byte
  assert.equal(calls.filter((c) => (c.init?.method ?? 'GET') === 'DELETE').length, 0);
  assert.equal(calls.filter((c) => c.url.includes('/drive/v3/files') && (c.init?.method === 'POST') && !c.url.includes('upload')).length, 1);   // folder created once
  assert.equal(mem.conns.get('A|google_drive').last_synced_at, '2026-10-20T12:00:00.000Z');
  assert.equal(mem.conns.get('A|google_drive').last_error, null);
});
test('drive create: two backups never collide or overwrite; the folder is reused', async () => {
  const r = driveSim(); const mem = memDb(); const { ctx } = driveCtx(r, mem);
  await connectDrive(mem);
  const a: any = await driveAction('A', { action: 'create', content: backupJson() }, ctx);
  ctx.now = () => new Date('2026-10-20T12:00:05Z');
  const b: any = await driveAction('A', { action: 'create', content: backupJson({ createdAt: 'later' }) }, ctx);
  assert.notEqual(a.id, b.id); assert.notEqual(a.name, b.name);
  assert.equal(Object.keys(r.sim.files).length, 2);
  assert.equal(r.sim.contents[a.id], backupJson());                                          // first backup untouched
});
test('drive create: an incomplete/corrupted upload is deleted and reported; earlier backups and the connection stay valid', async () => {
  const mem = memDb();
  const r = driveSim({ readBack: (_id, original) => original.slice(0, original.length - 20) });   // Drive returns a truncated copy
  const { ctx } = driveCtx(r, mem);
  await connectDrive(mem);
  r.sim.files['OLDBACKUP1234567'] = { id: 'OLDBACKUP1234567', name: 'cosmos-os-backup-old.json', parents: ['FOLDERID1234567'], appProperties: { cosmosBackup: '1' } };
  r.sim.contents['OLDBACKUP1234567'] = backupJson({ createdAt: 'old' });
  await fails(driveAction('A', { action: 'create', content: backupJson() }, ctx), 502, 'backup_verify_failed');
  assert.deepEqual(r.sim.deleted, ['NEWFILE11234567']);                                      // only the bad new file removed
  assert.ok(r.sim.files['OLDBACKUP1234567'] && r.sim.contents['OLDBACKUP1234567'] === backupJson({ createdAt: 'old' }));
  const c = mem.conns.get('A|google_drive');
  assert.equal(c.status, 'connected'); assert.equal(c.last_synced_at, undefined);            // no false "success"
  assert.match(c.last_error, /Last backup attempt failed/);
});
test('drive create: invalid, foreign, newer-format, or oversized files are refused BEFORE touching Drive', async () => {
  const r = driveSim(); const mem = memDb(); const { ctx, calls } = driveCtx(r, mem);
  await connectDrive(mem);
  const before = calls.length;
  await fails(driveAction('A', { action: 'create', content: 'not json' }, ctx), 400, 'invalid_backup');
  await fails(driveAction('A', { action: 'create', content: JSON.stringify({ hello: 1 }) }, ctx), 400, 'invalid_backup');
  await fails(driveAction('A', { action: 'create', content: backupJson({ app: 'other' }) }, ctx), 400, 'invalid_backup');
  await fails(driveAction('A', { action: 'create', content: backupJson({ formatVersion: 99 }) }, ctx), 400, 'invalid_backup');
  await fails(driveAction('A', { action: 'create', content: '' }, ctx), 400, 'invalid_backup');
  await fails(driveAction('A', { action: 'create', content: backupJson({ pad: 'x'.repeat(10 * 1024 * 1024) }) }, ctx), 413, 'too_large');
  assert.equal(r.sim.uploads, 0);
  assert.equal(calls.slice(before).filter((c) => c.url.includes('/drive/v3') || c.url.includes('/upload/')).length, 0);
});
test('drive: list returns only Cosmos backups from the Cosmos folder; empty when no folder exists', async () => {
  const r = driveSim(); const mem = memDb(); const { ctx } = driveCtx(r, mem);
  await connectDrive(mem);
  r.sim.files['F1AAAAAAAAAA'] = { id: 'F1AAAAAAAAAA', name: 'b1.json', parents: ['FOLDERID1234567'], size: '10', createdTime: 't1', appProperties: { cosmosBackup: '1', records: '7', formatVersion: '3' } };
  r.sim.files['F2AAAAAAAAAA'] = { id: 'F2AAAAAAAAAA', name: 'unrelated.json', parents: ['FOLDERID1234567'], size: '10', createdTime: 't2', appProperties: {} };
  r.sim.files['F3AAAAAAAAAA'] = { id: 'F3AAAAAAAAAA', name: 'elsewhere.json', parents: ['OTHERFOLDER12345'], size: '10', createdTime: 't3', appProperties: { cosmosBackup: '1' } };
  const l: any = await driveAction('A', { action: 'list' }, ctx);
  assert.deepEqual(l.backups, [{ id: 'F1AAAAAAAAAA', name: 'b1.json', size: 10, createdTime: 't1', records: 7, formatVersion: 3 }]);
  const none = driveCtx(driveSim({ folder: null }), mem);
  assert.deepEqual(await driveAction('A', { action: 'list' }, none.ctx), { backups: [] });
});
test('drive get: only a real Cosmos backup inside the Cosmos folder can be read; ids are validated', async () => {
  const r = driveSim(); const mem = memDb(); const { ctx } = driveCtx(r, mem);
  await connectDrive(mem);
  const body = backupJson();
  r.sim.files['GOODFILE123456'] = { id: 'GOODFILE123456', name: 'good.json', parents: ['FOLDERID1234567'], size: String(body.length), appProperties: { cosmosBackup: '1' } }; r.sim.contents['GOODFILE123456'] = body;
  r.sim.files['STRANGER123456'] = { id: 'STRANGER123456', name: 'x.json', parents: ['FOLDERID1234567'], size: '5', appProperties: {} }; r.sim.contents['STRANGER123456'] = 'secret';
  r.sim.files['ELSEWHERE12345'] = { id: 'ELSEWHERE12345', name: 'y.json', parents: ['ZZZ'], size: '5', appProperties: { cosmosBackup: '1' } }; r.sim.contents['ELSEWHERE12345'] = 'secret';
  r.sim.files['TRASHED1234567'] = { id: 'TRASHED1234567', name: 'z.json', parents: ['FOLDERID1234567'], size: '5', trashed: true, appProperties: { cosmosBackup: '1' } }; r.sim.contents['TRASHED1234567'] = 'secret';
  assert.deepEqual(await driveAction('A', { action: 'get', id: 'GOODFILE123456' }, ctx), { id: 'GOODFILE123456', name: 'good.json', content: body });
  for (const id of ['STRANGER123456', 'ELSEWHERE12345', 'TRASHED1234567']) await fails(driveAction('A', { action: 'get', id }, ctx), 404, 'not_a_backup');
  await fails(driveAction('A', { action: 'get', id: '../../etc' }, ctx), 400, 'bad_id');
  await fails(driveAction('A', { action: 'get', id: 'short' }, ctx), 400, 'bad_id');
  await fails(driveAction('A', { action: 'get', id: 'MISSINGFILE1234' }, ctx), 404);
  await fails(driveAction('A', { action: 'nope' }, ctx), 400, 'bad_action');
});
test('drive: expired access asks to reconnect; accounts are isolated; no Drive call happens when not connected', async () => {
  const mem = memDb();
  const expired = driveCtx(driveSim({}), mem);
  expired.ctx.fetch = (async (u: any) => (String(u).includes('oauth2') ? new Response(JSON.stringify({ access_token: 'AT' })) : new Response('{}', { status: 401 }))) as typeof fetch;
  await connectDrive(mem, 'A');
  await fails(driveAction('A', { action: 'list' }, expired.ctx), 401, 'needs_reauthorization');
  assert.equal(mem.conns.get('A|google_drive').status, 'needs_reauthorization');
  const fresh = driveCtx(driveSim(), mem);
  await fails(driveAction('B', { action: 'list' }, fresh.ctx), 409, 'not_connected');          // B never connected
  assert.equal(fresh.calls.filter((c) => c.url.includes('googleapis.com/drive')).length, 0);
});
test('drive route is reachable only with a valid session', async () => {
  const { ctx, calls } = mkCtx(() => undefined);
  const r = await handleRequest(req('drive-backup', { headers: {}, body: JSON.stringify({ action: 'list' }) }), ctx, verifier({ good: 'u1' }));
  assert.equal(r.status, 401); assert.equal(calls.length, 0);
});
