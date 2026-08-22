-- Discovered the same way 20260821150000_grants.sql discovered its gap:
-- testing supabase/functions/approve-submission against the live project hit
-- "permission denied for table profiles" using the service_role key, with
-- Postgres's own hint being exactly this GRANT. service_role bypasses RLS
-- (Supabase's own auth layer skips RLS enforcement for that JWT role), but
-- RLS bypass and table-level GRANTs are two separate Postgres mechanisms --
-- bypassing the former doesn't imply the latter. This project's Supabase
-- instance apparently doesn't auto-grant service_role blanket schema access
-- any more than it auto-granted authenticated (per that migration's own
-- comment), so it needs the same explicit treatment.
--
-- Granted broadly (every table, not itemized per-column like the
-- authenticated grants) because service_role is the trusted server-side
-- role by design -- RLS is what actually restricts a real client, and
-- service_role exists specifically to be the code path that's allowed
-- around it (Edge Functions only, never shipped to a browser).

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
