import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseDb } from './supabaseDb.ts';
import type { Ctx } from './ports.ts';

export function makeCtx(): Ctx {
  const env = Deno.env.toObject();
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return { env, db: supabaseDb(admin), fetch, now: () => new Date() };
}

/** Verify a session JWT with Supabase Auth (never trust unverified claims). */
export function makeVerifier(ctx: Ctx) {
  const sb = createClient(ctx.env.SUPABASE_URL!, (ctx.env.SUPABASE_ANON_KEY ?? ctx.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } });
  return async (token: string): Promise<string | null> => {
    const { data, error } = await sb.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  };
}
