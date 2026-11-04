-- Migration 0005: Add note_date to notes table for calendar date association
alter table public.notes add column if not exists note_date date;

create index if not exists idx_notes_user_note_date on public.notes (user_id, note_date) where note_date is not null;

-- Notify PostgREST to reload its schema cache
notify pgrst, 'reload schema';
