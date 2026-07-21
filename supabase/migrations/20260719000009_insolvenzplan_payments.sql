create table public.insolvenzplan_payments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.insolvenzplan(id) on delete cascade,
  installment_no int not null,
  due_date date not null,
  amount numeric(12,2) not null,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_plan_payments_plan on public.insolvenzplan_payments(plan_id);

alter table public.insolvenzplan_payments enable row level security;
create policy "firm_access_plan_payments" on public.insolvenzplan_payments for all
  using (exists (
    select 1 from public.insolvenzplan ip
    join public.cases c on c.id = ip.case_id
    where ip.id = plan_id and c.firm_id = public.current_firm_id()
  ))
  with check (exists (
    select 1 from public.insolvenzplan ip
    join public.cases c on c.id = ip.case_id
    where ip.id = plan_id and c.firm_id = public.current_firm_id()
  ));
