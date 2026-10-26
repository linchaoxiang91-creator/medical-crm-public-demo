-- Link Health V3: PostgreSQL/Supabase starting schema (NOT deployed).
-- Run only after configuring a PRIVATE project, region, legal basis and data handling.
create extension if not exists pgcrypto;

create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 kind text not null check (kind in ('platform','agency','insurance')),
 created_at timestamptz not null default now()
);
create table public.memberships (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 organization_id uuid not null references public.organizations(id),
 role text not null check (role in ('platform_admin','agency_manager','agent')),
 active boolean not null default true,
 unique(user_id,organization_id)
);
-- SECURITY DEFINER avoids recursive membership policy lookups. No arbitrary user arguments.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.role='platform_admin' and m.active); $$;
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.organization_id=org and m.active); $$;
create or replace function public.is_org_manager(org uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.organization_id=org and m.role='agency_manager' and m.active); $$;

create table public.referrals (
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.organizations(id),
 agent_user_id uuid not null references auth.users(id),
 customer_code text not null, -- pseudonymous reference; no diagnosis, phone or full name
 created_at timestamptz not null default now(),
 unique(id,agency_id,agent_user_id)
);
create table public.commission_rules (
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.organizations(id),
 agent_user_id uuid references auth.users(id),
 project_code text not null,
 mode text not null check(mode in ('percent','fixed')),
 rate numeric(10,4) not null check(rate>=0),
 calculation_base text not null check(calculation_base in ('received','contracted')),
 active boolean not null default true,
 valid_from timestamptz not null default now(),
 valid_until timestamptz,
 check ((mode <> 'percent' or rate<=100) and (valid_until is null or valid_until>valid_from))
);
create table public.service_orders (
 id uuid primary key default gen_random_uuid(),
 referral_id uuid not null references public.referrals(id),
 project_code text not null,
 contracted_amount numeric(14,2) not null check(contracted_amount>=0),
 received_amount numeric(14,2) not null default 0 check(received_amount>=0),
 completed boolean not null default false,
 created_at timestamptz not null default now(),
 check(received_amount<=contracted_amount)
);
create table public.commissions (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.service_orders(id),
 rule_id uuid references public.commission_rules(id),
 snapshot_mode text check(snapshot_mode in ('percent','fixed')),
 snapshot_rate numeric(10,4) check(snapshot_rate>=0),
 snapshot_base text check(snapshot_base in ('received','contracted')),
 amount numeric(14,2) not null default 0 check(amount>=0),
 state text not null default 'estimated' check(state in ('estimated','review','approved','paid','held','void')),
 approved_by uuid references auth.users(id),
 paid_at timestamptz,
 updated_at timestamptz not null default now()
);
create table public.commission_audit (
 id uuid primary key default gen_random_uuid(),
 commission_id uuid not null references public.commissions(id),
 actor_id uuid not null references auth.users(id),
 event text not null,
 details jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now()
);
create index on public.memberships(user_id,organization_id);
create index on public.referrals(agency_id,agent_user_id);
create index on public.service_orders(referral_id);
create index on public.commissions(order_id);

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.referrals enable row level security;
alter table public.commission_rules enable row level security;
alter table public.service_orders enable row level security;
alter table public.commissions enable row level security;
alter table public.commission_audit enable row level security;

create policy org_read on public.organizations for select to authenticated
 using(public.is_platform_admin() or public.is_org_member(id));
create policy membership_read on public.memberships for select to authenticated
 using(public.is_platform_admin() or user_id=(select auth.uid()) or public.is_org_manager(organization_id));
create policy referral_read on public.referrals for select to authenticated
 using(public.is_platform_admin() or agent_user_id=(select auth.uid()) or public.is_org_manager(agency_id));
create policy rule_read on public.commission_rules for select to authenticated
 using(public.is_platform_admin() or (public.is_org_member(agency_id) and (agent_user_id is null or agent_user_id=(select auth.uid()) or public.is_org_manager(agency_id))));
create policy order_read on public.service_orders for select to authenticated
 using(public.is_platform_admin() or exists(select 1 from public.referrals r where r.id=referral_id and (r.agent_user_id=(select auth.uid()) or public.is_org_manager(r.agency_id))));
create policy commission_read on public.commissions for select to authenticated
 using(public.is_platform_admin() or exists(select 1 from public.service_orders o join public.referrals r on r.id=o.referral_id where o.id=order_id and (r.agent_user_id=(select auth.uid()) or public.is_org_manager(r.agency_id))));
create policy audit_read on public.commission_audit for select to authenticated using(public.is_platform_admin());

-- NO client-side INSERT/UPDATE/DELETE policies: all writes must go through a
-- separately reviewed trusted server with authenticated actor, transactional
-- commission snapshots, payment approval, immutable audit, and refund reversal.
-- Do not store medical records in these channel-visible tables.
-- Bootstrap first platform_admin using a trusted server/admin SQL operation,
-- never from an untrusted browser. Never expose service-role keys to frontend.
