import { encryptJson, randomHex, sha256Hex } from './crypto.ts';
import { normalizeGoogleEvent, validateHealthPayload } from './parse.ts';
import { GMAIL_SCOPE, isGmailCapability, isProvider, PROVIDERS, type Provider } from './providers.ts';
import { type Ctx, HttpError } from './ports.ts';
import { getAccessToken, providerFetch, requireEnv, tokenRequestInit } from './tokens.ts';

const callbackUrl = (ctx: Ctx) => `${ctx.env.SUPABASE_URL}/functions/v1/oauth-callback`;

// ---------------- OAuth ----------------
export async function startOAuth(userId: string, body: any, ctx: Ctx): Promise<{ url: string }> {
  if (!isProvider(body?.provider)) throw new HttpError(400, 'bad_provider');
  const provider: Provider = body.provider;
  const cfg = PROVIDERS[provider];
  requireEnv(ctx, [cfg.clientIdEnv, cfg.clientSecretEnv, 'TOKEN_ENCRYPTION_KEY', 'SUPABASE_URL', 'APP_URL']);
  // Gmail: ask for more than read-only ONLY when the user enables that feature. Existing grants are kept.
  const caps: string[] = provider === 'gmail' && Array.isArray(body.capabilities) ? [...new Set(body.capabilities.filter(isGmailCapability))] as string[] : [];
  if (provider !== 'gmail' && body.capabilities !== undefined) throw new HttpError(400, 'bad_capabilities');
  const scopes = [...cfg.scopes, ...caps.map((c) => GMAIL_SCOPE[c as 'modify' | 'send'])];
  const state = randomHex(32);
  await ctx.db.insertState(state, userId, provider);
  const u = new URL(cfg.authUrl);
  u.search = new URLSearchParams({
    client_id: ctx.env[cfg.clientIdEnv]!, redirect_uri: callbackUrl(ctx), response_type: 'code',
    scope: scopes.join(' '), state, ...cfg.extraAuthParams, ...(caps.length ? { include_granted_scopes: 'true' } : {}),
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
