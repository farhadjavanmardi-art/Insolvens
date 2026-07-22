-- Processing state for automated intake handling
alter table public.intake_submissions add column if not exists processing_status text not null default 'pending'
  check (processing_status in ('pending','processed','needs_client_info','error'));
alter table public.intake_submissions add column if not exists follow_up_question text;
alter table public.intake_submissions add column if not exists error_message text;

-- Flag on cases so the lawyer can see at a glance what was auto-created by AI and not yet checked
alter table public.cases add column if not exists ai_created boolean not null default false;
alter table public.cases add column if not exists needs_review boolean not null default false;

-- Flag on documents so the lawyer can see which AI-scanned documents haven't been checked yet
alter table public.documents add column if not exists reviewed boolean not null default true;
update public.documents set reviewed = false where generated_by_ai = true;

-- Each case gets its own private upload link for the client to send follow-up documents
alter table public.cases add column if not exists client_upload_token uuid not null default gen_random_uuid();
create unique index if not exists idx_cases_upload_token on public.cases(client_upload_token);

-- Staging table for client-submitted follow-up documents (photos), processed automatically by AI
create table public.document_uploads (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  image_base64 text not null,
  mime_type text not null,
  status text not null default 'pending' check (status in ('pending','processed','error')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.document_uploads enable row level security;
create policy "firm_access_document_uploads" on public.document_uploads for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.firm_id = public.current_firm_id()));

-- Public, narrow, write-only entry point for clients to submit a follow-up document photo.
create or replace function public.submit_case_document(p_case_token uuid, p_image_base64 text, p_mime_type text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_id uuid;
begin
  select id into v_case_id from public.cases where client_upload_token = p_case_token;
  if v_case_id is null then
    raise exception 'Ungültiger Link.';
  end if;

  insert into public.document_uploads (case_id, image_base64, mime_type)
  values (v_case_id, p_image_base64, p_mime_type)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_case_document(uuid,text,text) from public;
grant execute on function public.submit_case_document(uuid,text,text) to anon, authenticated;

-- ==========================================================
-- Triggers: fire-and-forget calls into Supabase Edge Functions for automated processing.
-- ==========================================================
create or replace function public.trigger_process_intake()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://phzsdecdndcwbuavdxvi.supabase.co/functions/v1/process-intake',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoenNkZWNkbmRjd2J1YXZkeHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NTI5MjgsImV4cCI6MjEwMDAyODkyOH0.HoN9yv5Vfsp-81TGtGbBW9lV6toaMuJQKgFeELSNQxw'
    ),
    body := jsonb_build_object('submission_id', new.id)
  );
  return new;
end;
$$;

create trigger on_intake_submission_created
  after insert on public.intake_submissions
  for each row execute procedure public.trigger_process_intake();

create or replace function public.trigger_process_document_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://phzsdecdndcwbuavdxvi.supabase.co/functions/v1/process-document-upload',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoenNkZWNkbmRjd2J1YXZkeHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NTI5MjgsImV4cCI6MjEwMDAyODkyOH0.HoN9yv5Vfsp-81TGtGbBW9lV6toaMuJQKgFeELSNQxw'
    ),
    body := jsonb_build_object('upload_id', new.id)
  );
  return new;
end;
$$;

create trigger on_document_upload_created
  after insert on public.document_uploads
  for each row execute procedure public.trigger_process_document_upload();
