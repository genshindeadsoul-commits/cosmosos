import { decryptJson, encryptJson } from './crypto.ts';
import { PROVIDERS, type Provider } from './providers.ts';
import { type Ctx, HttpError } from './ports.ts';

interface StoredSecret { refresh_token: string }

function requireEnv(ctx: Ctx, names: string[]): void {
  const missing = names.filter((n) => !ctx.env[n]);
  if (missing.length) throw new HttpError(501, 'not_configured', `Missing server secrets: ${missing.join(', ')}`);
}

export function tokenRequestInit(provider: Provider, params: Record<string, string>, ctx: Ctx): RequestInit {
  const cfg = PROVIDERS[provider];
  const id = ctx.env[cfg.clientIdEnv]!, secret = ctx.env[cfg.clientSecretEnv]!;
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const body = new URLSearchParams(params);
  if (provider === 'spotify') headers.Authorization = `Basic ${btoa(`${id}:${secret}`)}`;
  else { body.set('client_id', id); body.set('client_secret', secret); }
  return { method: 'POST', headers, body };
}

/** Exchange the stored refresh token for a short-lived access token. Never returned for Google; only Spotify's is handed to the browser. */
export async function getAccessToken(userId: string, provider: Provider, ctx: Ctx): Promise<{ accessToken: string; expiresIn: number }> {
  const cfg = PROVIDERS[provider];
  requireEnv(ctx, [cfg.clientIdEnv, cfg.clientSecretEnv, 'TOKEN_ENCRYPTION_KEY']);
  const conn = await ctx.db.getConnection(userId, provider);
  if (!conn || conn.status === 'not_connected') throw new HttpError(409, 'not_connected', 'This service is not connected.');
  if (conn.status === 'needs_reauthorization') throw new HttpError(401, 'needs_reauthorization', 'Reconnect this service in Settings.');
  const packed = await ctx.db.getSecret(conn.id);
  if (!packed) throw new HttpError(409, 'not_connected', 'No stored credential.');
  const secret = await decryptJson<StoredSecret>(packed, ctx.env.TOKEN_ENCRYPTION_KEY!);

  const res = await ctx.fetch(cfg.tokenUrl, tokenRequestInit(provider, { grant_type: 'refresh_token', refresh_token: secret.refresh_token }, ctx));
  const json = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    if (json.error === 'invalid_grant' || res.status === 400 || res.status === 401) {
      await ctx.db.saveConnection(userId, provider, { status: 'needs_reauthorization', last_error: 'Authorization expired or was revoked.' });
      throw new HttpError(401, 'needs_reauthorization', 'Authorization expired or was revoked. Reconnect in Settings.');
    }
    throw new HttpError(502, 'token_refresh_failed', 'Provider token refresh failed.');
  }
  if (json.refresh_token && json.refresh_token !== secret.refresh_token) {
    await ctx.db.saveSecret(conn.id, await encryptJson({ refresh_token: json.refresh_token }, ctx.env.TOKEN_ENCRYPTION_KEY!));
  }
  return { accessToken: json.access_token, expiresIn: json.expires_in ?? 3600 };
}

export { requireEnv };

/** Call a provider API and return the raw Response; auth/rate failures become stable errors the UI can show. */
export async function providerRequest(userId: string, provider: Provider, url: string, token: string, ctx: Ctx, init?: { method?: string; json?: unknown; body?: BodyInit; headers?: Record<string, string> }): Promise<Response> {
  const res = await ctx.fetch(url, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(init?.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers ?? {}) },
    ...(init?.json !== undefined ? { body: JSON.stringify(init.json) } : init?.body !== undefined ? { body: init.body } : {}),
  });
  if (res.status === 401) {
    await ctx.db.saveConnection(userId, provider, { status: 'needs_reauthorization', last_error: 'Provider rejected the access token.' });
    throw new HttpError(401, 'needs_reauthorization', 'Reconnect this service in Settings.');
  }
  if (res.status === 429 || res.status === 403) {
    const body = await res.json().catch(() => ({}));
    const reason = JSON.stringify(body).toLowerCase();
    if (res.status === 429 || reason.includes('ratelimit') || reason.includes('quota')) {
      throw new HttpError(429, 'rate_limited', `Rate limited by ${provider}. Try again shortly.`);
    }
    throw new HttpError(403, 'forbidden', 'The provider denied this request (permission or account restriction).');
  }
  if (res.status === 404) throw new HttpError(404, 'not_found', `${provider} could not find that item.`);
  if (!res.ok) throw new HttpError(502, 'provider_error', `${provider} returned ${res.status}.`);
  return res;
}

export async function providerFetch(userId: string, provider: Provider, url: string, token: string, ctx: Ctx, init?: { method?: string; json?: unknown }): Promise<any> {
  return (await providerRequest(userId, provider, url, token, ctx, init)).json();
}
