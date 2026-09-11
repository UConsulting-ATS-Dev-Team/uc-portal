-- Admin write access on company_tiers -- the only way to see or change a
-- company's tier (which drives its active-posting cap, companyCap.ts) was
-- raw SQL until now. Same pattern feature_requests already uses (that
-- table's own migration, 20260823140000): admins get a direct client-side
-- update via RLS, no Edge Function needed, since there's no equivalent
-- trust boundary here that jobs/job_sources have (this isn't a table
-- regular members can read-and-corrupt; it's a small reference table only
-- admins ever need to write). Insert is included too, not just update --
-- a company not yet in this table (freshly sourced, or simply never
-- seeded) needs a new row the first time an admin classifies it, not only
-- a change to an existing one.
create policy "company_tiers_insert_admin" on company_tiers for insert with check (is_admin());
create policy "company_tiers_update_admin" on company_tiers for update using (is_admin());
