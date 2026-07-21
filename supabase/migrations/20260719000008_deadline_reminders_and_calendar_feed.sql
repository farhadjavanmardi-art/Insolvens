create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Each lawyer gets a private, unguessable calendar feed token (for .ics subscription, no OAuth needed)
alter table public.profiles add column if not exists calendar_feed_token uuid not null default gen_random_uuid();
create unique index if not exists idx_profiles_calendar_token on public.profiles(calendar_feed_token);

-- Public, narrow, read-only function for the calendar feed (returns only open deadlines
-- for the cases the token's owner is responsible for).
create or replace function public.get_calendar_feed(p_token uuid)
returns table (title text, due_date date, case_number text)
language sql
security definer
set search_path = public
stable
as $$
  select d.title, d.due_date, c.case_number
  from public.deadlines d
  join public.cases c on c.id = d.case_id
  join public.profiles p on p.id = c.responsible_lawyer
  where p.calendar_feed_token = p_token
    and d.status = 'offen';
$$;

revoke all on function public.get_calendar_feed(uuid) from public;
grant execute on function public.get_calendar_feed(uuid) to anon, authenticated;

-- ==========================================================
-- Automated deadline reminder emails (runs entirely inside Postgres via pg_cron + pg_net,
-- no external service-role key or serverless function required)
-- ==========================================================
create or replace function public.send_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_from text;
begin
  for r in
    select d.id as deadline_id, d.title, d.due_date, c.case_number,
           fes.resend_api_key, fes.from_email, fes.from_name,
           p.email as lawyer_email, p.full_name as lawyer_name
    from public.deadlines d
    join public.cases c on c.id = d.case_id
    join public.firms f on f.id = c.firm_id
    join public.firm_email_settings fes on fes.firm_id = f.id
    left join public.profiles p on p.id = c.responsible_lawyer
    where d.status = 'offen'
      and d.reminder_sent = false
      and d.due_date <= (now() + interval '3 days')::date
      and p.email is not null
  loop
    v_from := coalesce(r.from_name || ' <' || r.from_email || '>', r.from_email);

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || r.resend_api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', v_from,
        'to', r.lawyer_email,
        'subject', 'Frist in Kürze: ' || r.title || ' (Az. ' || r.case_number || ')',
        'text', 'Hallo ' || coalesce(r.lawyer_name, '') || E',\n\nzur Erinnerung: die Frist "' || r.title ||
                '" in der Akte ' || r.case_number || ' läuft am ' || r.due_date || ' ab.\n\nInsolvenzFlow'
      )
    );

    update public.deadlines set reminder_sent = true where id = r.deadline_id;
  end loop;
end;
$$;

revoke all on function public.send_deadline_reminders() from public, anon, authenticated;

select cron.schedule(
  'insolvenzflow-deadline-reminders',
  '0 7 * * *',
  $$select public.send_deadline_reminders();$$
);
