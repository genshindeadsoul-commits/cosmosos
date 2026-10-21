-- Cosmos OS 0001: multi-user schema with Row Level Security.
-- Every user-owned table has user_id defaulting to auth.uid(); policies enforce it.
-- Children reference parents through (id, user_id) composite keys so a row can
-- never point at another user's parent record.

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- identity ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admins live in their own table. No client policy allows writes, so a user
-- cannot grant themselves admin. Assign the first admin with the service role
-- (see docs/SETUP.md).
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid())
$$;

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Auto-create profile + settings on signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- core data ----------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 500),
  content text not null default '',
  excerpt text not null default '',
  starred boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  description text,
  list_name text not null default 'Inbox',
  status text not null default 'todo' check (status in ('todo','in_progress','completed')),
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH')),
  due_date date,
  due_time text,
  is_focus boolean not null default false,
  linked_note_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (linked_note_id, user_id) references public.notes (id, user_id) on delete set null (linked_note_id)
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  description text,
  event_date date not null,
  start_time text not null default '',
  end_time text not null default '',
  category text not null default 'General',
  location text,
  source text not null default 'local' check (source in ('local','google_calendar')),
  provider_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
-- imported events must not duplicate
create unique index calendar_events_provider_uniq
  on public.calendar_events (user_id, source, provider_id) where provider_id is not null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  category text not null,
  description text not null default '',
  amount numeric(14,2) not null check (amount >= 0),   -- sign comes from `type`
  tx_date date not null,
  tx_time text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  billing_cycle text not null check (billing_cycle in ('monthly','yearly')),
  renewal_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  workout_date date not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0), -- null = not recorded, never 0
  calories integer check (calories is null or calories >= 0),
  exercises jsonb not null default '[]'::jsonb,
  notes text,
  source text not null default 'manual' check (source in ('manual','health_connect','google_fit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  category text not null,
  current_value numeric not null default 0,
  target_value numeric not null check (target_value >= 0),
  unit text not null default '',
  target_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'General',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.habit_checkins (
  habit_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checkin_date date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, checkin_date),            -- no duplicate check-ins
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create table public.custom_trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  unit text not null default '',
  target_per_day numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.tracker_entries (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null,
  value numeric not null,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (tracker_id, user_id) references public.custom_trackers (id, user_id) on delete cascade
);

create table public.data_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  columns jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.table_rows (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_id, user_id) references public.data_tables (id, user_id) on delete cascade
);

-- Provider connection STATUS only. Tokens never live here.
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail','google_calendar','google_drive','google_sheets','spotify','apple_music','health_connect','whatsapp')),
  account_label text,
  status text not null default 'not_connected',
  granted_scopes text[] not null default '{}',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, account_label)
);
-- Refresh/access tokens: RLS on, NO policies => unreachable from the browser.
-- Only Edge Functions using the service role may touch this table.
create table public.integration_secrets (
  connection_id uuid primary key references public.integration_connections(id) on delete cascade,
  encrypted_token text not null,
  updated_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index on public.notes (user_id, updated_at desc);
create index on public.tasks (user_id, status, due_date);
create index on public.calendar_events (user_id, event_date);
create index on public.transactions (user_id, tx_date);
create index on public.workouts (user_id, workout_date);
create index on public.tracker_entries (user_id, tracker_id, entry_date);
create index on public.table_rows (user_id, table_id, position);

-- ---------- RLS: owner-only for every user-owned table ----------
do $$
declare t text;
begin
  foreach t in array array['notes','tasks','calendar_events','transactions','subscriptions',
    'workouts','goals','habits','habit_checkins','custom_trackers','tracker_entries',
    'data_tables','table_rows','integration_connections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s_select_own" on public.%1$I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "%1$s_insert_own" on public.%1$I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s_update_own" on public.%1$I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s_delete_own" on public.%1$I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
  -- updated_at triggers
  foreach t in array array['notes','tasks','calendar_events','transactions','subscriptions','workouts',
    'goals','habits','custom_trackers','data_tables','table_rows','integration_connections','profiles','user_settings'] loop
    execute format('create trigger touch_%1$s before update on public.%1$I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- user_settings: own row only
alter table public.user_settings enable row level security;
create policy user_settings_select_own on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy user_settings_insert_own on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy user_settings_update_own on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- profiles: own row; users may change display_name/avatar only. Admin status is NOT on this table.
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- admin tables: locked down. app_admins readable only by the owner of the row (so the UI can ask "am I admin").
alter table public.app_admins enable row level security;
create policy app_admins_self on public.app_admins for select to authenticated using (user_id = auth.uid());
alter table public.admin_audit_events enable row level security;
create policy audit_admin_read on public.admin_audit_events for select to authenticated using (public.is_admin());
alter table public.integration_secrets enable row level security;  -- intentionally no policies

-- ---------- admin overview: aggregate counts only, never private content ----------
create or replace function public.admin_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into public.admin_audit_events (actor_id, action) values (auth.uid(), 'admin_overview_viewed');
  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'integrations_by_status', coalesce((select jsonb_object_agg(status, n) from
        (select status, count(*) n from public.integration_connections group by status) s), '{}'::jsonb),
    'integrations_with_errors', (select count(*) from public.integration_connections where last_error is not null)
  );
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ---------- table privileges ----------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on
  public.notes, public.tasks, public.calendar_events, public.transactions, public.subscriptions,
  public.workouts, public.goals, public.habits, public.habit_checkins, public.custom_trackers,
  public.tracker_entries, public.data_tables, public.table_rows, public.integration_connections
  to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select on public.profiles, public.app_admins, public.admin_audit_events to authenticated;
revoke all on public.integration_secrets from authenticated, anon;

-- Belt and braces: Supabase default privileges may grant more than intended.
revoke insert, delete, truncate on public.profiles, public.app_admins, public.admin_audit_events from authenticated;
revoke delete, truncate on public.user_settings from authenticated;
