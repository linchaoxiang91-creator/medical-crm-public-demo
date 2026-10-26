-- V3 PILOT ONLY: fictional client codes and nonmedical financial numbers.
-- Apply to a NEW private Supabase project, never public GitHub Pages storage.
create extension if not exists pgcrypto;
create table public.pilot_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','agent')),
 display_name text not null,
 active boolean not null default true
);
create table public.pilot_clients (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 client_code text not null check(length(client_code) between 1 and 60),
 project text not null check(length(project) between 1 and 80),
 stage text not null default '咨询中' check(stage in ('咨询中','已预约','赴日中','服务完成','待回访')),
 contract_amount numeric(12,2) not null default 0 check(contract_amount>=0),
 received_amount numeric(12,2) not null default 0 check(received_amount>=0),
 cost_amount numeric(12,2) not null default 0 check(cost_amount>=0),
 commission_amount numeric(12,2) not null default 0 check(commission_amount>=0),
 created_at timestamptz not null default now(),
 check(received_amount<=contract_amount)
);
create index pilot_clients_owner_idx on public.pilot_clients(owner_id);
alter table public.pilot_profiles enable row level security;
alter table public.pilot_clients enable row level security;
create or replace function public.pilot_is_admin()
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.pilot_profiles p where p.user_id=(select auth.uid()) and p.role='admin' and p.active)$$;
create or replace function public.pilot_is_active()
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.pilot_profiles p where p.user_id=(select auth.uid()) and p.active)$$;
revoke all on function public.pilot_is_admin() from public;
revoke all on function public.pilot_is_active() from public;
grant execute on function public.pilot_is_admin() to authenticated;
grant execute on function public.pilot_is_active() to authenticated;
create policy pilot_profiles_read on public.pilot_profiles for select to authenticated
using(user_id=(select auth.uid()) or public.pilot_is_admin());
create policy pilot_clients_read on public.pilot_clients for select to authenticated
using(public.pilot_is_active() and (owner_id=(select auth.uid()) or public.pilot_is_admin()));
create policy pilot_clients_insert on public.pilot_clients for insert to authenticated
with check(public.pilot_is_active() and owner_id=(select auth.uid()));
create policy pilot_clients_update on public.pilot_clients for update to authenticated
using(public.pilot_is_active() and owner_id=(select auth.uid()))
with check(public.pilot_is_active() and owner_id=(select auth.uid()));
-- Intentionally no DELETE and no client-facing profile writes.
-- Admin changes and agent invitations must be performed through trusted admin operations.
-- Never use real patient details in this pilot schema.
