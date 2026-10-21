-- Run against a scratch DB after loading tests/auth_stub.sql + migrations.
-- Each check prints PASS/FAIL. Uses SET ROLE + request.jwt.claim.sub like PostgREST does.
\set ON_ERROR_STOP off
create or replace function pg_temp.expect(name text, ok boolean) returns void language plpgsql as
$$ begin raise notice '% : %', case when ok then 'PASS' else 'FAIL' end, name; end $$;

-- fixtures as superuser
insert into auth.users(id,email,raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@test.dev','{"full_name":"Alice"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@test.dev','{"full_name":"Bob"}');
insert into public.app_admins(user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claim.sub', uid, false); end $$;

select pg_temp.expect('profile auto-created for both users', (select count(*) from public.profiles)=2);

-- === Alice writes data ===
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.notes(id,title) values ('11111111-1111-1111-1111-111111111111','Alice secret');
insert into public.tasks(title,linked_note_id) values ('Alice task','11111111-1111-1111-1111-111111111111');
insert into public.habits(id,name) values ('22222222-2222-2222-2222-222222222222','Alice habit');
insert into public.habit_checkins(habit_id,checkin_date) values ('22222222-2222-2222-2222-222222222222','2026-10-19');
select pg_temp.expect('alice sees her note', (select count(*) from public.notes)=1);
do $$ begin
  begin insert into public.notes(user_id,title) values ('bbbbbbbb-0000-0000-0000-000000000002','forged');
        raise notice 'FAIL : forged user_id insert allowed';
  exception when others then raise notice 'PASS : forged user_id insert rejected (%)', sqlstate; end;
end $$;
do $$ begin
  begin insert into public.habit_checkins(habit_id,checkin_date) values ('22222222-2222-2222-2222-222222222222','2026-10-19');
        raise notice 'FAIL : duplicate check-in allowed';
  exception when unique_violation then raise notice 'PASS : duplicate habit check-in rejected'; end;
end $$;

-- === Bob attacks ===
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect('bob cannot SELECT alice note by guessed id',
  (select count(*) from public.notes where id='11111111-1111-1111-1111-111111111111')=0);
select pg_temp.expect('bob sees zero notes/tasks/habits', (select (select count(*) from public.notes)+(select count(*) from public.tasks)+(select count(*) from public.habits))=0);
with u as (update public.notes set title='pwned' where id='11111111-1111-1111-1111-111111111111' returning 1)
select pg_temp.expect('bob UPDATE of alice note affects 0 rows', (select count(*) from u)=0);
with d as (delete from public.notes where id='11111111-1111-1111-1111-111111111111' returning 1)
select pg_temp.expect('bob DELETE of alice note affects 0 rows', (select count(*) from d)=0);
do $$ begin
  begin insert into public.tasks(title,linked_note_id) values ('bob task','11111111-1111-1111-1111-111111111111');
        raise notice 'FAIL : bob linked a task to alice note';
  exception when foreign_key_violation then raise notice 'PASS : cross-user link (task->note) rejected by FK'; end;
end $$;
do $$ begin
  begin insert into public.habit_checkins(habit_id,checkin_date) values ('22222222-2222-2222-2222-222222222222','2026-10-20');
        raise notice 'FAIL : bob attached check-in to alice habit';
  exception when others then raise notice 'PASS : cross-user child insert rejected (%)', sqlstate; end;
end $$;
do $$ begin
  begin insert into public.app_admins(user_id) values ('bbbbbbbb-0000-0000-0000-000000000002');
        raise notice 'FAIL : bob granted himself admin';
  exception when others then raise notice 'PASS : self-grant admin rejected (%)', sqlstate; end;
end $$;
do $$ begin
  begin update public.profiles set email='x@y.z' where id='bbbbbbbb-0000-0000-0000-000000000002';
        raise notice 'FAIL : profile email column updatable';
  exception when insufficient_privilege then raise notice 'PASS : profile non-whitelisted column update rejected'; end;
end $$;
do $$ begin
  begin perform public.admin_overview(); raise notice 'FAIL : ordinary user ran admin_overview';
  exception when insufficient_privilege then raise notice 'PASS : admin_overview rejected for ordinary user'; end;
end $$;
do $$ begin
  begin perform * from public.integration_secrets; raise notice 'FAIL : secrets table readable';
  exception when insufficient_privilege then raise notice 'PASS : integration_secrets unreadable by clients'; end;
end $$;
select pg_temp.expect('bob cannot read alice profile', (select count(*) from public.profiles)=1);

-- === Admin ===
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect('admin overview works and returns counts', (public.admin_overview()->>'total_users')::int=2);
select pg_temp.expect('admin overview call was audited', (select count(*) from public.admin_audit_events)=1);
reset role;

-- ===== 0003 integration checks =====
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
set role authenticated;
create temp table _tok as select public.create_health_ingest_token('phone') as t;
grant all on _tok to authenticated;
select pg_temp.expect('token has expected prefix and length', (select t like 'cosmos_h\_%' and length(t)=73 from _tok));
do $$ begin
  begin perform token_hash from public.health_ingest_tokens; raise notice 'FAIL : token_hash column readable by client';
  exception when insufficient_privilege then raise notice 'PASS : token_hash column unreadable by client'; end;
end $$;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect('bob cannot list alice ingest tokens', (select count(*)=0 from public.health_ingest_tokens));
do $$ begin
  begin insert into public.oauth_states(state,user_id,provider) values ('x','bbbbbbbb-0000-0000-0000-000000000002','gmail');
        raise notice 'FAIL : client wrote oauth_states';
  exception when insufficient_privilege then raise notice 'PASS : oauth_states not writable by clients'; end;
end $$;
do $$ begin
  begin insert into public.integration_connections(provider,status) values ('gmail','definitely_connected');
        raise notice 'FAIL : invalid status accepted';
  exception when check_violation then raise notice 'PASS : invalid integration status rejected'; end;
end $$;
reset role;
select pg_temp.expect('stored value is the SHA-256 hash, not the plaintext token', (select count(*)=1 from public.health_ingest_tokens h, _tok where h.token_hash = encode(digest(_tok.t,'sha256'),'hex') and h.token_hash <> _tok.t));
select pg_temp.expect('ingest idempotency index exists', (select count(*)=1 from pg_indexes where indexname='workouts_external_uniq'));
