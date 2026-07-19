alter table public.documents add column if not exists content text;
alter table public.deadlines add column if not exists updated_at timestamptz not null default now();
alter table public.tasks add column if not exists updated_at timestamptz not null default now();
