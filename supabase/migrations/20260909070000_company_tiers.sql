-- Company-tier cap: the "name brand relevance" layer for #4 (job-board
-- relevance at scale). Direct product direction: "only the really relevant
-- consulting/similar companies can get over 10 job postings... definitely
-- want to go off name brand relevance" -- confirmed as 4 tiers, with core
-- consulting broken out from other elite name-brand companies (a real
-- Bain-vs-Goldman priority order, not just "famous or not"), and a PwC-style
-- judgment call: a Big 4 firm counts as core consulting even where its
-- larger revenue line is audit/tax, since it's still the name-brand
-- consulting-recruiting target UC members mean by "PwC."
--
-- This is a NEW axis on top of the existing per-company cap
-- (supabase/functions/_shared/pipeline/companyCap.ts's tierForJobFunction,
-- mirrored in server/src/companyCap.ts) -- that logic ranks WHICH postings
-- survive within one company (Consulting/IB/SWE/PM postings outrank
-- Marketing/Ops/Sales, which outrank unclassified). This table decides HOW
-- MANY postings a company is even allowed before that ranking kicks in. The
-- two compose: a Tier 0 company's audit/tax postings still lose the
-- internal job-function tiebreak to any of its own actually-consulting
-- postings if it's ever over its (generous) cap.
--
-- Lives as a real table, not a hardcoded JS/TS constant, because it has to
-- be read from two runtimes with no shared import path: the Deno Edge
-- Functions (ingestion-side enforcement) and the React frontend (Jobs
-- board's display cap, data/jobUtils.js's capPerCompany). A single table is
-- the only way both stay in sync automatically -- same reasoning
-- data/industryBaseRates.js's header explains for why THAT map could stay
-- frontend-only (the real odds model only ever runs in the browser) and why
-- this one can't.
--
-- Tier -> cap (server/src/companyCap.ts's TIER_CAPS is the source of truth
-- for the numbers; repeated here for readability):
--   0 -- core consulting (MBB, Big 4 advisory arms, boutique/economic
--        consulting) -- cap 25
--   1 -- other elite name-brand (bulge-bracket/elite-boutique IB,
--        Citadel-tier quant, marquee big tech/AI, major VC) -- cap 15
--   2 -- recognizable corporate/finance-adjacent -- cap 10
--   3 -- everyone else -- cap 3. This is also the DEFAULT for any company
--        NOT in this table (a newly-sourced company, most likely) -- see
--        companyCap.ts's capForCompanyTier(), which falls back to tier 3
--        rather than erroring or leaving a new company uncapped.
--
-- Seeded 2026-09-09 from the 86 companies actually live in `jobs` at the
-- time (a plain `select distinct company` sweep), each judged individually.
-- Deliberately NOT an exact science for the tier-2/tier-3 middle of the
-- pack (direct product instruction) -- `note` is populated only where the
-- call is non-obvious enough to be worth recording (Big-4/PwC-style
-- consulting-despite-audit-revenue calls, and quant/prop-trading firms that
-- are real and relevant but not individually famous enough for tier 1 the
-- way Citadel/Jane Street/Akuna/XTX are, per industryBaseRates.js's own
-- documented precedent for that exact distinction). Everything else has a
-- null note -- an unremarkable "recognizable brand, not core-consulting/
-- not top-elite" or "small/niche, no strong signal either way" call.
--
-- Whoever maintains this: re-derive the live company list periodically
-- (`select company, count(*) from jobs where active group by 1 order by 2
-- desc`) and add newly-sourced companies here -- until then they correctly
-- fall to tier 3 by default, never uncapped.

create table company_tiers (
  company_name text primary key,
  tier smallint not null check (tier in (0, 1, 2, 3)),
  note text,
  created_at timestamptz not null default now()
);

alter table company_tiers enable row level security;
create policy "company_tiers_select_authenticated" on company_tiers for select using (auth.role() = 'authenticated');

insert into company_tiers (company_name, tier, note) values
  -- ---- Tier 0: core consulting ----
  ('Deloitte', 0, 'Big 4 -- has a genuine, large consulting practice, not just audit/tax'),
  ('Accordion', 0, 'finance & technology transformation consulting'),
  ('Baringa', 0, 'management consulting (energy/financial services/tech)'),
  ('Charles River Associates', 0, 'economic/litigation consulting'),
  ('Point B', 0, 'management consulting'),
  ('AlixPartners', 0, 'restructuring/turnaround consulting'),

  -- ---- Tier 1: other elite name-brand ----
  ('Palantir', 1, null),
  ('Akuna Capital', 1, 'Citadel-tier elite quant trading, per data/industryBaseRates.js'),
  ('Anduril Industries', 1, null),
  ('AQR', 1, 'major quant fund, individually famous in finance recruiting'),
  ('Anthropic', 1, null),
  ('Databricks', 1, null),
  ('Stripe', 1, null),
  ('XTX Markets', 1, 'Citadel-tier elite quant trading, per data/industryBaseRates.js'),
  ('Airbnb', 1, null),
  ('Spotify', 1, null),
  ('Coinbase', 1, null),
  ('AlphaSights', 1, 'expert-network firm recruiting the same pool as MBB -- consulting-adjacent, not itself a consulting firm'),
  ('Bessemer Venture Partners', 1, 'major, prestigious VC -- different vertical from consulting/IB but comparably elite'),

  -- ---- Tier 2: recognizable corporate/finance-adjacent ----
  ('Braze', 2, null),
  ('Monzo', 2, null),
  ('AppLovin', 2, null),
  ('Adyen', 2, null),
  ('Tripadvisor', 2, null),
  ('Upstart', 2, null),
  ('Zscaler', 2, null),
  ('Twilio', 2, null),
  ('BILL', 2, null),
  ('2K', 2, null),
  ('Toast', 2, null),
  ('DV Trading', 2, 'real prop-trading firm, but not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('Belvedere Trading', 2, 'real prop-trading firm, but not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('SoFi', 2, null),
  ('New Relic', 2, null),
  ('Asana', 2, null),
  ('Okta', 2, null),
  ('e.l.f. Beauty', 2, null),
  ('Oscar Health', 2, null),
  ('Betterment', 2, null),
  ('Carta', 2, null),
  ('Schonfeld', 2, 'real multi-strategy fund, but not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('Twitch', 2, null),
  ('PagerDuty', 2, null),
  ('Wealthfront', 2, null),
  ('Reddit', 2, null),
  ('Samsara', 2, null),
  ('Datadog', 2, null),
  ('Wiz, Inc.', 2, null),
  ('Roku', 2, null),
  ('Coursera', 2, null),
  ('Rocket Lab Corporation', 2, null),
  ('Flow Traders', 2, 'real market-making firm, but not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('FanDuel', 2, null),
  ('Elastic', 2, null),
  ('Zoox', 2, 'Amazon-owned, but held to the clearly-elite tier-1 bar, not "subsidiary of a famous parent"'),
  ('Waymo', 2, 'Alphabet-owned, but held to the clearly-elite tier-1 bar, not "subsidiary of a famous parent"'),
  ('Cloudflare', 2, null),

  -- ---- Tier 3: everyone else (also the default for anything unlisted) ----
  ('Payoneer', 3, null),
  ('Astranis', 3, null),
  ('Anchorage Digital', 3, null),
  ('Attentive', 3, null),
  ('N26', 3, null),
  ('Agility Robotics', 3, null),
  ('Vercel', 3, null),
  ('Alloy', 3, null),
  ('Stitch Fix', 3, null),
  ('Airtable', 3, null),
  ('Coalition, Inc.', 3, null),
  ('Coupa', 3, null),
  ('Melio', 3, null),
  ('Tenable, Inc.', 3, null),
  ('Amplitude', 3, null),
  ('Netskope', 3, null),
  ('SoundCloud', 3, null),
  ('Udemy', 3, null),
  ('Figure', 3, null),
  ('Tala', 3, null),
  ('Guild', 3, null),
  ('Nuro', 3, null),
  ('StockX', 3, null),
  ('Rubrik Job Board', 3, null),
  ('MyFitnessPal', 3, null),
  ('Flexport', 3, null),
  ('Fastly', 3, null),
  ('Webflow', 3, null),
  ('ChargePoint', 3, null);
