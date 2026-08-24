-- Same base-privilege gap as 20260821150000_grants.sql found for every
-- other table: RLS alone doesn't grant table-level access, Postgres still
-- checks the underlying GRANT first. Confirmed the same way -- a real
-- authenticated session got a bare "permission denied for table people"
-- despite people_select_authenticated existing.
grant select on public.people to authenticated;
