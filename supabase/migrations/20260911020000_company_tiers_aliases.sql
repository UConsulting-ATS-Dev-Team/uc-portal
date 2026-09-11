-- Alias support for company_tiers -- closes a real fragility flagged
-- 2026-09-11: the table matches by exact company_name only (it's the
-- primary key), unlike data/industryBaseRates.js's alias/substring
-- matching for the exact same kind of problem (real source data spells
-- company names inconsistently -- "Chime Financial, Inc" vs "Chime",
-- "IMC" vs "IMC Trading"). A source re-onboarded under a slightly
-- different name string later would silently fall to the tier-3 default
-- cap instead of its real seeded tier, with no error or warning anywhere.
--
-- Deliberately NOT industryBaseRates.js's regex/substring approach here --
-- that file matches a hand-picked ~20-company list against loosely-typed
-- real data (member-submitted company names), where a broad match is
-- worth the small false-positive risk. company_tiers instead enforces
-- every company's own active-job cap, so a false-positive alias match
-- (one company accidentally absorbing another's cap) is a real, higher-
-- stakes mistake than a slightly-too-generous industry-baseline guess.
-- An explicit, admin-curated aliases array -- exact-match only, never a
-- substring/regex -- gets the same real-world benefit (a source's exact
-- alternate spelling still resolves correctly) without that risk.
alter table company_tiers add column aliases text[] not null default '{}';

comment on column company_tiers.aliases is
  'Exact alternate spellings this company might appear under in jobs.company (e.g. "IMC" for "IMC Trading"). Matched exactly, never as a substring -- see this column''s own migration for why.';
