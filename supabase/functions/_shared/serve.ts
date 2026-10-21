import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseDb } from './supabaseDb.ts';
import { type Ctx, HttpError } from './ports.ts';

export function makeCtx(): Ctx {
  const env = Deno.env.toObject();
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return { env, db: supabaseDb(admin), fetch, now: () => new Date() };
}

export function cors(req: Request, ctx: Ctx): Record<string, string> {
  const allowed = (ctx.env.ALLOWED_ORIGINS ?? ctx.env.APP_URL ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  const origin = req.headers.get('origin')?.replace(/\/$/, '') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
  };
}

const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

/** Wrapper for authenticated user calls: verifies the caller's JWT with Supabase Auth, then runs `fn(userId, body)`. */
export function serveUser(fn: (userId: string, body: any, ctx: Ctx) => Promise<unknown>) {
  Deno.serve(async (req) => {
    const ctx = makeCtx();
    const h = cors(req, ctx);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
      const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
      if (!token) throw new HttpError(401, 'unauthorized');
      const sb = createClient(ctx.env.SUPABASE_URL!, (ctx.env.SUPABASE_ANON_KEY ?? ctx.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data.user) throw new HttpError(401, 'unauthorized');
      const body = await req.json().catch(() => ({}));
      return json(200, await fn(data.user.id, body, ctx), h);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message }, h);
      console.error(e);                                  // details to logs only, never to the client or with tokens
      return json(500, { error: 'internal', message: 'Something went wrong.' }, h);
    }
  });
}
