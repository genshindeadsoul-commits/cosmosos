-- Recurring tasks: completing one spawns the next occurrence (done client-side, one row per occurrence).
alter table public.tasks
  add column recurrence text check (recurrence in ('daily','weekly','monthly'));
