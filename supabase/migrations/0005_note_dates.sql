-- Migration 0005: Add note_date to notes table for calendar date association
alter table notes add column if not exists note_date date;

create index if not exists idx_notes_user_note_date on notes (user_id, note_date) where note_date is not null;
