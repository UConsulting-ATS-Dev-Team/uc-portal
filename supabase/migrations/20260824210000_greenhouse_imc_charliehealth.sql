-- Two more companies onto the same config-driven Greenhouse mechanism
-- (fetch-greenhouse-companies) the last 6 already use -- adding a company
-- is a migration insert, not a new Edge Function. Sourced by cross-
-- referencing scripts/check-company-source.mjs against the *real* UC
-- alumni-by-company data (data/realPeople.js, from the actual UConsulting
-- Directory import) rather than another guessed candidate list -- both
-- companies have a confirmed real UC alumnus on record, unlike the mostly-
-- tech/fintech companies added so far (Databricks, Coinbase, Airbnb, Brex,
-- Figma, Robinhood, Stripe), none of which any real alumnus is tied to.
--
-- Every consulting/IB/PE firm actually checked this same pass -- L.E.K.
-- Consulting, FTI Consulting, KPMG, PwC, Lazard, Nous Group, Cornerstone
-- Research, Huron Consulting, Morgan Stanley, Deutsche Bank, JP Morgan,
-- Barclays -- came back with no usable public board (mostly flat 404s on
-- both Greenhouse and Lever, consistent with the pattern already found for
-- Bain/McKinsey/Goldman/BCG/EY-Parthenon/Accenture: established
-- consulting/banking firms overwhelmingly don't run their ATS on a
-- publicly-embeddable platform). KPMG, Cornerstone Research, and Candidly
-- each returned a Lever/Greenhouse slug that technically resolves but with
-- 0 postings and (for the Lever hits) no self-reported company name to
-- confirm identity against -- the same "a slug match alone is not a
-- company match" caution this repo already applies to Oliver Wyman/BCG,
-- and 0 postings isn't a usable data source regardless. Not included.
--
-- IMC Trading: real prop-trading/quant-finance firm (Chicago-headquartered,
-- global offices), adjacent to UC's Investment banking / Private equity
-- interest categories. Greenhouse slug "imc", 166 postings, company_name
-- "IMC" on every posting, and one posting's own location field spells out
-- "IMC Trading" explicitly -- confirmed further by cross-checking the
-- office list in the live data (Chicago, Zug/Switzerland, Sydney, London)
-- against IMC Trading's actual known offices.
--
-- Charlie Health: real virtual intensive-outpatient mental-health provider
-- for teens/young adults, maps to UC's Healthcare interest category.
-- Greenhouse slug "charliehealth", 281 postings, company_name "Charlie
-- Health" on every posting. Noted honestly, not silently: roughly 150-200
-- of its 281 postings are clinical/care-delivery roles (Care Coach, Crisis
-- Intervention Specialist, licensed-clinician roles) a business-track UC
-- member has no use for, but a real, non-trivial slice (Commercial
-- Strategy Associate/Manager, several Growth Strategy Analyst variants,
-- Director of Revenue Operations, Director of Admissions Strategy) are
-- genuinely relevant strategy/ops roles -- the same "some of this
-- company's board is relevant, most isn't" situation the senior-role
-- denylist + per-company display cap (pages/Jobs.jsx's CAP_PER_COMPANY)
-- already exist to handle for every other high-volume source, so this
-- doesn't need special-casing.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'IMC Trading (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/imc/jobs. company_name verified to say "IMC" on every posting (the adapter''s own match value below is "IMC", not "IMC Trading", to agree with Greenhouse''s actual field -- see 20260824220000''s fix), and IMC Trading''s real office network (Chicago, Zug, Sydney, London) confirmed against the live location data before this was added.',
    '{"platform": "greenhouse", "slug": "imc", "company": "IMC"}'::jsonb
  ),
  (
    'Charlie Health (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/charliehealth/jobs. company_name verified to say "Charlie Health" on every posting. Board is mostly clinical/care-delivery roles outside UC members'' actual interest -- kept anyway since a real slice (Commercial Strategy, Growth Strategy, Revenue Operations, Admissions Strategy) is genuinely relevant, same relevance-mix the existing per-company cap and senior-role filter already handle for other sources.',
    '{"platform": "greenhouse", "slug": "charliehealth", "company": "Charlie Health"}'::jsonb
  );
