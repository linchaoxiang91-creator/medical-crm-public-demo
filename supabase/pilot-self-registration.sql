-- Execute AFTER pilot.sql. New self-registered accounts remain INACTIVE.
-- This trigger is trusted database code, not client-side approval.
create or replace function public.pilot_register_pending()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.pilot_profiles(user_id,role,display_name,active)
  values(new.id,'agent','待审核代理',false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists pilot_signup_pending on auth.users;
create trigger pilot_signup_pending
after insert on auth.users
for each row execute function public.pilot_register_pending();
-- IMPORTANT: For this first pilot, approve exactly one known agent.
-- Replace the email below in Supabase SQL Editor only (do NOT commit actual email).
-- update public.pilot_profiles set active=true,display_name='试用代理'
-- where user_id=(select id from auth.users where email='AGENT_EMAIL_HERE')
-- and role='agent';
-- For privacy, disable public signup after the single agent has registered.
