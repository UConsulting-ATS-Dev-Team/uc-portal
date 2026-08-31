-- Two more companies onto the config-driven Greenhouse mechanism
-- (fetch-greenhouse-companies) -- sourced the same way as IMC Trading/
-- Charlie Health (20260824210000) and Carvana/Guild (20260825100000):
-- cross-referencing scripts/check-company-source.mjs against the real UC
-- alumni-by-company counts (the `people` table, from the UConsulting
-- Directory import), ranked by count, rather than another guessed
-- candidate list. Also weighted per the user's explicit direction this
-- pass: prioritize finding new companies over adding volume to existing
-- ones, and weight toward consulting/investment banking/tech/finance.
--
-- Every company actually checked this pass, ranked by real alumni count
-- (both Alumni and current-member rows in `people`) and skipping
-- everything already live or already rejected in a prior pass (Bain,
-- McKinsey, Goldman Sachs, BCG, EY-Parthenon, Accenture, L.E.K., FTI,
-- KPMG, PwC, Lazard, Nous Group, Cornerstone Research, Huron, Morgan
-- Stanley, Deutsche Bank, JP Morgan, Barclays, Oliver Wyman, Microsoft,
-- Meta, Visa, Intel, Boeing, NASA JPL, Moelis, Disney, Capital One,
-- Indeed, Plaid, Notion, DoorDash, Ramp, Evercore, Ares Management,
-- PIMCO, Google, Amazon, Apple, Cisco, PayPal, KKR, Sequoia Capital,
-- CBRE, Aon, BDO, Standard Chartered): Wavestone, Veritas Capital,
-- Narmi (Lever slug real but 0 postings -- same "real but empty" case
-- already documented for Plaid/Indeed), LIDD Consultants, Konrad Group,
-- Pacific Life (Workday hint only, same non-buildable signal already
-- documented for Accenture/Microsoft/Meta/etc.), Candidly (Greenhouse
-- slug real but 0 postings, same empty-board case), BetterUp, Zendesk
-- (Workday hint only), Cart.com, nference, Twitter, RS Investments,
-- Contend, Invenergy -- none had a usable board. One additional
-- candidate, Aura, was excluded after identity verification failed:
-- Greenhouse slug "aura" reports company_name "Aura" and 5 postings, but
-- every sampled application URL resolves to auraframes.com (Aura Frames,
-- a digital-picture-frame company) while the real "Aura" a UC alumnus's
-- record most plausibly refers to is aura.com ("Aura | Intelligent
-- Digital Safety for the Whole Family", a digital-security company) --
-- two distinct real companies sharing the name "Aura," not a squatter,
-- but identity can't be confirmed either way from the ATS data alone, so
-- it's excluded per this project's established rigor on company-identity
-- verification (the same bar that caught "bcg"/"Oliver Wyman Labs"/
-- "Disney"/"Capital One"'s Lever slug).
--
-- Accordion: real financial-consulting firm (interim management/finance
-- transformation for PE-backed companies, headquartered NYC), one real
-- UC alumnus on record (as "Accordian," a misspelling of the real name).
-- Greenhouse slug "accordion", 46 postings, company_name "Accordion" on
-- every posting (exact match), roles (Associate, Adaptive Planning
-- Consultant, Exit Planning and Transaction Support, Operational &
-- Technical Accounting) and office footprint (Atlanta/Boston/Charlotte/
-- Chicago/Dallas/New York/San Francisco/London) consistent with the real
-- Accordion, directly relevant to the consulting/finance vertical this
-- pass was weighted toward.
--
-- SoundCloud: real music-streaming company, one real UC alumnus on
-- record. No direct Greenhouse slug guess resolved ("soundcloud" 404s),
-- but soundcloud.com/jobs's own page source sets a `ghSlug = "soundcloud71"`
-- JS variable used to build its own Greenhouse API calls -- the real
-- token, pulled from the company's own careers page, not guessed.
-- boards-api.greenhouse.io/v1/boards/soundcloud71/jobs returns 15
-- postings, company_name "SoundCloud" on every posting (exact match),
-- application URLs on job-boards.greenhouse.io/soundcloud71/jobs/... --
-- the same canonical Greenhouse-hosted board soundcloud.com/jobs itself
-- links to, confirming identity.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Accordion (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/accordion/jobs. company_name verified to say "Accordion" on every posting, and sampled roles/office locations (financial consulting Associate roles across Atlanta/Boston/Charlotte/Chicago/Dallas/New York/San Francisco/London) match the real Accordion, a financial-consulting firm for PE-backed companies -- not a slug collision.',
    '{"platform": "greenhouse", "slug": "accordion", "company": "Accordion"}'::jsonb
  ),
  (
    'SoundCloud (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/soundcloud71/jobs -- the real board token, pulled directly from soundcloud.com/jobs''s own page source (a `ghSlug = "soundcloud71"` JS variable), not a guessed slug (plain "soundcloud" 404s). company_name verified to say "SoundCloud" on every posting.',
    '{"platform": "greenhouse", "slug": "soundcloud71", "company": "SoundCloud"}'::jsonb
  );
