-- Give each creditor a private access token for the public portal (no full account needed)
alter table public.creditors add column if not exists access_token uuid not null default gen_random_uuid();
create unique index if not exists idx_creditors_access_token on public.creditors(access_token);

-- Security-definer function: safe, narrow public read for the creditor portal.
-- Only returns the fields a creditor should see about their own claim, matched by token.
create or replace function public.get_creditor_portal(p_token uuid)
returns table (
  creditor_name text,
  claim_amount numeric,
  rank text,
  claim_status text,
  case_number text,
  case_status text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    cr.name,
    cr.claim_amount,
    cr.rank,
    cr.claim_status,
    c.case_number,
    c.status
  from public.creditors cr
  join public.cases c on c.id = cr.case_id
  where cr.access_token = p_token;
$$;

revoke all on function public.get_creditor_portal(uuid) from public;
grant execute on function public.get_creditor_portal(uuid) to anon, authenticated;
