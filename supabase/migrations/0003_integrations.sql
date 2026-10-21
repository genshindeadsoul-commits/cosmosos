-- 0003: integration plumbing. OAuth state, status constraint, health ingest tokens.

-- One-time OAuth state. RLS on with NO policies: only Edge Functions (service role) touch it.
create table public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);
alter table public.oauth_states enable row level security;
revoke all on public.oauth_states from anon, authenticated;

alter table public.integration_connections
  add constraint integration_status_chk
  check (status in ('not_connected','connected','needs_reauthorization','error'));

-- Workout imports must be idempotent.
alter table public.workouts add column external_id text;
create unique index workouts_external_uniq on public.workouts (user_id, source, external_id) where external_id is not null;

-- Health ingest tokens for a companion app. Plaintext is shown once; only a SHA-256 hash is stored.
create table public.health_ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null default 'Companion app',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.health_ingest_tokens enable row level security;
create policy health_tokens_select_own on public.health_ingest_tokens for select to authenticated using (user_id = auth.uid());
revoke all on public.health_ingest_tokens from anon, authenticated;
grant select (id, label, created_at, last_used_at, revoked_at, user_id) on public.health_ingest_tokens to authenticated;

create or replace function public.create_health_ingest_token(p_label text default 'Companion app') returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  t := 'cosmos_h_' || encode(gen_random_bytes(32), 'hex');
  insert into public.health_ingest_tokens (user_id, label, token_hash)
  values (auth.uid(), left(coalesce(nullif(p_label,''),'Companion app'), 80), encode(digest(t, 'sha256'), 'hex'));
  return t;
end $$;

create or replace function public.revoke_health_ingest_token(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.health_ingest_tokens set revoked_at = now() where id = p_id and user_id = auth.uid() and revoked_at is null
$$;
revoke all on function public.create_health_ingest_token(text), public.revoke_health_ingest_token(uuid) from public, anon;
grant execute on function public.create_health_ingest_token(text), public.revoke_health_ingest_token(uuid) to authenticated;
create unique index integration_one_per_provider on public.integration_connections (user_id, provider);
