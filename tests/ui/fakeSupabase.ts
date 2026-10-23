// In-memory stand-in for the Supabase client, scoped per "user", enforcing owner isolation like RLS would.
type Row = Record<string, any>;
export const db: Record<string, Record<string, Row[]>> = {};   // userId -> table -> rows
export const fnCalls: { name: string; body: any }[] = [];
export const fnHandlers: Record<string, (body: any) => unknown> = {};
export const failWrites = { on: false };
export const oauthCalls: unknown[] = [];
export const exchange: { result: 'fail' | 'ok'; message: string } = { result: 'fail', message: 'PKCE code verifier not found in storage.' };
export const calls: { op: string; table: string; n?: number }[] = [];
let currentUser: any = null;
const listeners = new Set<(e: string, s: any) => void>();

export function setUser(u: { id: string; email: string } | null, admin = false) {
  currentUser = u ? { id: u.id, email: u.email, user_metadata: { full_name: u.email.split('@')[0] }, __admin: admin } : null;
}
export const session = () => (currentUser ? { user: currentUser } : null);
export const emit = (e: string) => listeners.forEach((l) => l(e, session()));
const tbl = (t: string): Row[] => ((db[currentUser?.id] ??= {})[t] ??= []);

function from(t: string) {
  return {
    select() {
      const filters: [string, any][] = [];
      const rows = () => structuredClone(tbl(t)).filter((r) => filters.every(([c, v]) => r[c] === v));
      const b: any = {
        limit: async () => ({ data: rows(), error: null }),
        order: () => b,
        eq: (c: string, v: any) => { filters.push([c, v]); return b; },
        then: (res: any) => res({ data: rows(), error: null }),
        maybeSingle: async () => {
          if (t === 'app_admins') return { data: currentUser?.__admin ? { user_id: currentUser.id } : null, error: null };
          return { data: rows()[0] ?? (t === 'user_settings' ? { theme: 'dark' } : t === 'profiles' ? { display_name: currentUser?.email.split('@')[0] } : null), error: null };
        },
      };
      return b;
    },
    upsert: async (rows: Row[] | Row) => { if (failWrites.on) return { error: { message: 'simulated outage' } }; const arr = Array.isArray(rows) ? rows : [rows]; calls.push({ op: 'upsert', table: t, n: arr.length });
      for (const r of arr) { const k = tbl(t); const i = k.findIndex((x) => x.id === r.id && x.habit_id === r.habit_id && x.checkin_date === r.checkin_date); if (i >= 0) k[i] = { ...k[i], ...r }; else k.push({ ...r, user_id: currentUser.id }); }
      return { error: null }; },
    update: () => ({ eq: async () => ({ error: null }) }),
    delete() { const f: Row = {}; const q: any = { eq(c: string, v: any) { f[c] = v; return q; }, then(res: any) {
      calls.push({ op: 'delete', table: t }); const k = tbl(t); for (let i = k.length - 1; i >= 0; i--) if (Object.entries(f).every(([c, v]) => k[i][c] === v)) k.splice(i, 1); res({ error: null }); } }; return q; },
  };
}
export const fakeClient = {
  from,
  rpc: async (name: string, args?: any) => {
    if (name === 'create_health_ingest_token') {
      const tok = 'cosmos_h_' + 'ab'.repeat(32); tbl('health_ingest_tokens').push({ id: 'tok1', label: args.p_label, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null });
      return { data: tok, error: null };
    }
    return { data: { total_users: 2, new_users_7d: 1, integrations_by_status: {}, integrations_with_errors: 0 }, error: null };
  },
  functions: { invoke: async (fullName: string, opts: any) => {
    const name = fullName.replace(/^api\//, '');   // client calls the single routed function: api/<route>
    fnCalls.push({ name, body: opts?.body });
    const h = fnHandlers[name];
    if (!h) return { data: null, error: { message: 'Failed to send a request to the Edge Function' } };
    const r = h(opts?.body);
    if (r && (r as any).__error) { const e = (r as any).__error; return { data: null, error: { message: e.message, context: { json: async () => e } } }; }
    return { data: r, error: null };
  } },
  auth: {
    getSession: async () => ({ data: { session: session() }, error: null }),
    onAuthStateChange: (cb: any) => { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
    signInWithOAuth: async (o: unknown) => { oauthCalls.push(o); await new Promise((r) => setTimeout(r, 30)); return { error: null }; },
    exchangeCodeForSession: async (_code: string) => exchange.result === 'ok'
      ? (setUser({ id: 'u1', email: 'alice@x.dev' }), { data: { session: session() }, error: null })
      : { data: { session: null }, error: { message: exchange.message } },
    signOut: async () => { currentUser = null; emit('SIGNED_OUT'); return { error: null }; },
  },
  __listenerCount: () => listeners.size,
};
