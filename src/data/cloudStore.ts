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
      let { error } = await sb.from(t).upsert(rows as never, { onConflict: PK[t].join(',') });
      // Schema cache fallback for migration 0005: preserve note content if note_date column is not yet in DB
      if (error && t === 'notes' && (/note_date.*schema cache/i.test(error.message) || /column notes\.note_date does not exist/i.test(error.message))) {
        const stripped = rows.map((r) => { const { note_date, ...rest } = r as any; return rest; });
        const retry = await sb.from(t).upsert(stripped as never, { onConflict: PK[t].join(',') });
        if (!retry.error) {
          console.warn('Saved notes without note_date column (database needs migration 0005_note_dates.sql)');
          error = null;
        }
      }
      // Schema cache fallback for migration 0006: preserve transaction if title column is not yet in DB
      if (error && t === 'transactions' && (/title.*schema cache/i.test(error.message) || /column transactions\.title does not exist/i.test(error.message))) {
        const stripped = rows.map((r) => {
          const { title, description, ...rest } = r as any;
          return { ...rest, description: title ? (description ? `${title}: ${description}` : title) : description };
        });
        const retry = await sb.from(t).upsert(stripped as never, { onConflict: PK[t].join(',') });
        if (!retry.error) {
          console.warn('Saved transactions without title column (database needs migration 0006_transaction_title.sql)');
          error = null;
        }
      }
      // Schema cache fallback for migration 0008: preserve transaction if account columns not yet in DB
      if (error && t === 'transactions' && (/(account|transfer_account|tags).*schema cache/i.test(error.message) || /column.*(account|transfer_account|tags).*does not exist/i.test(error.message))) {
        const stripped = rows.map((r) => {
          const { account, transfer_account, tags, ...rest } = r as any;
          return rest;
        });
        const retry = await sb.from(t).upsert(stripped as never, { onConflict: PK[t].join(',') });
        if (!retry.error) {
          console.warn('Saved transactions without account columns (database needs migration 0008_finance_ledger_overhaul.sql)');
          error = null;
        }
      }
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
