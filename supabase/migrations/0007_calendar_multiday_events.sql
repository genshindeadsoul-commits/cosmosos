-- Migration 0007: Add end_date, all_day and color to calendar_events for multi-day events
alter table public.calendar_events
  add column if not exists end_date date,
  add column if not exists all_day boolean not null default false,
  add column if not exists color text;

create index if not exists idx_calendar_events_user_dates
  on public.calendar_events (user_id, event_date, end_date);

-- Notify PostgREST to reload its schema cache
notify pgrst, 'reload schema';
