import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptJson, decryptJson, sha256Hex } from '../supabase/functions/_shared/crypto.ts';
import * as H from '../supabase/functions/_shared/handlers.ts';
import { extractBody, normalizeGoogleEvent, validateHealthPayload } from '../supabase/functions/_shared/parse.ts';
import { signAppleDeveloperToken } from '../supabase/functions/_shared/jwt.ts';
import { HttpError, type Ctx, type DbPort, type ConnPatch } from '../supabase/functions/_shared/ports.ts';

const KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
const ENV = { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec', SPOTIFY_CLIENT_ID: 'sid', SPOTIFY_CLIENT_SECRET: 'ssec',
  TOKEN_ENCRYPTION_KEY: KEY, SUPABASE_URL: 'https://x.supabase.co', APP_URL: 'https://app.example' };

function memDb() {
  const states = new Map<string, any>(), conns = new Map<string, any>(), secrets = new Map<string, string>(), tokens = new Map<string, any>(), workouts: any[] = [];
  let n = 0;
  const db: DbPort = {
    async insertState(state, userId, provider) { states.set(state, { userId, provider, exp: Date.now() + 600000 }); },
    async consumeState(s) { const r = states.get(s); states.delete(s); return !r || r.exp < Date.now() ? null : { userId: r.userId, provider: r.provider }; },
    async getConnection(u, p) { const c = conns.get(`${u}|${p}`); return c ? { id: c.id, status: c.status } : null; },
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
const connect = async (mem: ReturnType<typeof memDb>, user: string, provider: any, status: any = 'connected', rt = 'RT-secret') => {
  const id = await mem.db.saveConnection(user, provider, { status });
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
  assert.equal(u.searchParams.get('redirect_uri'), 'https://x.supabase.co/functions/v1/oauth-callback');
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
  await fails(H.gmailAction('A', { action: 'list' }, ctx), 401, 'needs_reauthorization');
  assert.equal(mem.conns.get('A|gmail').status, 'needs_reauthorization');
  await fails(H.gmailAction('B', { action: 'list' }, ctx), 409, 'not_connected');   // B has no connection of their own
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
  const r: any = await H.gmailAction('A', { action: 'list', q: 'from:bob older_than:1y' }, ctx);
  const listUrl = new URL(calls.find((c) => c.url.includes('/messages?'))!.url);
  assert.equal(listUrl.searchParams.get('labelIds'), null);
  assert.equal(listUrl.searchParams.get('q'), 'from:bob older_than:1y');
  assert.deepEqual(r.messages[0], { id: 'aaaa1111bbbb2222', threadId: 't', from: 'Bob <b@x.com>', subject: 'Invoice', date: 'Mon, 19 Oct 2026', snippet: 'hi', unread: true });
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
  await fails(H.gmailAction('A', { action: 'get', id: '../../drafts' }, ctx), 400);
  await fails(H.gmailAction('A', { action: 'nope' }, ctx), 400);
  const r: any = await H.gmailAction('A', { action: 'get', id: 'aaaa1111bbbb2222' }, ctx);
  assert.equal(r.bodyText, 'Hello plain');
  assert.deepEqual(r.attachments, [{ filename: 'inv.pdf', mimeType: 'application/pdf', size: 10 }]);
  assert.equal(r.webLink, 'https://mail.google.com/mail/u/0/#all/aaaa1111bbbb2222');
  assert.equal(calls.filter((c) => c.url.includes('../')).length, 0);
});
test('gmail errors: 429 => rate_limited, 401 from API => needs_reauthorization, 403 permission => forbidden', async () => {
  for (const [status, body, code] of [[429, {}, 'rate_limited'], [403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }, 'rate_limited'], [403, { error: 'denied' }, 'forbidden'], [401, {}, 'needs_reauthorization']] as const) {
    const { ctx, mem } = mkCtx((u) => (u.includes('oauth2') ? { body: { access_token: 'AT' } } : u.includes('/messages?') ? { status, body } : undefined));
    await connect(mem, 'A', 'gmail');
    await fails(H.gmailAction('A', { action: 'list' }, ctx), status === 403 && code === 'rate_limited' ? 429 : status, code);
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

// ---------- apple ----------
test('apple developer token: valid ES256 JWT verifiable with the public key; server secrets required', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  const tok = await signAppleDeveloperToken({ teamId: 'TEAM', keyId: 'KID', privateKeyPem: pem.replace(/\n/g, '\\n'), nowSec: 1000, ttlSec: 3600 });
  const [h, p, s] = tok.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'ES256', kid: 'KID', typ: 'JWT' });
  assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url').toString()), { iss: 'TEAM', iat: 1000, exp: 4600 });
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${p}`)));
  const { ctx } = mkCtx(() => undefined);
  await fails(H.appleDeveloperToken(ctx), 501, 'not_configured');
  const ok = mkCtx(() => undefined, memDb(), { ...ENV, APPLE_TEAM_ID: 'T', APPLE_KEY_ID: 'K', APPLE_PRIVATE_KEY: pem });
  assert.equal((await H.appleDeveloperToken(ok.ctx)).token.split('.').length, 3);
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
  await fails(H.gmailAction('A', { action: 'list' }, ctx), 409, 'not_connected');
});
