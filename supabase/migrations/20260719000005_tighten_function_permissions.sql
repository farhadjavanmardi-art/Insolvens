-- current_firm_id() is only meant to be used inside RLS policies (runs as the querying role),
-- so it must stay executable by 'authenticated', but has no reason to be callable by 'anon'.
revoke execute on function public.current_firm_id() from anon;
grant execute on function public.current_firm_id() to authenticated;

-- handle_new_user() is only meant to run as an auth trigger, never called directly by clients.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- get_creditor_portal() is intentionally public (the whole point of the portal) — leave as is.
