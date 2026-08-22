-- Base table-level privileges for the `authenticated` role. Discovered
-- necessary by testing against the live project (a fresh Supabase project
-- doesn't auto-grant these to anon/authenticated the way older templates
-- did): RLS policies from 20260821130000_profiles_and_rls.sql only ever
-- restrict which ROWS a query can touch -- Postgres still requires the
-- underlying GRANT before it evaluates RLS at all. Without this, even a
-- correctly-authenticated member with a matching RLS policy would still
-- get a bare "permission denied for table X" before RLS is ever consulted.
-- Granting broader than a given RLS policy allows is the normal, safe
-- pattern here -- RLS is what actually narrows access per row/user.

grant select on public.industries to authenticated;
grant select on public.job_functions to authenticated;

grant select, insert, update on public.jobs to authenticated;
grant select on public.job_sources to authenticated;

grant select, insert, update, delete on public.sources to authenticated;
grant select, insert, update, delete on public.duplicate_candidates to authenticated;

grant select, insert, update on public.opportunity_submissions to authenticated;
grant select, update on public.profiles to authenticated;
