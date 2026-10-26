import { disconnect, calendarImport, finishOAuth, healthIngest, sheetsPreview, spotifyToken, startOAuth } from './handlers.ts';
import { gmailAction } from './gmailApi.ts';
import { driveAction } from './driveApi.ts';
import { type Ctx, HttpError } from './ports.ts';

type UserRoute = (userId: string, body: any, ctx: Ctx) => Promise<unknown>;

/** Routes that act on behalf of a signed-in user. The gateway's JWT check is OFF for this function, so each of these verifies the caller itself. */
const USER_ROUTES: Record<string, UserRoute> = {
  'oauth-start': startOAuth,
  'oauth-disconnect': disconnect,
  'gmail': gmailAction,
  'drive-backup': driveAction,
  'calendar-import': (u, _b, c) => calendarImport(u, c),
  'sheets-preview': sheetsPreview,
  'spotify-token': (u, _b, c) => spotifyToken(u, c),
};

export function cors(req: Request, ctx: Ctx): Record<string, string> {
  const allowed = (ctx.env.ALLOWED_ORIGINS ?? ctx.env.APP_URL ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  const origin = req.headers.get('origin')?.replace(/\/$/, '') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
  };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

/**
 * Single entrypoint. `verifyUser` resolves a bearer token to a user id (or null). Three authentication schemes:
 *  - user routes: Supabase session JWT, verified here
 *  - oauth-callback: no JWT possible (browser redirect); identity comes from the one-time `state`
 *  - health-ingest: per-user ingest token (hash looked up server-side)
 */
export async function handleRequest(req: Request, ctx: Ctx, verifyUser: (token: string) => Promise<string | null>): Promise<Response> {
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '';
  const h = cors(req, ctx);
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    if (route === 'oauth-callback') {
      if (req.method !== 'GET') throw new HttpError(405, 'method_not_allowed');
      const u = new URL(req.url);
      const to = await finishOAuth({ code: u.searchParams.get('code'), state: u.searchParams.get('state'), error: u.searchParams.get('error') }, ctx);
      return new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } });
    }

    if (route === 'health-ingest') {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      return json(200, await healthIngest(req.headers.get('authorization'), await req.json().catch(() => null), ctx));
    }

    const fn = Object.prototype.hasOwnProperty.call(USER_ROUTES, route) ? USER_ROUTES[route] : undefined;
    if (!fn) throw new HttpError(404, 'not_found');
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const userId = token ? await verifyUser(token) : null;
    if (!userId) throw new HttpError(401, 'unauthorized');
    return json(200, await fn(userId, await req.json().catch(() => ({})), ctx), h);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message }, h);
    // Name + short message only: never the request, headers, tokens, or message content.
    console.error('api error:', (e as Error)?.name, String((e as Error)?.message ?? '').slice(0, 200));
    return json(500, { error: 'internal', message: 'Something went wrong.' }, h);
  }
}
