-- 0004: tighten function exposure flagged by the Supabase security advisor.

-- Trigger-only function: nobody should be able to call it through the REST API. Triggers do not check
-- EXECUTE at fire time, so signup still creates the profile.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Used inside RLS policies / admin checks for signed-in users only.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Pin the search path (defends against search_path hijacking).
alter function public.touch_updated_at() set search_path = '';
