-- Seventh addition: ten more companies onto the config-driven Greenhouse
-- mechanism (fetch-greenhouse-companies), the largest single addition in
-- this doc's Part 7 history. Sourced two ways per the user's explicit
-- direction this pass: prioritize finding new companies over adding volume
-- to existing ones, weighted toward consulting/investment banking/tech/
-- finance.
--
-- (1) Real UC alumni/member-by-company counts, queried directly from the
--     live `people` table (`npx supabase db query --linked`, both Alumni
--     and current-member rows -- ~90 distinct company text values once
--     nulls/non-company rows like "Stealth Startup" and role/institution
--     strings are excluded), cross-referenced with
--     scripts/check-company-source.mjs, skipping every company already
--     live or already rejected in a prior pass (the full list: Bain,
--     McKinsey, Goldman Sachs, BCG, EY-Parthenon, Accenture, L.E.K., FTI
--     Consulting, KPMG, PwC, Lazard, Nous Group, Cornerstone Research,
--     Huron Consulting, Morgan Stanley, Deutsche Bank, JP Morgan,
--     Barclays, Oliver Wyman, Microsoft, Meta/Facebook, Visa, Intel,
--     Boeing, NASA JPL, Moelis, Disney, Capital One, Indeed, Plaid,
--     Notion, DoorDash, Ramp, Evercore, Ares Management, PIMCO, Google,
--     Amazon, Apple, Cisco, PayPal, KKR, Sequoia Capital, CBRE, Aon, BDO,
--     Standard Chartered, Wavestone, Veritas Capital, Narmi, LIDD
--     Consultants, Konrad Group, Pacific Life, Candidly, BetterUp,
--     Zendesk, Cart.com, nference, Twitter, RS Investments, Contend,
--     Invenergy, Aura). New alumni-backed candidates checked this pass:
--     Peterson Capital Management, NextSense, SiPhox, Kommu, Get Spiffy
--     (all: no usable board), MLB (no usable board), Pumpkin (Workday
--     hint only, same non-buildable signal already documented for
--     Accenture/Microsoft/Pacific Life/Zendesk) -- and one real hit, 2K
--     (alumni record: "2K Games").
--
-- (2) Companies adjacent in spirit to sources already live -- other prop-
--     trading/quant-finance firms alongside IMC Trading, other fintechs
--     alongside Stripe/Brex, other finance-consulting firms alongside
--     Accordion -- even without a direct alumni hit, per this project's
--     established allowance for that when there's real reason to think
--     the company is relevant and might have a genuine public board.
--     Checked and rejected (no usable board, or a real board that turned
--     out to be a talent-pipeline/interest form rather than actual open
--     postings): DRW, Susquehanna International Group (SIG), Hudson
--     River Trading (Greenhouse slug "hrttalentcommunity" resolved, but
--     company_name is literally "HRT Talent Community" and only 3
--     listings, one of them named "HRT Talent Community" itself -- a
--     pipeline signup, not a real jobs board), Two Sigma, Citadel
--     Securities, Rho, Alvarez & Marsal, West Monroe, ZS Associates.
--     Optiver: Greenhouse slug "optiver" resolves but reports 0 postings
--     and a null company_name -- same "real but empty" case already
--     documented for Plaid/Indeed/Narmi/Candidly. Guidehouse: Workday
--     hint only, same non-buildable signal as the others above. Five real
--     hits: Jane Street, Jump Trading, Akuna Capital, XTX Markets (real
--     token "xtxmarketstechnologies", pulled the same way SoundCloud's
--     "soundcloud71" was -- xtxmarkets.com's own careers page embeds it,
--     "xtxmarkets"/"xtx" alone 404), and three more fintechs (Mercury,
--     Affirm, Chime) plus a consulting peer of Accordion (AlixPartners).
--
-- Every company below verified the same way as every prior addition:
-- Greenhouse's own company_name field checked for an exact match (not
-- substring -- the same discipline that caught "IMC Trading" vs. the
-- board's actual "IMC" in 20260824220000), and at least one sampled
-- application URL or the company's own careers page checked to confirm
-- it links to this exact board -- never trusting a slug guess alone, the
-- same bar that caught "bcg" (Bohen Consulting Group), "Oliver Wyman
-- Labs", "Disney" (Sgt. Pepper's Lonely Hearts Club Band), Capital One's
-- Lever slug (an unrelated crypto/CFD company), and Aura (identity
-- couldn't be confirmed either way, excluded rather than guessed):
--
-- 2K: alumni record "2K Games". Greenhouse slug "2k", 114 postings,
-- company_name "2K" (exact) -- Take-Two Interactive's real game-publishing
-- label (NBA 2K, etc.). 2k.com/careers itself embeds this exact board
-- (confirmed via page source, not just the slug guess). Real corporate
-- roles present alongside game-dev ones (Manager Commercial Strategy,
-- Manager FP&A, Manager Global Go-to-Market, Office Admin), not just
-- entertainment/creative -- relevant to the tech vertical.
--
-- Jane Street: real quantitative trading firm, no direct alumni record but
-- adjacent to IMC Trading. Greenhouse slug "janestreet", 232 postings,
-- company_name "Jane Street" (exact), sampled application URL resolves to
-- www.janestreet.com/join-jane-street/apply/... -- the firm's own domain,
-- strongest possible identity confirmation.
--
-- Jump Trading: real prop-trading firm, adjacent to IMC Trading. Greenhouse
-- slug "jumptrading", 109 postings, company_name "Jump Trading" (exact),
-- sampled application URL resolves to www.jumptrading.com/hr/job -- own
-- domain.
--
-- Akuna Capital: real options-trading firm, adjacent to IMC Trading.
-- Greenhouse slug "akunacapital", 34 postings, company_name "Akuna
-- Capital" (exact), sampled application URL resolves to
-- www.akunacapital.com/careers/job/... -- own domain. Offices (Chicago,
-- Sydney, Singapore) match the real Akuna Capital.
--
-- XTX Markets: real algorithmic-trading firm, adjacent to IMC Trading.
-- Real board token "xtxmarketstechnologies" (plain "xtxmarkets"/"xtx"
-- 404s), pulled from xtxmarkets.com/careers's own page source, same
-- method as SoundCloud's "soundcloud71". 9 postings, company_name "XTX
-- Markets" (exact). Small board, same size class as SoundCloud (15) and
-- Guild (5) when first added.
--
-- Mercury: real fintech (business banking), adjacent to Brex/Stripe. Not a
-- guess given the name collision risk (Mercury Insurance, Mercury
-- Systems, Mercury General all also exist) -- confirmed via
-- mercury.com/careers's own page source directly embedding this exact
-- Greenhouse board (greenhouse.io/mercury/jobs/... links present),
-- company_name "Mercury" (exact), and every sampled title/office matches
-- the fintech Mercury specifically (Deputy CISO - Bank, Head of Product -
-- Business Lending, offices in NY/SF/Portland).
--
-- Affirm: real publicly-traded fintech (NASDAQ: AFRM, buy-now-pay-later),
-- adjacent to Stripe/Brex. Greenhouse slug "affirm", 200 postings,
-- company_name "Affirm" (exact); one sampled title directly names the
-- real internal entity "Affirm Bank Strategic Finance Manager", and
-- remote-location spread (US, Canada, UK, Poland, Spain, Australia)
-- matches Affirm's known real international footprint.
--
-- Chime: real fintech (Chime Financial, Inc, consumer banking app),
-- adjacent to Stripe/Brex/Mercury. Greenhouse slug "chime", 65 postings,
-- company_name "Chime Financial, Inc" (exact legal name). chime.com/
-- careers's own page source directly embeds this exact board
-- (boards.greenhouse.io/chime/jobs/... links present). Offices (SF, NY,
-- Chicago, Seattle) match the real Chime.
--
-- SoFi: real publicly-traded fintech (NASDAQ: SOFI), adjacent to Affirm/
-- Chime. Greenhouse slug "sofi", 59 postings, company_name "SoFi" (exact),
-- sampled application URL resolves to sofi.com/careers/job/... -- own
-- domain.
--
-- AlixPartners: real management-consulting firm (turnaround/restructuring/
-- performance improvement), a direct consulting-vertical peer of Accordion
-- (both financial/operational advisory for corporate clients). Greenhouse
-- slug "alixpartners", 120 postings, company_name "AlixPartners" (exact),
-- sampled application URL resolves to www.alixpartners.com/careers/... --
-- own domain. Real office footprint (Boston, Chicago, Detroit, New York,
-- Paris, Milan, Sydney, Buenos Aires) matches the real global firm.
--
-- All ten inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every addition since the second. Verified
-- live rather than assumed (see this doc's dated entry for the actual
-- post-fetch counts and title spot-checks).
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    '2K (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/2k/jobs. company_name verified to say "2K" on every posting; 2k.com/careers itself embeds this exact board (Greenhouse hint confirmed in page source). Real game publisher (Take-Two Interactive label), one UC alumnus on record ("2K Games").',
    '{"platform": "greenhouse", "slug": "2k", "company": "2K"}'::jsonb
  ),
  (
    'Jane Street (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/janestreet/jobs. company_name verified to say "Jane Street" on every posting; sampled application URL resolves to www.janestreet.com/join-jane-street/apply/... (own domain). Real quantitative trading firm, adjacent to IMC Trading (already live).',
    '{"platform": "greenhouse", "slug": "janestreet", "company": "Jane Street"}'::jsonb
  ),
  (
    'Jump Trading (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/jumptrading/jobs. company_name verified to say "Jump Trading" on every posting; sampled application URL resolves to www.jumptrading.com/hr/job (own domain). Real prop-trading firm, adjacent to IMC Trading (already live).',
    '{"platform": "greenhouse", "slug": "jumptrading", "company": "Jump Trading"}'::jsonb
  ),
  (
    'Akuna Capital (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/akunacapital/jobs. company_name verified to say "Akuna Capital" on every posting; sampled application URL resolves to www.akunacapital.com/careers/job/... (own domain). Real options-trading firm, adjacent to IMC Trading (already live).',
    '{"platform": "greenhouse", "slug": "akunacapital", "company": "Akuna Capital"}'::jsonb
  ),
  (
    'XTX Markets (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/xtxmarketstechnologies/jobs -- the real board token, pulled directly from xtxmarkets.com/careers''s own page source (plain "xtxmarkets"/"xtx" 404, same discovery method as SoundCloud''s "soundcloud71"). company_name verified to say "XTX Markets" on every posting.',
    '{"platform": "greenhouse", "slug": "xtxmarketstechnologies", "company": "XTX Markets"}'::jsonb
  ),
  (
    'Mercury (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/mercury/jobs. company_name verified to say "Mercury" on every posting; mercury.com/careers''s own page source directly embeds this exact board (multiple greenhouse.io/mercury/jobs/... links present), confirming this is the fintech Mercury (mercury.com), not Mercury Insurance/Systems/General which also use that name.',
    '{"platform": "greenhouse", "slug": "mercury", "company": "Mercury"}'::jsonb
  ),
  (
    'Affirm (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/affirm/jobs. company_name verified to say "Affirm" on every posting; one sampled title directly names the real internal entity ("Affirm Bank Strategic Finance Manager"), and remote-location spread (US, Canada, UK, Poland, Spain, Australia) matches Affirm''s real international footprint.',
    '{"platform": "greenhouse", "slug": "affirm", "company": "Affirm"}'::jsonb
  ),
  (
    'Chime (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/chime/jobs. company_name verified to say "Chime Financial, Inc" (exact real legal name) on every posting; chime.com/careers''s own page source directly embeds this exact board (boards.greenhouse.io/chime/jobs/... links present).',
    '{"platform": "greenhouse", "slug": "chime", "company": "Chime Financial, Inc"}'::jsonb
  ),
  (
    'SoFi (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/sofi/jobs. company_name verified to say "SoFi" on every posting; sampled application URL resolves to sofi.com/careers/job/... (own domain). Real publicly-traded fintech (NASDAQ: SOFI).',
    '{"platform": "greenhouse", "slug": "sofi", "company": "SoFi"}'::jsonb
  ),
  (
    'AlixPartners (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/alixpartners/jobs. company_name verified to say "AlixPartners" on every posting; sampled application URL resolves to www.alixpartners.com/careers/... (own domain). Real management-consulting firm, a direct consulting-vertical peer of Accordion (already live).',
    '{"platform": "greenhouse", "slug": "alixpartners", "company": "AlixPartners"}'::jsonb
  );
