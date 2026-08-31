-- Eighth addition: thirteen more companies onto the config-driven
-- Greenhouse mechanism (fetch-greenhouse-companies) -- the largest single
-- addition in this doc's Part 7 history, surpassing the Seventh. Same
-- standing direction as the Sixth/Seventh additions: prioritize finding new
-- companies over adding volume to existing ones, weighted toward
-- consulting/investment banking/tech/finance.
--
-- (1) Real UC alumni/member-by-company counts, queried directly from the
--     live `people` table (`npx supabase db query --linked`, both Alumni
--     and current-member rows). Every company text value in the table was
--     already checked (live or rejected) in a prior pass, with two
--     exceptions checked this pass -- McKenna Labs and Paladin Protocol
--     (both: no usable board) -- plus several rows that aren't real,
--     checkable companies at all (role strings like "Full-Stack Software
--     Engineer", institutions like "Georgetown School of Foreign Service"/
--     "Harvard Development", a nonprofit "Girls Who Invest", a garbled
--     entry "Fly by Jing (AMASS", and "Stealth Startup") -- correctly
--     skipped rather than guessed at.
--
-- (2) Companies adjacent in spirit to sources already live -- more
--     prop-trading/quant-finance firms alongside IMC Trading/Jane Street/
--     Jump Trading/Akuna Capital/XTX Markets/Flow Traders, more fintechs
--     alongside Stripe/Brex/Affirm/Chime/SoFi/Mercury, more
--     consulting/advisory firms alongside Accordion/AlixPartners, and (a
--     vertical flagged but not deeply searched before this pass) private
--     equity/asset management firms -- per this project's established
--     allowance for checking adjacent companies even without a direct
--     alumni hit.
--
--     Checked and rejected this pass (no usable board/signal on any
--     platform, or a Workday hint with no confirmed tenant): Wolverine
--     Trading, GTS, Five Rings (Greenhouse hint on its own careers page,
--     but none of the guessed slug variants resolved -- token not found),
--     Old Mission Capital's near-neighbors Cutler Group/Radix
--     Trading/HC Technologies/Vatic Investments, Kearney, Slalom, Grant
--     Thornton, Simon-Kucher, RSM, ICF International, Analysis Group, NERA
--     Economic Consulting, Kroll, Exponent, Blackstone, Carlyle Group,
--     Vista Equity Partners, Insight Partners, Silver Lake, Advent
--     International, Warburg Pincus, Hellman & Friedman, Summit Partners,
--     Francisco Partners, Providence Equity. Protiviti/Bain Capital/Booz
--     Allen Hamilton: Workday hint only, same non-buildable signal already
--     documented for Accenture/Microsoft/Pacific Life/Zendesk/Guidehouse/
--     Pumpkin. Klarna/Wise/Marqeta-adjacent checks Wise/Current: real
--     Greenhouse boards found (slugs "wise" and "current"), but sampled
--     job data shows neither is the company the name suggests -- "wise"'s
--     company_name is "Wise Worksite Field Sales" (a voluntary-benefits
--     sales company, titles like "Supplemental Sales Agent - Anchorage,
--     AK") and "current"'s postings (Business Development Lead Digital
--     Agency, Lead Engineer Drupal/Web Platforms, Senior Paid Media
--     Strategist) read as a digital marketing/creative agency, not the
--     international-transfer fintech Wise or the neobank Current --
--     excluded on the same identity-verification grounds as
--     "bcg"/"Disney"/Capital One's Lever slug/Aura, not a rejection of the
--     real Wise/Current's existence. Apollo Global Management/American
--     Securities/Optiver-class: Greenhouse slugs "apollo" and
--     "americansecurities" both resolve but report 0 postings and a null
--     company_name -- same "real but empty" case already documented for
--     Plaid/Indeed/Narmi/Candidly/Optiver. Two real Lever-hosted boards
--     were found and deliberately not added -- Wealthfront (slug
--     "wealthfront", 23 postings, Palo Alto -- matches the real
--     fintech) and Belvedere Trading (slug "belvederetrading", 14
--     postings) -- because this codebase has no Lever adapter at all
--     (confirmed by inspection: fetch-greenhouse-companies only ever reads
--     `config->>platform = 'greenhouse'`; the only Lever exposure anywhere
--     in this repo is check-company-source.mjs's own detection code,
--     never wired into an actual fetcher). Adding either would require new
--     Edge Function code, out of scope for this config-only pass -- flagged
--     here as real, legitimate boards for a future Lever adapter, not
--     rejected on authorization or identity grounds. Thoma Bravo's Lever
--     slug resolves but reports 0 postings, so it would be excluded either
--     way.
--
--     Thirteen real hits, all Greenhouse, all verified the same way as
--     every prior addition -- company_name checked for an exact match (not
--     substring) plus at least one sampled application URL or office
--     footprint cross-checked against the real company, never trusting a
--     slug guess alone (the same discipline that caught "bcg"/"Oliver
--     Wyman Labs"/"Disney"/Capital One's Lever slug/Aura/"IMC Trading" vs.
--     "IMC" in prior passes):
--
-- Tower Research Capital: real quant/HFT firm, adjacent to IMC
-- Trading/Jane Street/Jump Trading/Akuna Capital/XTX Markets/Flow Traders.
-- Greenhouse slug "towerresearchcapital", 83 postings, company_name "Tower
-- Research Capital" (exact). Every sampled application URL resolves to
-- www.tower-research.com/open-positions/... (own domain). Office spread
-- (Montreal, New York, Gurgaon, Amsterdam, Singapore) matches the real
-- global firm.
--
-- Virtu Financial: real publicly-traded market maker (NASDAQ: VIRT),
-- adjacent to the same prop-trading cluster. Greenhouse slug "virtu", 47
-- postings, company_name "Virtu Financial" (exact). Office spread
-- (Singapore, Dublin, New York, Austin) matches the real firm.
--
-- Old Mission Capital: real Chicago-based prop-trading/options-market-
-- making firm, adjacent to the same cluster. Greenhouse slug
-- "oldmissioncapital", 36 postings, company_name "Old Mission" (not "Old
-- Mission Capital" -- confirmed via a sampled application URL resolving to
-- www.oldmissioncapital.com/careers/... (own domain) before trusting the
-- shorter name, same lesson as IMC Trading's board reporting "IMC" in
-- 20260824220000). Offices (Chicago, New York) match the real firm.
--
-- DV Trading: real Chicago-based prop-trading firm, adjacent to the same
-- cluster. Greenhouse slug "dvtrading", 62 postings, company_name "DV
-- Trading" (exact). Titles reference real internal desks ("DV Equities",
-- "DV Commodities"), office spread (London, Hong Kong, New York) matches
-- the real global firm.
--
-- Flow Traders: real Amsterdam-based ETF/digital-assets market maker,
-- adjacent to the same cluster. Greenhouse slug "flowtraders", 42
-- postings, company_name "Flow Traders" (exact). Office spread (Amsterdam,
-- New York, Hong Kong) matches the real firm.
--
-- Marqeta: real publicly-traded card-issuing fintech (NASDAQ: MQ),
-- adjacent to Stripe/Brex/Affirm/Chime. Greenhouse slug "marqeta", small
-- board (2 postings), company_name "Marqeta" (exact) on both. Titles (FP&A
-- Manager GTM Finance - Credit Products, Manager Disputes/Chargebacks) are
-- genuine finance/ops roles at a real fintech, not a squatter -- small
-- board size alone isn't a disqualifier (SoundCloud/XTX Markets/Guild were
-- all added at a similar or smaller size).
--
-- Carta: real cap-table/equity-management fintech, adjacent to
-- Stripe/Brex/Affirm. Greenhouse slug "carta", 60 postings, company_name
-- "Carta" (exact). Titles (Account Executive Legal Services, Account
-- Executive PE Standard, Associate Tax Delivery) match the real company's
-- actual product lines.
--
-- Betterment: real robo-advisor/wealth-management fintech, adjacent to
-- Wealthfront/Upstart. Greenhouse slug "betterment", 31 postings,
-- company_name "Betterment" (exact). Every sampled application URL
-- resolves to www.betterment.com/careers/... (own domain), location
-- "Betterment HQ - New York City" matches the real firm's HQ.
--
-- Upstart: real publicly-traded AI-lending fintech (NASDAQ: UPST),
-- adjacent to Affirm/SoFi. Greenhouse slug "upstart", 100 postings,
-- company_name "Upstart" (exact). Every sampled application URL resolves
-- to careers.upstart.com/jobs (own domain).
--
-- Block: real publicly-traded fintech (NYSE: XYZ, formerly Square),
-- adjacent to Stripe/Affirm/Chime. Greenhouse slug "block", 193 postings,
-- company_name "Block" (exact). Every sampled application URL resolves to
-- block.xyz/careers/... (own domain). Office spread (Sydney, Brisbane,
-- Melbourne, Bay Area, Toronto) matches the real global company.
--
-- Charles River Associates: real economics/litigation consulting firm,
-- adjacent to Accordion/AlixPartners. Greenhouse slug
-- "charlesriverassociates", 78 postings, company_name "Charles River
-- Associates" (exact). Titles are genuine economics/forensic-technology/
-- management-advisory consulting analyst roles; office spread (Boston,
-- Chicago, New York, Oakland, Toronto, Dallas, Washington DC, Los Angeles,
-- Tallahassee) matches the real firm's real footprint.
--
-- Guidepoint: real expert-network/investment-research firm, adjacent to
-- the consulting/finance-research cluster. Greenhouse slug "guidepoint",
-- 122 postings, company_name "Guidepoint" (exact). Office spread
-- (Shanghai, Mumbai, Toronto) matches the real global expert-network firm.
--
-- General Atlantic: real global growth-equity firm -- the private-equity/
-- asset-management vertical flagged in this session's task brief as
-- mentioned but not deeply searched before. Greenhouse slug
-- "generalatlantic", 14 postings, company_name "General Atlantic" (trimmed
-- -- the raw field carries a trailing space, harmless since the adapter's
-- own match already does `.trim().toLowerCase()`). Location "New York -
-- Park Avenue" plus Mexico City/London offices match the real firm's real
-- footprint.
--
-- All thirteen inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every addition since the second. Verified
-- live rather than assumed (see this doc's dated entry for the actual
-- post-fetch counts and title spot-checks).
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Tower Research Capital (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/towerresearchcapital/jobs. company_name verified to say "Tower Research Capital" on every posting; sampled application URLs resolve to www.tower-research.com/open-positions/... (own domain). Real quant/HFT firm, adjacent to IMC Trading/Jane Street/Jump Trading/Akuna Capital/XTX Markets/Flow Traders (already live).',
    '{"platform": "greenhouse", "slug": "towerresearchcapital", "company": "Tower Research Capital"}'::jsonb
  ),
  (
    'Virtu Financial (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/virtu/jobs. company_name verified to say "Virtu Financial" on every posting. Real publicly-traded market maker (NASDAQ: VIRT), adjacent to the same prop-trading cluster.',
    '{"platform": "greenhouse", "slug": "virtu", "company": "Virtu Financial"}'::jsonb
  ),
  (
    'Old Mission Capital (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/oldmissioncapital/jobs. company_name verified to say "Old Mission" (not "Old Mission Capital") on every posting -- confirmed via a sampled application URL resolving to www.oldmissioncapital.com/careers/... (own domain) before trusting the shorter name, same lesson as IMC Trading''s board reporting "IMC" (20260824220000). Real Chicago-based prop-trading/options-market-making firm.',
    '{"platform": "greenhouse", "slug": "oldmissioncapital", "company": "Old Mission"}'::jsonb
  ),
  (
    'DV Trading (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/dvtrading/jobs. company_name verified to say "DV Trading" on every posting; titles reference real internal desks ("DV Equities", "DV Commodities"). Real Chicago-based prop-trading firm, adjacent to the same cluster.',
    '{"platform": "greenhouse", "slug": "dvtrading", "company": "DV Trading"}'::jsonb
  ),
  (
    'Flow Traders (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/flowtraders/jobs. company_name verified to say "Flow Traders" on every posting; office spread (Amsterdam, New York, Hong Kong) matches the real ETF/digital-assets market maker.',
    '{"platform": "greenhouse", "slug": "flowtraders", "company": "Flow Traders"}'::jsonb
  ),
  (
    'Marqeta (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/marqeta/jobs. company_name verified to say "Marqeta" on both current postings (a small board, same size class as SoundCloud/XTX Markets/Guild when first added). Real publicly-traded card-issuing fintech (NASDAQ: MQ), adjacent to Stripe/Brex/Affirm/Chime.',
    '{"platform": "greenhouse", "slug": "marqeta", "company": "Marqeta"}'::jsonb
  ),
  (
    'Carta (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/carta/jobs. company_name verified to say "Carta" on every posting; titles (Account Executive Legal Services/PE Standard, Associate Tax Delivery) match the real company''s actual product lines. Real cap-table/equity-management fintech, adjacent to Stripe/Brex/Affirm.',
    '{"platform": "greenhouse", "slug": "carta", "company": "Carta"}'::jsonb
  ),
  (
    'Betterment (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/betterment/jobs. company_name verified to say "Betterment" on every posting; every sampled application URL resolves to www.betterment.com/careers/... (own domain), location "Betterment HQ - New York City" matches the real firm''s HQ.',
    '{"platform": "greenhouse", "slug": "betterment", "company": "Betterment"}'::jsonb
  ),
  (
    'Upstart (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/upstart/jobs. company_name verified to say "Upstart" on every posting; every sampled application URL resolves to careers.upstart.com/jobs (own domain). Real publicly-traded AI-lending fintech (NASDAQ: UPST).',
    '{"platform": "greenhouse", "slug": "upstart", "company": "Upstart"}'::jsonb
  ),
  (
    'Block (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/block/jobs. company_name verified to say "Block" on every posting; every sampled application URL resolves to block.xyz/careers/... (own domain). Real publicly-traded fintech (NYSE: XYZ, formerly Square), office spread (Sydney, Brisbane, Melbourne, Bay Area, Toronto) matches the real global company.',
    '{"platform": "greenhouse", "slug": "block", "company": "Block"}'::jsonb
  ),
  (
    'Charles River Associates (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/charlesriverassociates/jobs. company_name verified to say "Charles River Associates" on every posting; office spread (Boston, Chicago, New York, Oakland, Toronto, Dallas, Washington DC, Los Angeles, Tallahassee) matches the real firm. Real economics/litigation consulting firm, adjacent to Accordion/AlixPartners.',
    '{"platform": "greenhouse", "slug": "charlesriverassociates", "company": "Charles River Associates"}'::jsonb
  ),
  (
    'Guidepoint (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/guidepoint/jobs. company_name verified to say "Guidepoint" on every posting; office spread (Shanghai, Mumbai, Toronto) matches the real global expert-network/investment-research firm.',
    '{"platform": "greenhouse", "slug": "guidepoint", "company": "Guidepoint"}'::jsonb
  ),
  (
    'General Atlantic (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/generalatlantic/jobs. company_name verified to say "General Atlantic" (trimmed -- the raw field carries a trailing space, harmless since the adapter''s match already trims) on every posting; location "New York - Park Avenue" plus Mexico City/London offices match the real firm. Real global growth-equity firm -- the private-equity/asset-management vertical flagged but not deeply searched before this pass.',
    '{"platform": "greenhouse", "slug": "generalatlantic", "company": "General Atlantic"}'::jsonb
  );
