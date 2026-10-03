-- 14 more companies on Greenhouse (13) and Lever (1), chosen to widen the board with new employers rather than
-- by raising tier caps (decision 2026-10-03: ~1,500 active jobs is fine; more companies, not bigger caps).
--
-- Found by probing ~290 candidate employers against the public Greenhouse/Lever/Ashby APIs. Consulting is thin
-- by nature: of ~45 consulting/advisory/research firms tried only Teneo and Thoughtworks run a public board
-- (Kearney, Huron, FTI, Slalom, ZS, Putnam, LEK, Analysis Group, ... have none). The rest are the strongest
-- finance, research-network and growth-company hits with early-career roles.
--
-- Each was identity-checked (Greenhouse self-reports `company_name`; the fetcher also refuses a mismatching
-- posting) and run through the real relevance filter (isLikelySeniorRole OR isLikelyNonCorporateRole):
--   Teneo 17/51, Man Group 42/57, GLG 76/99, AlphaSense 97/202, Coleman Research 8/10, Thoughtworks 21/31,
--   a16z 16/19, Verkada 201/307, Vast 119/201, Shield AI (Lever) 175/596, Flatiron Health 19/29,
--   Clover Health 33/68, BitGo 21/39, Ginkgo Bioworks 10/20.
-- Rejected after the same check: Oliver Wyman's Lever board (2 postings, could not confirm it is the real
-- firm), Epirus (1 early-career role), Gopuff / Lyra Health / Included Health (delivery or clinical work).
--
-- Coleman Research's board names itself "VISASQ/COLEMAN", and the fetcher's identity check compares against that
-- exact string, so that is what the company is called here.
--
-- Same terms position as every Greenhouse/Lever source in this app: public unauthenticated API, no description
-- text stored. Tiers set the per-company cap (25/15/10/5) and ranking weight; they are a suggestion an admin can
-- change on the Company tiers page.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
select
  v.company || ' (' || v.label || ')', 'employer_api', 'approved', true,
  'Polled with every other ' || v.platform_name || ' company on the batched schedule.',
  false,
  'Do not store full job description text -- same policy as every ' || v.platform_name || ' source in this app.',
  false,
  v.notes,
  jsonb_build_object('platform', v.platform, 'slug', v.slug, 'company', v.company)
from (values
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'teneo', 'Teneo', 'Public Job Board API, boards-api.greenhouse.io/v1/boards/teneo/jobs. Global advisory firm (financial advisory, strategy, communications). 17/51 survive the relevance filter.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'mangroup', 'Man Group', 'Public Job Board API. Hedge fund / asset manager; includes a 2027 summer internship programme. 42/57 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'gersonlehrmangroup', 'GLG', 'Public Job Board API. Expert network, same family as AlphaSights, Guidepoint and Third Bridge (already tracked). 76/99 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'alphasense', 'AlphaSense', 'Public Job Board API. Financial research platform; Chicago/New York offices. 97/202 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'colemanresearch', 'VISASQ/COLEMAN', 'Public Job Board API. Coleman Research expert network (board self-reports "VISASQ/COLEMAN"). 8/10 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'thoughtworks', 'Thoughtworks', 'Public Job Board API. Technology consultancy; mostly non-US postings. 21/31 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'a16z', 'a16z', 'Public Job Board API. Venture capital firm. 16/19 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'verkada', 'Verkada', 'Public Job Board API. Physical-security platform; pricing/commercial associates and 2027 interns. 201/307 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'vast', 'Vast', 'Public Job Board API. Commercial space-station company, Long Beach and Hawthorne; engineering internships. 119/201 survive.'),
  ('lever', 'Lever', 'Lever Postings API', 'shieldai', 'Shield AI', 'Public Postings API, api.lever.co/v0/postings/shieldai. Defense technology. 175/596 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'flatironhealth', 'Flatiron Health', 'Public Job Board API. Oncology data and software company, New York. 19/29 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'cloverhealth', 'Clover Health', 'Public Job Board API. Medicare Advantage insurer. 33/68 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'bitgo', 'BitGo', 'Public Job Board API. Digital-asset custody. 21/39 survive.'),
  ('greenhouse', 'Greenhouse', 'Greenhouse Job Board API', 'ginkgobioworks', 'Ginkgo Bioworks Inc.', 'Public Job Board API. Synthetic biology; graduate-intern roles. 10/20 survive.')
) as v(platform, platform_name, label, slug, company, notes)
where not exists (select 1 from sources s where s.config->>'platform' = v.platform and s.config->>'slug' = v.slug);

insert into company_tiers (company_name, tier, note) values
  ('Teneo', 1, 'global advisory firm'),
  ('Man Group', 1, 'hedge fund / asset manager'),
  ('GLG', 2, 'expert network'),
  ('AlphaSense', 2, 'financial research platform'),
  ('VISASQ/COLEMAN', 3, 'Coleman Research expert network'),
  ('Thoughtworks', 3, 'technology consultancy, mostly non-US postings'),
  ('a16z', 3, 'venture capital'),
  ('Verkada', 2, 'physical-security platform'),
  ('Vast', 2, 'commercial space station'),
  ('Shield AI', 2, 'defense technology'),
  ('Flatiron Health', 3, 'oncology data and software'),
  ('Clover Health', 3, 'Medicare Advantage insurer'),
  ('BitGo', 3, 'digital-asset custody'),
  ('Ginkgo Bioworks Inc.', 3, 'synthetic biology')
on conflict (company_name) do nothing;
