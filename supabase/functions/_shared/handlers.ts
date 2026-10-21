import { encryptJson, randomHex, sha256Hex } from './crypto.ts';
import { signAppleDeveloperToken } from './jwt.ts';
import { extractBody, headerMap, normalizeGoogleEvent, validateHealthPayload } from './parse.ts';
import { isProvider, PROVIDERS, type Provider } from './providers.ts';
import { type Ctx, HttpError } from './ports.ts';
import { getAccessToken, providerFetch, requireEnv, tokenRequestInit } from './tokens.ts';

const callbackUrl = (ctx: Ctx) => `${ctx.env.SUPABASE_URL}/functions/v1/oauth-callback`;

// ---------------- OAuth ----------------
export async function startOAuth(userId: string, body: any, ctx: Ctx): Promise<{ url: string }> {
  if (!isProvider(body?.provider)) throw new HttpError(400, 'bad_provider');
  const provider: Provider = body.provider;
  const cfg = PROVIDERS[provider];
  requireEnv(ctx, [cfg.clientIdEnv, cfg.clientSecretEnv, 'TOKEN_ENCRYPTION_KEY', 'SUPABASE_URL', 'APP_URL']);
  const state = randomHex(32);
  await ctx.db.insertState(state, userId, provider);
  const u = new URL(cfg.authUrl);
  u.search = new URLSearchParams({
    client_id: ctx.env[cfg.clientIdEnv]!, redirect_uri: callbackUrl(ctx), response_type: 'code',
    scope: cfg.scopes.join(' '), state, ...cfg.extraAuthParams,
  }).toString();
  return { url: u.toString() };
}

/** Returns the URL to redirect the browser to. Never throws: every failure becomes a readable redirect. */
export async function finishOAuth(params: { code?: string | null; state?: string | null; error?: string | null }, ctx: Ctx): Promise<string> {
  const back = (q: Record<string, string>) => `${ctx.env.APP_URL ?? '/'}?${new URLSearchParams(q)}`;
  if (params.error) return back({ integration_error: params.error === 'access_denied' ? 'Permission was declined.' : `Provider error: ${params.error}` });
  if (!params.code || !params.state) return back({ integration_error: 'Missing authorization response.' });
  const st = await ctx.db.consumeState(params.state);            // one-time, expiry-checked, deleted on read
  if (!st) return back({ integration_error: 'Sign-in link expired or was already used. Try connecting again.' });
  const { userId, provider } = st;
  const cfg = PROVIDERS[provider];
  try {
    requireEnv(ctx, [cfg.clientIdEnv, cfg.clientSecretEnv, 'TOKEN_ENCRYPTION_KEY']);
    const tr = await ctx.fetch(cfg.tokenUrl, tokenRequestInit(provider, { grant_type: 'authorization_code', code: params.code, redirect_uri: callbackUrl(ctx) }, ctx));
    const tok = await tr.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; scope?: string; error?: string };
    if (!tr.ok || !tok.access_token) throw new Error('Token exchange failed.');
    const granted = (tok.scope ?? cfg.scopes.join(' ')).split(/[ ,]+/).filter(Boolean);
    if (!granted.includes(cfg.requiredScope)) {
      await ctx.db.saveConnection(userId, provider, { status: 'error', granted_scopes: granted, last_error: 'The required permission was not granted. Reconnect and allow access.' });
      return back({ integration: provider, integration_error: 'The required permission was not granted.' });
    }
    if (!tok.refresh_token) throw new Error('Provider did not return a refresh token. Remove the app from your account permissions and reconnect.');

    // "Connected" only after a REAL API call succeeds with this token.
    const vr = await ctx.fetch(cfg.verifyUrl, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!vr.ok) {
      await ctx.db.saveConnection(userId, provider, { status: 'error', granted_scopes: granted, last_error: `Verification call failed (${vr.status}).` });
      return back({ integration: provider, integration_error: `Could not verify access (${vr.status}). Check that the API is enabled for your project.` });
    }
    const info = await vr.json().catch(() => ({})) as any;
    const label: string | null = info.emailAddress ?? info.email ?? info.display_name ?? null;
    const id = await ctx.db.saveConnection(userId, provider, { status: 'connected', account_label: label, granted_scopes: granted, last_error: null });
    await ctx.db.saveSecret(id, await encryptJson({ refresh_token: tok.refresh_token }, ctx.env.TOKEN_ENCRYPTION_KEY!));
    return back({ integration: provider, result: 'connected' });
  } catch (e) {
    await ctx.db.saveConnection(userId, provider, { status: 'error', last_error: (e as Error).message.slice(0, 300) });
    return back({ integration: provider, integration_error: (e as Error).message.slice(0, 200) });
  }
}

export async function disconnect(userId: string, body: any, ctx: Ctx): Promise<{ ok: true }> {
  if (!isProvider(body?.provider)) throw new HttpError(400, 'bad_provider');
  const provider: Provider = body.provider;
  const conn = await ctx.db.getConnection(userId, provider);
  if (conn) {
    if (provider !== 'spotify') {                                 // best-effort revoke at Google
      try {
        const { accessToken } = await getAccessToken(userId, provider, ctx);
        await ctx.fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, { method: 'POST' });
      } catch { /* already revoked/expired: still disconnect locally */ }
    }
    await ctx.db.deleteSecret(conn.id);
    await ctx.db.saveConnection(userId, provider, { status: 'not_connected', account_label: null, granted_scopes: [], last_error: null, last_synced_at: null });
  }
  return { ok: true };
}

// ---------------- Gmail (default view = All Mail: no label filter) ----------------
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GMAIL_ID = /^[0-9a-f]{8,32}$/i;

export async function gmailAction(userId: string, body: any, ctx: Ctx) {
  const { accessToken } = await getAccessToken(userId, 'gmail', ctx);
  if (body?.action === 'list') {
    const q = typeof body.q === 'string' ? body.q.slice(0, 300) : '';
    const params = new URLSearchParams({ maxResults: '25' });
    if (q) params.set('q', q);
    if (typeof body.pageToken === 'string' && body.pageToken.length < 500) params.set('pageToken', body.pageToken);
    const list = await providerFetch(userId, 'gmail', `${GMAIL}/messages?${params}`, accessToken, ctx);
    const ids: string[] = (list.messages ?? []).map((m: any) => m.id);
    const metas = await Promise.all(ids.map((id) => providerFetch(userId, 'gmail',
      `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, accessToken, ctx)));
    await ctx.db.saveConnection(userId, 'gmail', { last_synced_at: ctx.now().toISOString(), last_error: null });
    return {
      messages: metas.map((m: any) => ({ id: m.id, threadId: m.threadId, ...headerMap(m.payload?.headers), snippet: m.snippet ?? '', unread: (m.labelIds ?? []).includes('UNREAD') })),
      nextPageToken: list.nextPageToken ?? null, estimate: list.resultSizeEstimate ?? 0,
    };
  }
  if (body?.action === 'get') {
    if (typeof body.id !== 'string' || !GMAIL_ID.test(body.id)) throw new HttpError(400, 'bad_id');
    const m = await providerFetch(userId, 'gmail', `${GMAIL}/messages/${body.id}?format=full`, accessToken, ctx);
    const { text, attachments } = extractBody(m.payload);
    return { id: m.id, threadId: m.threadId, ...headerMap(m.payload?.headers), bodyText: text, attachments,
      webLink: `https://mail.google.com/mail/u/0/#all/${m.id}` };
  }
  throw new HttpError(400, 'bad_action');
}

// ---------------- Calendar (one-way import) ----------------
export async function calendarImport(userId: string, ctx: Ctx) {
  const { accessToken } = await getAccessToken(userId, 'google_calendar', ctx);
  const now = ctx.now();
  const min = new Date(now.getTime() - 30 * 864e5).toISOString(), max = new Date(now.getTime() + 365 * 864e5).toISOString();
  const events = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const p = new URLSearchParams({ timeMin: min, timeMax: max, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    if (pageToken) p.set('pageToken', pageToken);
    const r = await providerFetch(userId, 'google_calendar', `https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`, accessToken, ctx);
    for (const e of r.items ?? []) { const n = normalizeGoogleEvent(e); if (n) events.push(n); }
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  await ctx.db.saveConnection(userId, 'google_calendar', { last_synced_at: now.toISOString(), last_error: null });
  return { events, truncated: Boolean(pageToken) };
}

// ---------------- Sheets (read-only preview for import) ----------------
export async function sheetsPreview(userId: string, body: any, ctx: Ctx) {
  if (typeof body?.spreadsheetId !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(body.spreadsheetId)) throw new HttpError(400, 'bad_spreadsheet_id');
  const range = typeof body.range === 'string' && /^[A-Za-z0-9_!:$' ]{1,80}$/.test(body.range) ? body.range : 'A1:Z200';
  const { accessToken } = await getAccessToken(userId, 'google_sheets', ctx);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${body.spreadsheetId}`;
  const [meta, vals] = await Promise.all([
    providerFetch(userId, 'google_sheets', `${base}?fields=properties.title`, accessToken, ctx),
    providerFetch(userId, 'google_sheets', `${base}/values/${encodeURIComponent(range)}`, accessToken, ctx),
  ]);
  return { title: meta.properties?.title ?? 'Sheet', values: (vals.values ?? []).slice(0, 1000) };
}

// ---------------- Music ----------------
export async function spotifyToken(userId: string, ctx: Ctx) {
  const { accessToken, expiresIn } = await getAccessToken(userId, 'spotify', ctx);
  return { access_token: accessToken, expires_in: expiresIn };
}

export async function appleDeveloperToken(ctx: Ctx) {
  requireEnv(ctx, ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY']);
  const nowSec = Math.floor(ctx.now().getTime() / 1000);
  const token = await signAppleDeveloperToken({ teamId: ctx.env.APPLE_TEAM_ID!, keyId: ctx.env.APPLE_KEY_ID!, privateKeyPem: ctx.env.APPLE_PRIVATE_KEY!, nowSec, ttlSec: 3600 });
  return { token, expires_at: nowSec + 3600 };
}

// ---------------- Health ingest (companion app, bearer ingest token) ----------------
export async function healthIngest(authHeader: string | null, body: any, ctx: Ctx) {
  const m = authHeader?.match(/^Bearer (cosmos_h_[0-9a-f]{64})$/);
  if (!m) throw new HttpError(401, 'unauthorized');
  const tok = await ctx.db.findIngestToken(await sha256Hex(m[1]));
  if (!tok) throw new HttpError(401, 'unauthorized');
  const v = validateHealthPayload(body);
  if (!v.ok) throw new HttpError(400, 'invalid_payload', v.error);
  const existing = await ctx.db.existingExternalIds(tok.userId, v.rows.map((r) => r.externalId));
  const fresh = v.rows.filter((r) => !existing.has(r.externalId));
  const inserted = fresh.length ? await ctx.db.insertWorkouts(tok.userId, fresh.map((r) => ({
    title: r.title, workout_date: r.date, duration_minutes: r.durationMinutes ?? null, calories: r.calories ?? null,
    notes: r.notes ?? null, exercises: [], source: 'health_connect', external_id: r.externalId }))) : 0;
  await ctx.db.touchIngestToken(tok.id);
  await ctx.db.saveConnection(tok.userId, 'health_connect', { status: 'connected', last_synced_at: ctx.now().toISOString(), last_error: null, account_label: 'Companion app' });
  return { received: v.rows.length, inserted, duplicates: v.rows.length - fresh.length };
}
