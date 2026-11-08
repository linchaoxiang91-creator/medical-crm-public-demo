-- LINK HEALTH registration: clients automatically enabled after email verification;
-- partners (agents) require administrator approval. Never promote account roles from
-- self-editable metadata to admin. Data access remains controlled by RLS + case binding.
-- Run in the private Supabase project, after pilot.sql and lh case policies.

create or replace function public.pilot_register_pending()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  signup_type text := coalesce(new.raw_user_meta_data->>'account_type','patient');
begin
  if signup_type = 'agent' then
    insert into public.pilot_profiles(user_id,role,display_name,active)
    values(new.id,'agent','待审核合作伙伴',false)
    on conflict(user_id) do nothing;
  else
    insert into public.pilot_profiles(user_id,role,display_name,active)
    values(new.id,'patient','健康服务用户',true)
    on conflict(user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists pilot_signup_pending on auth.users;
create trigger pilot_signup_pending
after insert on auth.users
for each row execute function public.pilot_register_pending();

-- Prevent a newly auto-enabled patient from creating an agent's case.
drop policy if exists lh_cases_insert on public.lh_cases;
create policy lh_cases_insert on public.lh_cases for insert to authenticated
with check (
  (select public.pilot_is_admin())
  or (
    (select public.pilot_is_active())
    and exists (
      select 1 from public.pilot_profiles p
      where p.user_id=(select auth.uid()) and p.role='agent' and p.active
    )
    and agent_id=(select auth.uid())
    and patient_id is null and stage='咨询中'
    and created_by=(select auth.uid())
  )
);

-- Email confirmation remains enforced by Supabase Auth.
-- A newly registered client sees an empty personal dashboard until an admin
-- explicitly binds the clinical case to the correct verified user ID.
