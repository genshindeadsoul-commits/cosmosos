import { requireSupabase } from '../lib/supabase';
import {
  CosmosAppData, RowSet, TABLE_ORDER, TableName, PK, ChangePlan, SaveFailure, findInvalidIds, fromRows, toRows, planChanges,
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

/**
 * Apply a diff table by table. A failure in one table never blocks the others, and each failed table is reported
 * so the caller can keep ITS edits pending (unsaved) while the rest are marked saved.
 */
export async function applyChanges(plan: ChangePlan): Promise<SaveFailure[]> {
  const sb = requireSupabase();
  const failed = new Map<TableName, SaveFailure>();
  const fail = (table: TableName, e: { message: string; code?: string }) => { if (!failed.has(table)) failed.set(table, { table, message: e.message, code: e.code }); };

  // Never send a non-UUID to a uuid column: report it instead of poisoning the batch.
  for (const bad of findInvalidIds(plan)) fail(bad.table, { message: `invalid input syntax for type uuid: "${bad.value}"` });

  for (const t of TABLE_ORDER) {
    const rows = plan.upserts[t];
    if (!rows?.length || failed.has(t)) continue;
    try {
      const { error } = await sb.from(t).upsert(rows as never, { onConflict: PK[t].join(',') });
      if (error) fail(t, error);
    } catch (e) { fail(t, { message: (e as Error).message }); }          // network exceptions
  }
  for (const t of [...TABLE_ORDER].reverse() as TableName[]) {
    const rows = plan.deletes[t];
    if (!rows?.length || failed.has(t)) continue;
    try {
      for (const r of rows) {
        let q = sb.from(t).delete();
        for (const c of PK[t]) q = q.eq(c, r[c] as string);
        const { error } = await q;
        if (error) { fail(t, error); break; }
      }
    } catch (e) { fail(t, { message: (e as Error).message }); }
  }
  return [...failed.values()];
}

export { planChanges, toRows };
