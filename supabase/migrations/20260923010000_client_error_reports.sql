-- Real, self-hosted client-side error reporting -- closes a genuine
-- operational gap found in a pre-demo audit: there was no way to learn
-- about a real bug in production except a member telling you directly.
-- Deliberately not a third-party service (Sentry, etc.) -- that would need
-- a new external account this agent can't create on the user's behalf, and
-- this project already has a working precedent for "build the equivalent
-- capability in our own Supabase project instead of standing up a new
-- external service" (see industryBaseRates.js's own no-LLM-API decision).
--
-- Has to accept an anonymous insert, not just authenticated -- a real
-- crash can happen on the sign-in page itself, before any session exists
-- (e.g. a bad response from can_sign_up()). No update/delete policy at
-- all -- these are write-once reports, nothing should ever need to edit
-- one, matching duplicate_candidates' own append-only shape.
create table client_error_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null,
  stack text,
  page_path text,
  user_agent text,
  context text not null default 'unknown',
  account_id uuid references auth.users(id)
);

alter table client_error_reports enable row level security;
create policy "client_error_reports_insert_any" on client_error_reports for insert to anon, authenticated with check (message is not null and length(trim(message)) > 0);
create policy "client_error_reports_select_admin" on client_error_reports for select using (is_admin());

grant insert on public.client_error_reports to anon, authenticated;
grant select on public.client_error_reports to authenticated;
