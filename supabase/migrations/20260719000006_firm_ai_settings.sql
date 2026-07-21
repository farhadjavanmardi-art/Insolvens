create table public.firm_ai_settings (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic')),
  api_key text not null,
  dpa_confirmed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.firm_ai_settings enable row level security;

create policy "firm_access_ai_settings" on public.firm_ai_settings for all
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());
