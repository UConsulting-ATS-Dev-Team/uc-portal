-- Classifies every real company that was still sitting on the tier-3
-- default when the admin "Company tiers" view (pages/AdminDashboard.jsx)
-- first went live -- 75 companies, none previously reviewed. Direct
-- instruction after that view surfaced Third Bridge (214 active postings,
-- unclassified) alongside SpaceX/HelloFresh (already handled in the prior
-- migration's live follow-up): "go classify every job in there if not
-- already classified." Same judgment-call discipline as the original
-- seed (20260909070000_company_tiers.sql) -- not an exact science for the
-- tier-2/tier-3 middle of the pack, per that migration's own standing
-- direction, but real Tier 0/1 calls get a `note` explaining why.
--
-- Notable calls:
--   - Third Bridge, Guidepoint -- expert-network firms recruiting the
--     same pool as MBB/PE, same category as the original seed's
--     AlphaSights (tier 1, not tier 0 -- neither is itself a consulting
--     firm).
--   - Jump Trading, Jane Street, IMC, Point72 -- individually famous
--     enough for data/industryBaseRates.js's own named-company map
--     (Jump/Jane Street/IMC already listed there as "Citadel-tier";
--     Point72 added here as an equally famous, if not yet in that file,
--     elite hedge fund) -- tier 1, consistent with Akuna/XTX from the
--     original seed.
--   - Tower Research Capital, Qube Research & Technologies, Squarepoint
--     Capital, Geneva Trading, Graham Capital Management, Simplex
--     Trading, ExodusPoint, PDT Partners, Old Mission, GSA (assumed GSA
--     Capital given the surrounding quant-firm cluster) -- real,
--     legitimate prop-trading/quant firms, but per industryBaseRates.js's
--     own documented distinction, not individually famous the way
--     Citadel/Jane Street/Jump/IMC are -- tier 2, same call as the
--     original seed's DV Trading/Belvedere Trading/Schonfeld/Flow
--     Traders.
--   - William Blair -- respected Chicago-based boutique/middle-market
--     investment bank, not bulge-bracket but genuinely elite in its
--     category -- tier 1, same "other elite name-brand" reasoning as the
--     original seed's bulge-bracket picks.
--   - ICONIQ, General Atlantic, General Catalyst -- major, prestigious
--     VC/growth-equity firms -- tier 1, same call as the original seed's
--     Bessemer Venture Partners.
--   - Elixirr Consulting -- a real, publicly-listed challenger
--     consultancy -- the only genuine tier-0 (core consulting) addition
--     in this batch.
--   - Charlie Health -- already flagged in _shared/pipeline/relevance.ts's
--     own header comment as a mixed corporate/clinical employer; kept at
--     tier 3 here for the same reason the original seed never gave it a
--     higher tier.
--   - "CTC Lateral - Website & LinkedIn" -- an oddly-formatted company
--     name (likely Chicago Trading Company, matching the nearby
--     quant-firm cluster, picked up with extra source-name text attached)
--     -- classified tier 2 on that assumption, but flagged here as
--     possibly worth a source-name cleanup separately from this
--     migration's own scope.
insert into company_tiers (company_name, tier, note) values
  -- ---- Tier 0 ----
  ('Elixirr Consulting', 0, 'real, publicly-listed challenger consultancy'),

  -- ---- Tier 1 ----
  ('Third Bridge', 1, 'expert-network firm recruiting the same pool as MBB/PE -- consulting-adjacent, not itself a consulting firm'),
  ('Guidepoint', 1, 'expert-network firm, same category as Third Bridge/AlphaSights'),
  ('Jump Trading', 1, 'Citadel-tier elite quant trading, per data/industryBaseRates.js'),
  ('Jane Street', 1, 'Citadel-tier elite quant trading, per data/industryBaseRates.js'),
  ('IMC', 1, 'Citadel-tier elite quant trading, per data/industryBaseRates.js (same firm as "IMC Trading")'),
  ('Point72', 1, 'major, individually famous hedge fund'),
  ('Figma', 1, 'elite big tech/design, high-profile IPO'),
  ('Scale AI', 1, 'elite AI company, major funding and industry profile'),
  ('Epic Games', 1, 'elite big tech/gaming, globally famous'),
  ('William Blair', 1, 'respected boutique/middle-market investment bank'),
  ('ICONIQ', 1, 'major, prestigious VC/family office'),
  ('General Atlantic', 1, 'major, prestigious global growth-equity firm'),
  ('General Catalyst', 1, 'major, prestigious VC firm'),

  -- ---- Tier 2 ----
  ('Carvana', 2, null),
  ('Tower Research Capital', 2, 'real prop-trading firm, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('Qube Research & Technologies', 2, 'real prop-trading firm, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('sweetgreen', 2, null),
  ('The Trade Desk', 2, null),
  ('Affirm', 2, null),
  ('Riot Games', 2, null),
  ('Virtu Financial', 2, 'real market-making firm, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('Lucid Motors', 2, null),
  ('Brex', 2, null),
  ('GitLab', 2, null),
  ('Robinhood', 2, null),
  ('Block', 2, null),
  ('Roblox', 2, null),
  ('Chime Financial, Inc', 2, null),
  ('Old Mission', 2, 'real prop-trading firm, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('Peloton', 2, null),
  ('Gusto, Inc.', 2, null),
  ('Klaviyo', 2, null),
  ('Lyft', 2, null),
  ('MongoDB', 2, null),
  ('Ripple', 2, null),
  ('Squarepoint Capital', 2, 'real prop-trading firm, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('Pinterest', 2, null),
  ('Duolingo', 2, null),
  ('Instacart', 2, null),
  ('Discord', 2, null),
  ('Glossier', 2, null),
  ('Dropbox', 2, null),
  ('Squarespace', 2, null),
  ('Geneva Trading', 2, 'real prop-trading firm, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('Gemini', 2, null),
  ('StubHub', 2, null),
  ('PDT Partners', 2, 'real quant fund, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('GSA', 2, 'assumed GSA Capital given the surrounding real quant-firm cluster -- worth confirming'),
  ('Graham Capital Management, L.P.', 2, 'real quant fund, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('Fanatics Inc.', 2, null),
  ('Simplex Trading', 2, 'real prop-trading firm, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('ExodusPoint', 2, 'real quant fund, not individually famous the way Citadel-tier names are -- see industryBaseRates.js'),
  ('Consensys', 2, null),
  ('CTC Lateral - Website & LinkedIn', 2, 'oddly-formatted company name, assumed Chicago Trading Company -- possibly worth a source-name cleanup'),

  -- ---- Tier 3 ----
  ('Charlie Health', 3, 'mixed corporate/clinical employer, see _shared/pipeline/relevance.ts'),
  ('Fireblocks', 3, null),
  ('Justworks', 3, null),
  ('Redwood Materials', 3, null),
  ('Relativity Space', 3, null),
  ('Planet', 3, null),
  ('Cross River', 3, null),
  ('Checkr', 3, null),
  ('Culture Amp', 3, null),
  ('Mercury', 3, null),
  ('Everlaw', 3, null),
  ('Rent the Runway', 3, null),
  ('Faire', 3, null),
  ('Bombas', 3, null),
  ('Engineers Gate', 3, null),
  ('Voloridge Investment Management', 3, null),
  ('Doximity', 3, null),
  ('SeatGeek', 3, null),
  ('MasterClass', 3, null),
  ('Public', 3, null);
