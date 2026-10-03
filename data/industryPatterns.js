// Recognising a job's industries from its TITLE. Shared by the profile's match score
// (data/jobMatch.js) and the Jobs page's industry filter (data/realJobAdapter.js), so a member
// who picks an industry and a member who filters by it see the same jobs.
//
// Why titles: the ingestion taxonomy (server/src/taxonomy/occupationTaxonomy.ts) tags only a
// handful of occupations, so ~66% of live jobs carry no structured industry at all. A title is
// the one signal every job has. Only the title is used, never the description -- the board list
// doesn't fetch descriptions, and a job has to score the same on every page.
//
// Patterns are deliberately conservative: a miss leaves a job untagged (it still ranks by its
// other factors); a wrong hit would tell a member a job fits an industry it doesn't. A job can
// satisfy several industries ("Business Development" is both corporate strategy and sales).
//
// Every name here is in data/careerOptions.js's INDUSTRIES; "Still figuring it out" has none.

import { canonicalIndustry } from "./careerOptions.js";

export const INDUSTRY_TITLE_PATTERNS = {
  // --- Consulting ---
  "Management consulting": [/consult/i, /\bstrategy analyst\b/i, /\bmanagement analyst\b/i],
  "Technology consulting": [/technology consult/i, /\bit consult/i, /digital consult/i],
  "Human capital consulting": [/human capital/i, /organi[sz]ational consult/i, /talent consult/i],
  "Economic consulting": [/\beconomi(c|st)/i, /econometric/i, /\bantitrust\b/i],
  "Healthcare consulting": [/health(care)? consult/i, /life sciences? consult/i, /pharma consult/i],
  "Financial advisory & restructuring": [/restructuring/i, /financial advisory/i, /transaction (advisory|services)/i, /\bforensic\b/i, /turnaround/i, /corporate recovery/i],
  "Public sector consulting": [/(public sector|government|federal|defense).*consult/i, /consult.*(public sector|government|federal)/i],

  // --- Finance ---
  "Investment banking": [/investment bank/i, /\bibd\b/i, /\bm&a\b/i, /\bmergers\b/i],
  "Private equity": [/private equity/i, /\bpe\b analyst/i],
  "Venture capital": [/venture capital/i, /\bvc\b analyst/i],
  "Hedge funds / asset management": [/hedge fund/i, /asset management/i, /portfolio (analyst|manager)/i],
  "Corporate finance / FP&A": [/\bfp&a\b/i, /corporate finance/i, /financial planning/i],
  "Commercial & retail banking": [/commercial bank/i, /retail bank/i],
  "Fintech": [/fintech/i, /\bpayments?\b/i],
  "Insurance & actuarial": [/actuar/i, /insurance/i],
  "Quantitative trading": [/\bquant(itative)?\b/i, /\btrader\b/i, /trading (systems|strategist|infrastructure)/i, /\balgo(rithmic)? trad/i],
  "Sales & trading": [/sales\s*(&|and)\s*trading/i, /\bflow trad/i, /securities (sales|trad)/i, /\bmarkets? (analyst|associate)\b/i],
  "Equity research": [/equity research/i, /\bsell[- ]side\b/i, /credit research/i],
  "Wealth management": [/\bwealth\b/i, /private (client|bank)/i, /financial advis[eo]r/i],
  "Credit & lending": [/\bcredit\b/i, /\blending\b/i, /underwrit/i, /\bloans?\b/i, /mortgage/i],
  "Accounting & audit": [/accounting/i, /\baudit/i, /\baccountant\b/i, /\bcontroller\b/i, /bookkeep/i, /\bcpa\b/i],
  "Tax": [/\btax(ation)?\b/i],
  "Risk & compliance": [/\brisk\b/i, /compliance/i, /\bkyc\b/i, /\baml\b/i, /anti[- ]money/i],
  "Crypto & digital assets": [/crypto/i, /blockchain/i, /digital asset/i, /\bdefi\b/i, /\bweb3\b/i],

  // --- Business & corporate ---
  "Marketing & brand strategy": [/marketing/i, /brand (strategy|manager)/i],
  "Corporate strategy & business development": [/corporate strategy/i, /business development/i, /\bbiz dev\b/i],
  "Product management": [/product (manager|management)/i, /\btpm\b/i],
  "Operations & supply chain": [/\boperations\b/i, /supply chain/i, /logistics/i],
  "Sales & business development": [/\bsales\b/i, /account executive/i, /business development/i],
  "Human resources / people operations": [/human resources/i, /people operations/i, /\bhr\b/i, /talent acquisition/i, /\brecruit/i],
  "Legal & regulatory": [/\blegal\b/i, /\bcounsel\b/i, /\battorney\b/i, /\blaw\b/i, /\bparalegal\b/i, /regulatory/i, /litigation/i, /\bprivacy\b/i, /contracts? (manager|specialist|analyst)/i],
  "Public relations & communications": [/public relations/i, /\bpr\b (manager|specialist|associate)/i, /communications?\b/i, /media relations/i, /\bpress\b/i],
  "Customer success & account management": [/customer success/i, /account (manager|management)/i, /client (success|partner|relations|service)/i, /customer experience/i],
  "Procurement & sourcing": [/procurement/i, /\bsourcing\b/i, /\bpurchasing\b/i, /vendor management/i, /category manager/i],
  "Entrepreneurship / startups": [/\bfound(er|ers|ing)\b/i, /entrepreneur/i, /\beir\b/i],
  "Education & edtech": [/\beducation\b/i, /\bteacher\b/i, /curriculum/i, /instructional/i, /learning (experience|design)/i, /\btutor/i, /\bedtech\b/i],
  "Design & UX": [/\bdesigner\b/i, /\bux\b/i, /\bui\b/i, /product design/i, /user experience/i, /visual design/i, /creative director/i],
  "Program & project management": [/program manage/i, /project manage/i, /\bpmo\b/i, /scrum master/i, /delivery manager/i],
  "Business operations & chief of staff": [/chief of staff/i, /business operations/i, /\bbiz ?ops\b/i, /strategy\s*(&|and)\s*operations/i, /strategic operations/i, /operations (strategy|excellence)/i],

  // --- Tech ---
  "Tech / product strategy": [/product strategy/i, /technology strategy/i],
  "Data & analytics": [/data analy/i, /data scien/i, /\banalytics\b/i],
  "Software engineering": [/software engineer/i, /software develop/i, /\bswe\b/i],
  "Cybersecurity": [/cybersecurity/i, /security engineer/i, /\binfosec\b/i],
  "AI & machine learning": [/\bai\b/i, /machine learning/i, /\bml\b/i, /deep learning/i, /\bllm\b/i, /\bnlp\b/i, /computer vision/i, /applied scientist/i, /research scientist/i, /artificial intelligence/i],
  "Cloud & infrastructure": [/\bcloud\b/i, /infrastructure/i, /\bdevops\b/i, /\bsre\b/i, /site reliability/i, /platform engineer/i, /network engineer/i, /kubernetes/i],
  "Hardware & semiconductors": [/hardware/i, /semiconductor/i, /\basic\b/i, /\bfpga\b/i, /electrical engineer/i, /firmware/i, /embedded/i, /\brf\b/i, /silicon/i, /\bpcb\b/i],
  "Robotics & automation": [/robot/i, /automation/i, /autonom/i, /controls engineer/i, /mechatronic/i],
  "Gaming": [/\bgames?\b/i, /gaming/i, /esports/i],

  // --- Other sectors ---
  "Consumer goods & retail": [/consumer goods/i, /\bretail\b/i, /\bcpg\b/i],
  "Media & entertainment": [/\bmedia\b/i, /entertainment/i, /content strategy/i],
  "Energy & sustainability": [/\benergy\b/i, /sustainab/i, /renewable/i],
  "Healthcare": [/healthcare/i, /health care/i, /clinical/i, /pharma/i],
  "Real estate": [/real estate/i],
  "Nonprofit / public sector": [/nonprofit/i, /non-profit/i, /public sector/i, /government affairs/i],
  "Aerospace & defense": [/aerospace/i, /\bdefense\b/i, /\bspace(craft|flight)?\b/i, /propulsion/i, /avionics/i, /rocket/i, /launch (vehicle|operations|engineer)/i, /satellite/i, /starlink/i, /starship/i, /missile/i, /\bgnc\b/i, /flight (software|operations|test)/i],
  "Automotive & mobility": [/automotive/i, /\bvehicles?\b/i, /\bev\b/i, /mobility/i, /powertrain/i, /\bbattery\b/i, /autopilot/i],
  "Biotech & pharma": [/biotech/i, /pharma/i, /clinical/i, /biolog/i, /\bdrug\b/i, /therapeutic/i, /\bgmp\b/i, /regulatory affairs/i, /medical affairs/i],
  "Manufacturing & industrial": [/manufacturing/i, /\bindustrial\b/i, /mechanical engineer/i, /production (manager|engineer|planner)/i, /quality (engineer|assurance)/i, /process engineer/i, /\bfactory\b/i, /supplier quality/i],
  "Travel & hospitality": [/\btravel\b/i, /hospitality/i, /\bhotel\b/i, /\bairline\b/i, /\bairport\b/i],
  "Telecommunications": [/telecom/i, /wireless/i, /\b5g\b/i, /broadband/i],
  "Logistics & transportation": [/logistics/i, /supply chain/i, /transportation/i, /freight/i, /\bfleet\b/i, /shipping/i, /warehouse/i, /fulfillment/i, /last mile/i],
  "Food & agriculture": [/\bfood\b/i, /agricultur/i, /\bagri/i, /beverage/i, /restaurant/i, /nutrition/i],
  "Fashion & luxury": [/fashion/i, /apparel/i, /luxury/i, /merchandis/i, /\bbeauty\b/i, /cosmetic/i, /footwear/i],
  "Government & policy": [/\bpolicy\b/i, /government/i, /public affairs/i, /\bcivic\b/i, /\bfederal\b/i],
  "Sports & fitness": [/\bsports?\b/i, /athlet/i, /fitness/i],
};

export function industryTitleHit(industryPref, title) {
  if (!title) return false;
  const patterns = INDUSTRY_TITLE_PATTERNS[canonicalIndustry(industryPref)];
  return patterns?.some((p) => p.test(title)) ?? false;
}

// Every industry a title reads as, for filtering and display. Cheap enough per job; callers build
// it once per job (realJobToCardShape), not per render.
export function industriesFromTitle(title) {
  if (!title) return [];
  return Object.keys(INDUSTRY_TITLE_PATTERNS).filter((name) => INDUSTRY_TITLE_PATTERNS[name].some((p) => p.test(title)));
}
