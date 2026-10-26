import type {
  Task, CalendarEvent, Note, TableCollection, Transaction, Subscription,
  WorkoutLog, Goal, Habit, CustomTracker,
} from '../types';

/** The user's records as the UI sees them. Supabase is the source of truth. */
export interface CosmosAppData {
  tasks: Task[];
  events: CalendarEvent[];
  notes: Note[];
  tables: TableCollection[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  workouts: WorkoutLog[];
  goals: Goal[];
  habits: Habit[];
  trackers: CustomTracker[];
}

export const EMPTY_DATA: CosmosAppData = {
  tasks: [], events: [], notes: [], tables: [], transactions: [], subscriptions: [],
  workouts: [], goals: [], habits: [], trackers: [],
};

export const newId = (): string => crypto.randomUUID();
export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

type Row = Record<string, unknown>;
const nz = (v: string | undefined | null) => (v === undefined || v === null || v === '' ? null : v);

// ---------- row shapes keyed by table ----------
export type RowSet = Record<TableName, Row[]>;
export type TableName =
  | 'notes' | 'tasks' | 'calendar_events' | 'transactions' | 'subscriptions' | 'workouts' | 'goals'
  | 'habits' | 'habit_checkins' | 'custom_trackers' | 'tracker_entries' | 'data_tables' | 'table_rows';

/** Parents first (upsert order); reversed for deletes. Children also cascade in the DB. */
export const TABLE_ORDER: TableName[] = [
  'notes', 'tasks', 'calendar_events', 'transactions', 'subscriptions', 'workouts', 'goals',
  'habits', 'habit_checkins', 'custom_trackers', 'tracker_entries', 'data_tables', 'table_rows',
];
export const PK: Record<TableName, string[]> = {
  notes: ['id'], tasks: ['id'], calendar_events: ['id'], transactions: ['id'], subscriptions: ['id'],
  workouts: ['id'], goals: ['id'], habits: ['id'], habit_checkins: ['habit_id', 'checkin_date'],
  custom_trackers: ['id'], tracker_entries: ['id'], data_tables: ['id'], table_rows: ['id'],
};

export function toRows(d: CosmosAppData): RowSet {
  return {
    notes: d.notes.map((n) => ({
      id: n.id, title: n.title, content: n.content, excerpt: n.excerpt, starred: !!n.starred, tags: n.tags ?? [],
    })),
    tasks: d.tasks.map((t) => ({
      id: t.id, title: t.title, description: nz(t.description), list_name: t.list, status: t.status, priority: t.priority,
      due_date: nz(t.dueDate), due_time: nz(t.dueTime), is_focus: !!t.isFocus,
      linked_note_id: nz(t.linkedNoteId), recurrence: nz(t.recurrence), completed_at: nz(t.completedAt),
    })),
    calendar_events: d.events.map((e) => ({
      id: e.id, title: e.title, description: nz(e.description), event_date: e.date, start_time: e.startTime ?? '',
      end_time: e.endTime ?? '', category: e.category, location: nz(e.location), source: e.source, provider_id: nz(e.providerId),
    })),
    transactions: d.transactions.map((t) => ({
      id: t.id, type: t.type, category: t.category, description: t.description ?? '', amount: Math.abs(t.amount),
      tx_date: t.date, tx_time: nz(t.time), notes: nz(t.notes),
    })),
    subscriptions: d.subscriptions.map((s) => ({
      id: s.id, name: s.name, amount: Math.abs(s.amount), billing_cycle: s.billingCycle, renewal_date: s.renewalDate,
    })),
    workouts: d.workouts.map((w) => ({
      id: w.id, title: w.title, workout_date: w.date, duration_minutes: w.durationMinutes, calories: w.calories,
      exercises: w.exercises ?? [], notes: nz(w.notes),
    })),
    goals: d.goals.map((g) => ({
      id: g.id, title: g.title, category: g.category, current_value: g.current, target_value: g.target,
      unit: g.unit ?? '', target_date: nz(g.targetDate), completed: !!g.completed,
    })),
    habits: d.habits.map((h) => ({ id: h.id, name: h.name, category: h.category })),
    habit_checkins: d.habits.flatMap((h) =>
      Object.entries(h.checkins ?? {}).filter(([, done]) => done).map(([date]) => ({ habit_id: h.id, checkin_date: date }))),
    custom_trackers: d.trackers.map((t) => ({ id: t.id, name: t.name, unit: t.unit ?? '', target_per_day: t.targetPerDay })),
    tracker_entries: d.trackers.flatMap((t) =>
      t.entries.map((e) => ({ id: e.id, tracker_id: t.id, entry_date: e.date, value: e.value, notes: nz(e.notes) }))),
    data_tables: d.tables.map((t) => ({ id: t.id, name: t.name, description: t.description ?? '', columns: t.columns })),
    table_rows: d.tables.flatMap((t) =>
      t.rows.map((r, i) => { const { id, ...rest } = r; return { id, table_id: t.id, position: i, data: rest }; })),
  };
}

/** Consecutive-day streak ending today or yesterday, computed from saved check-ins only. */
export function computeStreak(checkins: Record<string, boolean>, today = new Date()): number {
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cur = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!checkins[fmt(cur)]) cur.setDate(cur.getDate() - 1);
  let n = 0;
  while (checkins[fmt(cur)]) { n++; cur.setDate(cur.getDate() - 1); }
  return n;
}

const s = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => (v == null ? 0 : Number(v));
const date10 = (v: unknown) => (v == null ? '' : String(v).slice(0, 10));

export function fromRows(r: RowSet, today = new Date()): CosmosAppData {
  const checkinsByHabit = new Map<string, Record<string, boolean>>();
  for (const c of r.habit_checkins) {
    const k = s(c.habit_id);
    const m = checkinsByHabit.get(k) ?? {};
    m[date10(c.checkin_date)] = true;
    checkinsByHabit.set(k, m);
  }
  const entriesByTracker = new Map<string, CustomTracker['entries']>();
  for (const e of r.tracker_entries) {
    const k = s(e.tracker_id);
    const arr = entriesByTracker.get(k) ?? [];
    arr.push({ id: s(e.id), date: date10(e.entry_date), value: num(e.value), notes: (e.notes as string) ?? undefined });
    entriesByTracker.set(k, arr);
  }
  const rowsByTable = new Map<string, Row[]>();
  for (const row of [...r.table_rows].sort((a, b) => num(a.position) - num(b.position))) {
    const k = s(row.table_id);
    const arr = rowsByTable.get(k) ?? [];
    arr.push({ id: s(row.id), ...(row.data as Row) });
    rowsByTable.set(k, arr);
  }
  return {
    notes: r.notes.map((n) => ({
      id: s(n.id), title: s(n.title), content: s(n.content), excerpt: s(n.excerpt), starred: !!n.starred,
      tags: (n.tags as string[]) ?? [], createdAt: s(n.created_at), updatedAt: s(n.updated_at),
    })),
    tasks: r.tasks.map((t) => ({
      id: s(t.id), title: s(t.title), description: (t.description as string) ?? undefined, list: s(t.list_name) as Task['list'],
      status: s(t.status) as Task['status'], priority: s(t.priority) as Task['priority'], dueDate: date10(t.due_date),
      dueTime: (t.due_time as string) ?? undefined, isFocus: !!t.is_focus, linkedNoteId: (t.linked_note_id as string) ?? undefined,
      recurrence: (t.recurrence as Task['recurrence']) ?? undefined,
      createdAt: s(t.created_at), completedAt: (t.completed_at as string) ?? undefined,
    })),
    events: r.calendar_events.map((e) => ({
      id: s(e.id), title: s(e.title), description: (e.description as string) ?? undefined, date: date10(e.event_date),
      startTime: s(e.start_time), endTime: s(e.end_time), category: s(e.category), location: (e.location as string) ?? undefined,
      source: s(e.source) as CalendarEvent['source'], providerId: (e.provider_id as string) ?? undefined,
    })),
    transactions: r.transactions.map((t) => ({
      id: s(t.id), type: s(t.type) as Transaction['type'], category: s(t.category) as Transaction['category'],
      description: s(t.description), amount: num(t.amount), date: date10(t.tx_date),
      time: (t.tx_time as string) ?? undefined, notes: (t.notes as string) ?? undefined,
    })),
    subscriptions: r.subscriptions.map((x) => ({
      id: s(x.id), name: s(x.name), amount: num(x.amount), billingCycle: s(x.billing_cycle) as Subscription['billingCycle'],
      renewalDate: date10(x.renewal_date),
    })),
    workouts: r.workouts.map((w) => ({
      id: s(w.id), title: s(w.title), date: date10(w.workout_date), durationMinutes: num(w.duration_minutes), calories: num(w.calories),
      exercises: (w.exercises as WorkoutLog['exercises']) ?? [], notes: (w.notes as string) ?? undefined,
    })),
    goals: r.goals.map((g) => ({
      id: s(g.id), title: s(g.title), category: s(g.category) as Goal['category'], current: num(g.current_value),
      target: num(g.target_value), unit: s(g.unit), targetDate: date10(g.target_date), completed: !!g.completed,
    })),
    habits: r.habits.map((h) => {
      const checkins = checkinsByHabit.get(s(h.id)) ?? {};
      return { id: s(h.id), name: s(h.name), category: s(h.category), checkins, streak: computeStreak(checkins, today) } as Habit;
    }),
    trackers: r.custom_trackers.map((t) => ({
      id: s(t.id), name: s(t.name), unit: s(t.unit), targetPerDay: num(t.target_per_day), entries: entriesByTracker.get(s(t.id)) ?? [],
    })),
    tables: r.data_tables.map((t) => ({
      id: s(t.id), name: s(t.name), description: s(t.description), columns: (t.columns as TableCollection['columns']) ?? [],
      rows: (rowsByTable.get(s(t.id)) ?? []) as TableCollection['rows'], updatedAt: s(t.updated_at),
    })),
  };
}

// ---------- diff ----------
export interface ChangePlan {
  upserts: Partial<Record<TableName, Row[]>>;
  deletes: Partial<Record<TableName, Row[]>>; // rows holding only the PK columns
  isEmpty: boolean;
}
const keyOf = (table: TableName, row: Row) => PK[table].map((c) => s(row[c])).join('|');
const canon = (row: Row) => JSON.stringify(Object.keys(row).sort().map((k) => [k, row[k]]));

export function planChanges(prev: RowSet, next: RowSet): ChangePlan {
  const plan: ChangePlan = { upserts: {}, deletes: {}, isEmpty: true };
  for (const t of TABLE_ORDER) {
    const before = new Map(prev[t].map((r) => [keyOf(t, r), canon(r)]));
    const afterKeys = new Set<string>();
    const up: Row[] = [];
    for (const r of next[t]) {
      const k = keyOf(t, r);
      afterKeys.add(k);
      if (before.get(k) !== canon(r)) up.push(r);
    }
    const del: Row[] = prev[t].filter((r) => !afterKeys.has(keyOf(t, r))).map((r) => Object.fromEntries(PK[t].map((c) => [c, r[c]])));
    if (up.length) { plan.upserts[t] = up; plan.isEmpty = false; }
    if (del.length) { plan.deletes[t] = del; plan.isEmpty = false; }
  }
  return plan;
}

// ---------- ID safety ----------
/**
 * Every id stored in a uuid column must be a real UUID. If anything (a view, an import, old state) ever hands us a
 * temporary id like "r-1792730074210", rewrite it ONCE to a fresh UUID and keep every reference consistent
 * (task -> note link, table -> rows, tracker -> entries). Returns the same object when nothing needed fixing,
 * so it is safe to run on every state update.
 */
export function healIds(d: CosmosAppData): { data: CosmosAppData; map: Map<string, string> } {
  const map = new Map<string, string>();
  let changed = false;
  const fix = (id: unknown): string => {
    if (isUuid(id)) return id;
    changed = true;
    const key = String(id ?? '');
    if (!map.has(key)) map.set(key, newId());
    return map.get(key)!;
  };
  const withId = <T extends { id: string }>(arr: T[]): T[] => arr.map((x) => (isUuid(x.id) ? x : { ...x, id: fix(x.id) }));

  const notes = withId(d.notes);
  const noteIds = new Set(notes.map((n) => n.id));
  const tasks = withId(d.tasks).map((t) => {
    if (!t.linkedNoteId || (isUuid(t.linkedNoteId) && noteIds.has(t.linkedNoteId))) return t;
    changed = true;                                          // remapped note, or a dangling link: never send it to a foreign key
    const mapped = map.get(t.linkedNoteId);
    return { ...t, linkedNoteId: mapped && noteIds.has(mapped) ? mapped : undefined };
  });
  const trackers = withId(d.trackers).map((t) => (t.entries.every((e) => isUuid(e.id)) ? t : { ...t, entries: withId(t.entries) }));
  const tables = withId(d.tables).map((t) => (t.rows.every((r) => isUuid(r.id as string)) ? t : { ...t, rows: t.rows.map((r) => (isUuid(r.id as string) ? r : { ...r, id: fix(r.id) })) }));
  if (!changed) return { data: d, map };
  return { data: { ...d, notes, tasks, trackers, tables, events: withId(d.events), transactions: withId(d.transactions), subscriptions: withId(d.subscriptions), workouts: withId(d.workouts), goals: withId(d.goals), habits: withId(d.habits) }, map };
}

/** Defense in depth: which tables would send a non-UUID to a uuid column? (Should always be empty after healIds.) */
export const UUID_COLUMNS: Record<string, string[]> = {
  notes: ['id'], tasks: ['id', 'linked_note_id'], calendar_events: ['id'], transactions: ['id'], subscriptions: ['id'], workouts: ['id'], goals: ['id'],
  habits: ['id'], habit_checkins: ['habit_id'], custom_trackers: ['id'], tracker_entries: ['id', 'tracker_id'], data_tables: ['id'], table_rows: ['id', 'table_id'],
};
export function findInvalidIds(plan: ChangePlan): { table: TableName; value: string }[] {
  const bad: { table: TableName; value: string }[] = [];
  for (const t of TABLE_ORDER) for (const row of plan.upserts[t] ?? []) for (const c of UUID_COLUMNS[t]) {
    const v = row[c]; if (v != null && !isUuid(v)) bad.push({ table: t, value: String(v) });
  }
  return bad;
}

// ---------- readable save errors ----------
export interface SaveFailure { table: TableName; message: string; code?: string }
const MODULE_OF: Record<TableName, string> = {
  notes: 'Notes', tasks: 'Tasks', calendar_events: 'Calendar', transactions: 'Expenses', subscriptions: 'Expenses', workouts: 'Fitness', goals: 'Goals',
  habits: 'Habits', habit_checkins: 'Habits', custom_trackers: 'Trackers', tracker_entries: 'Trackers', data_tables: 'Tables', table_rows: 'Tables',
};
const reasonFor = (f: SaveFailure): string => {
  const m = f.message;
  if (/invalid input syntax for type uuid/i.test(m)) return 'an item had an invalid ID';
  if (f.code === '42501' || /row-level security|permission denied/i.test(m)) return 'your account isn’t allowed to save this';
  if (f.code === '23503' || /foreign key/i.test(m)) return 'it points at a record that no longer exists';
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(m)) return 'network problem';
  if (/jwt|token.*expired|not authenticated/i.test(m)) return 'your session expired: sign in again';
  return m.replace(/^Saving \w+ failed: /, '').slice(0, 140);
};
/** One actionable sentence per affected module. Edits are never discarded on failure. */
export function describeSaveFailures(failures: SaveFailure[]): string {
  const byModule = new Map<string, string>();
  for (const f of failures) if (!byModule.has(MODULE_OF[f.table])) byModule.set(MODULE_OF[f.table], reasonFor(f));
  const parts = [...byModule].map(([mod, why]) => `${mod} (${why})`);
  return `Couldn’t save ${parts.join('; ')}. Your edits are kept on this page. Press Retry.`;
}
