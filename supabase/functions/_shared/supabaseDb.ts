import type { ConnPatch, DbPort } from './ports.ts';
import type { Provider } from './providers.ts';

/** Service-role implementation. `sb` is a supabase-js client created with the service role key (server only). */
export function supabaseDb(sb: any): DbPort {
  const must = (r: { data: any; error: { message: string } | null }): any => { if (r.error) throw new Error(r.error.message); return r.data; };
  return {
    async insertState(state, userId, provider) { must(await sb.from('oauth_states').insert({ state, user_id: userId, provider })); },
    async consumeState(state) {
      const rows = must(await sb.from('oauth_states').delete().eq('state', state).select()) as any[];
      const r = rows?.[0];
      if (!r || new Date(r.expires_at).getTime() < Date.now()) return null;
      return { userId: r.user_id, provider: r.provider as Provider };
    },
    async getConnection(userId, provider) {
      const r = must(await sb.from('integration_connections').select('id,status').eq('user_id', userId).eq('provider', provider).maybeSingle());
      return r ? { id: r.id, status: r.status } : null;
    },
    async saveConnection(userId, provider, patch: ConnPatch) {
      const ex = await this.getConnection(userId, provider);
      if (ex) { must(await sb.from('integration_connections').update(patch).eq('id', ex.id)); return ex.id; }
      const r = must(await sb.from('integration_connections').insert({ user_id: userId, provider, ...patch }).select('id').single());
      return r.id;
    },
    async getSecret(id) { const r = must(await sb.from('integration_secrets').select('encrypted_token').eq('connection_id', id).maybeSingle()); return r?.encrypted_token ?? null; },
    async saveSecret(id, enc) { must(await sb.from('integration_secrets').upsert({ connection_id: id, encrypted_token: enc }, { onConflict: 'connection_id' })); },
    async deleteSecret(id) { must(await sb.from('integration_secrets').delete().eq('connection_id', id)); },
    async findIngestToken(hash) {
      const r = must(await sb.from('health_ingest_tokens').select('id,user_id').eq('token_hash', hash).is('revoked_at', null).maybeSingle());
      return r ? { id: r.id, userId: r.user_id } : null;
    },
    async touchIngestToken(id) { must(await sb.from('health_ingest_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', id)); },
    async existingExternalIds(userId, ids) {
      const rows = must(await sb.from('workouts').select('external_id').eq('user_id', userId).eq('source', 'health_connect').in('external_id', ids)) as any[];
      return new Set(rows.map((r) => r.external_id as string));
    },
    async insertWorkouts(userId, rows) {
      const { error } = await sb.from('workouts').insert(rows.map((r) => ({ ...r, user_id: userId })));
      if (error && error.code !== '23505') throw new Error(error.message);  // 23505 = a concurrent duplicate: already stored
      return error ? 0 : rows.length;
    },
  };
}
