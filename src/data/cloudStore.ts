import { requireSupabase } from '../lib/supabase';
import {
  CosmosAppData, RowSet, TABLE_ORDER, TableName, PK, ChangePlan, fromRows, toRows, planChanges,
} from './cloudData';

type Row = Record<string, unknown>;

/** Load every table for the signed-in user. RLS scopes results; no user_id filter is trusted. */
export async function loadUserData(): Promise<{ data: CosmosAppData; rows: RowSet }> {
  const sb = requireSupabase();
  const results = await Promise.all(TABLE_ORDER.map((t) => sb.from(t).select('*').limit(10000)));
  const rows = {} as RowSet;
  TABLE_ORDER.forEach((t, i) => {
    const { data, error } = results[i];
    if (error) throw new Error(`Failed to load ${t}: ${error.message}`);
    rows[t] = (data ?? []) as Row[];
  });
  // Normalize to exactly what toRows() would emit so the first diff is empty.
  const data = fromRows(rows);
  return { data, rows: toRows(data) };
}

/** Apply a diff. Throws on the first failure so the caller keeps its old snapshot and retries. */
export async function applyChanges(plan: ChangePlan): Promise<void> {
  const sb = requireSupabase();
  for (const t of TABLE_ORDER) {
    const rows = plan.upserts[t];
    if (rows?.length) {
      const { error } = await sb.from(t).upsert(rows as never, { onConflict: PK[t].join(',') });
      if (error) throw new Error(`Saving ${t} failed: ${error.message}`);
    }
  }
  for (const t of [...TABLE_ORDER].reverse() as TableName[]) {
    const rows = plan.deletes[t];
    if (!rows?.length) continue;
    for (const r of rows) {
      let q = sb.from(t).delete();
      for (const c of PK[t]) q = q.eq(c, r[c] as string);
      const { error } = await q;
      if (error) throw new Error(`Deleting from ${t} failed: ${error.message}`);
    }
  }
}

export { planChanges, toRows };
