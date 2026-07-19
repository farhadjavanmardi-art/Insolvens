-- ==========================================================
-- InsolvenzFlow - Initial Schema
-- ==========================================================

-- Profiles (extends auth.users) - lawyers / staff of the office
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'lawyer' check (role in ('admin','lawyer','paralegal')),
  email text,
  created_at timestamptz not null default now()
);

-- Clients (Schuldner - debtors who are the office's clients)
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  address text,
  date_of_birth date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

-- Cases (Insolvenzverfahren)
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique,
  client_id uuid not null references public.clients(id) on delete cascade,
  case_type text not null default 'regelinsolvenz' check (case_type in ('regelinsolvenz','verbraucherinsolvenz','unternehmensinsolvenz')),
  status text not null default 'intake' check (status in ('intake','antrag_vorbereitung','antrag_eingereicht','eroeffnet','plan_phase','abgeschlossen','abgelehnt')),
  court text,
  court_case_number text,
  filing_date date,
  opening_date date,
  responsible_lawyer uuid references public.profiles(id),
  total_debt numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Creditors (Glaeubiger) per case
create table public.creditors (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  address text,
  email text,
  claim_amount numeric(14,2) not null default 0,
  rank text not null default 'einfach' check (rank in ('einfach','absonderung','nachrangig','massegläubiger')),
  claim_status text not null default 'gemeldet' check (claim_status in ('gemeldet','anerkannt','bestritten','zurueckgewiesen')),
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

-- Documents generated or uploaded per case
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  doc_type text not null,
  title text not null,
  file_path text,
  status text not null default 'entwurf' check (status in ('entwurf','fertig','versendet','archiviert')),
  generated_by_ai boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

-- Deadlines (Fristen) per case
create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  status text not null default 'offen' check (status in ('offen','erledigt','verpasst')),
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now()
);

-- Tasks (internal office tasks)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id),
  due_date date,
  status text not null default 'offen' check (status in ('offen','in_arbeit','erledigt')),
  priority text not null default 'normal' check (priority in ('niedrig','normal','hoch','dringend')),
  created_at timestamptz not null default now()
);

-- Insolvenzplan (payment plan) entries
create table public.insolvenzplan (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  monthly_payment numeric(12,2),
  duration_months int,
  total_plan_amount numeric(14,2),
  start_date date,
  status text not null default 'entwurf' check (status in ('entwurf','eingereicht','genehmigt','laufend','abgeschlossen')),
  notes text,
  created_at timestamptz not null default now()
);

-- Activity log (audit trail)
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_cases_client on public.cases(client_id);
create index idx_creditors_case on public.creditors(case_id);
create index idx_documents_case on public.documents(case_id);
create index idx_deadlines_case on public.deadlines(case_id);
create index idx_deadlines_due on public.deadlines(due_date);
create index idx_tasks_case on public.tasks(case_id);
create index idx_activity_case on public.activity_log(case_id);

-- ==========================================================
-- Row Level Security
-- ==========================================================
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.cases enable row level security;
alter table public.creditors enable row level security;
alter table public.documents enable row level security;
alter table public.deadlines enable row level security;
alter table public.tasks enable row level security;
alter table public.insolvenzplan enable row level security;
alter table public.activity_log enable row level security;

-- Simple policy: any authenticated staff member (has a profiles row) can access everything.
-- This can be tightened later (e.g. per-lawyer visibility) once roles are finalized.
create policy "staff_full_access_profiles" on public.profiles for all
  using (auth.uid() is not null);

create policy "staff_full_access_clients" on public.clients for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

create policy "staff_full_access_cases" on public.cases for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

create policy "staff_full_access_creditors" on public.creditors for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

create policy "staff_full_access_documents" on public.documents for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

create policy "staff_full_access_deadlines" on public.deadlines for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

create policy "staff_full_access_tasks" on public.tasks for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

create policy "staff_full_access_plan" on public.insolvenzplan for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

create policy "staff_full_access_activity" on public.activity_log for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()));

-- Auto-create a profile row when a new user signs up via Supabase Auth
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
