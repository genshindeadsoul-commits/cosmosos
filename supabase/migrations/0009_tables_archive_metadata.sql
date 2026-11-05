-- Migration 0009: Tables Archive & Extended Metadata
-- Non-destructive additions to support table archiving and rich view metadata

alter table public.data_tables
  add column if not exists archived boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
