-- Seventeenth addition's two Lever hits (the nineteen Greenhouse hits from
-- the same pass are the prior migration). Same fetch-lever-companies
-- adapter as Wealthfront/Belvedere Trading/Tala/Palantir/Point B/Spotify/
-- Coupa/Zoox -- no code changes, config insert only.
--
-- Anchorage Digital: real federally-chartered digital-asset custody/crypto
-- company, well known in the crypto industry. Lever slug "anchorage" was
-- already surfaced once before, in the Fourteenth addition's PE/asset-
-- management vertical, but excluded there because the search target that
-- pass was Anchorage *Capital Group* (the unrelated multi-strategy hedge
-- fund) -- this pass targeted Anchorage Digital directly and re-verified
-- the same board on its own merits. No self-reported company name exists
-- in Lever's response (same limitation documented for Wealthfront/
-- Belvedere Trading/Tala/Spotify/Coupa/Zoox) -- identity verified instead
-- via strongly crypto-specific titles and locations ("APAC Regional Lead,
-- Stablecoin Solutions" | Singapore, "Credit Trader - Prime Finance" |
-- Cayman Islands, "OTC Trader" | Cayman Islands/Singapore, "Member of
-- Technical Staff, Agentic Banking"), consistent with Anchorage Digital's
-- real institutional crypto custody/trading business, not the hedge fund
-- or any other org sharing the short name "Anchorage". 23 of 29 sampled
-- titles survive the white-collar relevance filter locally (a genuinely
-- clean, entirely white-collar fintech/trading/legal/engineering board,
-- zero manual-trade or clinical-care hits).
--
-- e.l.f. Beauty: real publicly-traded (NYSE: ELF) beauty/cosmetics
-- company, an extremely well-known consumer brand. Lever slug "elfbeauty",
-- 71 postings. No self-reported company name exists in Lever's response --
-- identity verified instead via Oakland, CA locations (e.l.f. Beauty's
-- real HQ) and titles directly referencing the company's real owned-brand
-- portfolio ("Sr. Brand Manager, e.l.f. Cosmetics", "Sr. Manager,
-- Innovation Product Marketing, e.l.f. SKIN", multiple "Naturium" and
-- "rhode" titles -- both real brands e.l.f. Beauty acquired, rhode most
-- recently in 2025), an unusually strong identity signal for a Lever
-- board. 37 of 71 sampled titles survive the white-collar relevance filter
-- locally -- an almost entirely corporate marketing/finance/supply-chain
-- board, only 1 manual-trade/clinical hit.
--
-- Neither matches a NAMED_COMPANY_RATES entry in
-- data/industryBaseRates.js (MBB / bulge-bracket IB / elite quant trading
-- / elite big tech) -- both fall through to that module's broader
-- industry-tier fallback, same as most of this app's real sources today.
--
-- Both inherit Part 1's white-collar relevance filter and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every Lever addition since the first.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Anchorage Digital (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/anchorage. No self-reported company name field exists on a Lever posting -- identity verified instead via strongly crypto-specific titles and locations (Stablecoin Solutions/OTC Trader/Prime Finance roles in Cayman Islands, Singapore, Miami), consistent with Anchorage Digital''s real institutional crypto custody/trading business, not the unrelated hedge fund Anchorage Capital Group that shares the short name "Anchorage" (this exact slug was seen once before in the Fourteenth addition''s PE/asset-management vertical and excluded there since that pass''s search target was the hedge fund, not this company). Real, well-known federally-chartered digital-asset custody company. 23 of 29 sampled titles survive the white-collar relevance filter locally, zero manual-trade/clinical hits.',
    '{"platform": "lever", "slug": "anchorage", "company": "Anchorage Digital"}'::jsonb
  ),
  (
    'e.l.f. Beauty (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/elfbeauty. No self-reported company name field exists on a Lever posting -- identity verified instead via Oakland, CA locations (e.l.f. Beauty''s real HQ) and titles directly referencing the company''s real owned-brand portfolio ("Sr. Brand Manager, e.l.f. Cosmetics", "e.l.f. SKIN", "Naturium", "rhode" -- both real acquired brands, rhode most recently in 2025), an unusually strong identity signal for a Lever board. Real publicly-traded (NYSE: ELF) beauty company, an extremely well-known consumer brand. 37 of 71 sampled titles survive the white-collar relevance filter locally, only 1 manual-trade/clinical hit.',
    '{"platform": "lever", "slug": "elfbeauty", "company": "e.l.f. Beauty"}'::jsonb
  );
