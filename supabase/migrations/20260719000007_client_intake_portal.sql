-- Persistent, shareable intake link per firm
alter table public.firms add column if not exists intake_token uuid not null default gen_random_uuid();
create unique index if not exists idx_firms_intake_token on public.firms(intake_token);

-- Distinguish creditor "kind" (who they are) from "rank" (their legal priority) —
-- these are different concepts that were previously conflated.
alter table public.creditors add column if not exists creditor_kind text not null default 'privatperson'
  check (creditor_kind in ('privatperson','behoerde','sonstiges'));

-- Raw self-service submissions from prospective clients, pending lawyer review.
create table public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  address text,
  case_type text not null default 'verbraucherinsolvenz'
    check (case_type in ('regelinsolvenz','verbraucherinsolvenz','unternehmensinsolvenz')),
  creditors jsonb not null default '[]'::jsonb, -- [{name, amount, kind}]
  notes text,
  voice_audio_base64 text,
  voice_mime_type text,
  voice_transcript text,
  ai_summary text,
  status text not null default 'eingegangen' check (status in ('eingegangen','freigegeben','abgelehnt')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reply_sent boolean not null default false,
  created_case_id uuid references public.cases(id),
  created_at timestamptz not null default now()
);

alter table public.intake_submissions enable row level security;

create policy "firm_access_intake" on public.intake_submissions for all
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- Public, narrow, write-only entry point for prospective clients (no login required).
create or replace function public.submit_intake(
  p_firm_token uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_case_type text,
  p_creditors jsonb,
  p_notes text,
  p_voice_audio_base64 text,
  p_voice_mime_type text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid;
  v_id uuid;
begin
  select id into v_firm_id from public.firms where intake_token = p_firm_token;
  if v_firm_id is null then
    raise exception 'Ungültiger oder abgelaufener Link.';
  end if;

  insert into public.intake_submissions
    (firm_id, full_name, email, phone, address, case_type, creditors, notes, voice_audio_base64, voice_mime_type)
  values
    (v_firm_id, p_full_name, p_email, p_phone, p_address,
     coalesce(p_case_type, 'verbraucherinsolvenz'), coalesce(p_creditors, '[]'::jsonb), p_notes,
     p_voice_audio_base64, p_voice_mime_type)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_intake(uuid,text,text,text,text,text,jsonb,text,text,text) from public;
grant execute on function public.submit_intake(uuid,text,text,text,text,text,jsonb,text,text,text) to anon, authenticated;

-- Firm-configured outbound email sending (Resend), used only for the automated
-- "reply to client after lawyer approval" step.
create table public.firm_email_settings (
  firm_id uuid primary key references public.firms(id) on delete cascade,
  resend_api_key text not null,
  from_email text not null,
  from_name text,
  updated_at timestamptz not null default now()
);

alter table public.firm_email_settings enable row level security;
create policy "firm_access_email_settings" on public.firm_email_settings for all
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());
