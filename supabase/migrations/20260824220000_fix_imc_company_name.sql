-- Fixes a real bug caught by the first live invocation of
-- 20260824210000's new IMC Trading source: the adapter's own company-
-- name-mismatch safeguard (fetch-greenhouse-companies/index.ts, the same
-- check that catches a squatted slug like Stage 3's "bcg") compares each
-- posting's own company_name field against sources.config's `company`
-- value with a case-insensitive exact match, not a substring/contains
-- check. Greenhouse's own company_name field for this board is the short
-- form "IMC", not "IMC Trading" -- so every one of 166 fetched postings
-- was rejected as a mismatch (158 skippedCompanyMismatch, 0 inserted) on
-- the first run. The source's display name stays "IMC Trading" (accurate,
-- human-readable); only the match value changes to what Greenhouse
-- actually reports. Safe to trust "IMC" alone as the match value here
-- specifically because identity was already independently confirmed via
-- the live posting data before 20260824210000 was written (one posting's
-- own location field spells out "IMC Trading", and the office list --
-- Chicago, Zug, Sydney, London -- matches IMC Trading's real offices) --
-- not just taking a short company_name at face value.
update sources
set config = '{"platform": "greenhouse", "slug": "imc", "company": "IMC"}'::jsonb
where name = 'IMC Trading (Greenhouse Job Board API)';
