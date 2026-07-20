-- ==========================================================
-- Multi-tenancy: each law firm (Kanzlei) is isolated from others
-- ==========================================================

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists firm_id uuid references public.firms(id);
alter table public.clients add column if not exists firm_id uuid references public.firms(id);
alter table public.cases add column if not exists firm_id uuid references public.firms(id);

-- Backfill: if any rows already exist without a firm, group them into one legacy firm
-- so nothing is silently deleted or orphaned.
do $$
declare
  legacy_firm_id uuid;
  needs_backfill boolean;
begin
  select exists(select 1 from public.profiles where firm_id is null) into needs_backfill;
  if needs_backfill then
    insert into public.firms (name) values ('Legacy Kanzlei (bitte manuell aufteilen)')
    returning id into legacy_firm_id;

    update public.profiles set firm_id = legacy_firm_id where firm_id is null;
    update public.clients set firm_id = legacy_firm_id where firm_id is null;
    update public.cases set firm_id = legacy_firm_id where firm_id is null;
  end if;
end $$;

alter table public.profiles alter column firm_id set not null;
alter table public.clients alter column firm_id set not null;
alter table public.cases alter column firm_id set not null;

create index if not exists idx_profiles_firm on public.profiles(firm_id);
create index if not exists idx_clients_firm on public.clients(firm_id);
create index if not exists idx_cases_firm on public.cases(firm_id);

-- Helper function: current user's firm_id (avoids recursive RLS lookups)
create or replace function public.current_firm_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select firm_id from public.profiles where id = auth.uid();
$$;

-- On signup: create a new firm for the user and attach their profile to it.
-- (Team invites to join an existing firm can be layered on top of this later.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_firm_id uuid;
begin
  insert into public.firms (name)
  values (coalesce(new.raw_user_meta_data->>'full_name', new.email) || '''s Kanzlei')
  returning id into new_firm_id;

  insert into public.profiles (id, email, full_name, firm_id)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), new_firm_id);

  return new;
end;
$$;

-- ==========================================================
-- Replace open "any staff" policies with firm-scoped policies
-- ==========================================================

drop policy if exists "staff_full_access_profiles" on public.profiles;
drop policy if exists "staff_full_access_clients" on public.clients;
drop policy if exists "staff_full_access_cases" on public.cases;
drop policy if exists "staff_full_access_creditors" on public.creditors;
drop policy if exists "staff_full_access_documents" on public.documents;
drop policy if exists "staff_full_access_deadlines" on public.deadlines;
drop policy if exists "staff_full_access_tasks" on public.tasks;
drop policy if exists "staff_full_access_plan" on public.insolvenzplan;
drop policy if exists "staff_full_access_activity" on public.activity_log;

create policy "same_firm_profiles" on public.profiles for select
  using (firm_id = public.current_firm_id());
create policy "self_update_profile" on public.profiles for update
  using (id = auth.uid());

create policy "firm_access_clients" on public.clients for all
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

create policy "firm_access_cases" on public.cases for all
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

create policy "firm_access_creditors" on public.creditors for all
  using (exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id()))
  with check (exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id()));

create policy "firm_access_documents" on public.documents for all
  using (exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id()))
  with check (exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id()));

create policy "firm_access_deadlines" on public.deadlines for all
  using (exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id()))
  with check (exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id()));

create policy "firm_access_tasks" on public.tasks for all
  using (
    case_id is null or exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id())
  )
  with check (
    case_id is null or exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id())
  );

create policy "firm_access_plan" on public.insolvenzplan for all
  using (exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id()))
  with check (exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id()));

create policy "firm_access_activity" on public.activity_log for all
  using (
    case_id is null or exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id())
  )
  with check (
    case_id is null or exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id())
  );

alter table public.firms enable row level security;
create policy "own_firm_only" on public.firms for select
  using (id = public.current_firm_id());
