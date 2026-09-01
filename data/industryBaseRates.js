// Tiered industry-baseline prior for the real odds model's "UC track
// record" factor (data/realOddsModel.js's computeRealOdds()), used ONLY
// to replace the flat DEFAULT_BASE_RATE (0.08) fallback that fires when a
// real job has genuinely ZERO real UC applicant data (job-level AND
// company-level, per job_track_record_report()). Real UC data, whenever
// any exists -- even n=1 -- still wins outright per CLAUDE.md's
// sparse-data rule; this module is never consulted in that case.
//
// WHY: a flat 8% fallback makes every company look equally likely
// regardless of how competitive it actually is. MBB/bulge-bracket
// investment banking/elite quant trading are genuinely ~1-2 orders of
// magnitude harder to break into than a typical mid-size employer, and
// showing a flat number before any real outcome data exists misleads
// members. Per this feature's own standing direction: "I don't need real
// data to know that MBB is going to be really low chance... the
// percentages don't have to be perfect, I want people to have a good
// ballpark estimate." This is a defensible ballpark, not audited HR data
// -- see the honesty note on NAMED_COMPANY_RATES below and the labeling
// this feeds into (realOddsModel.js's industryBaselineNote / OddsModel.jsx).
//
// STRUCTURE (two tiers, deliberately NOT a lookup table pretending to
// have precision it doesn't have):
//
// 1. NAMED_COMPANY_RATES -- a curated ~20-company map for firms famous
//    and scrutinized enough to have a real, independently findable
//    published (or industry-guide-cited) acceptance-rate figure. Matched
//    by whole-word, case-insensitive alias against job.company, since
//    real source data spells company names inconsistently ("Chime
//    Financial, Inc" vs "Chime", "IMC" vs "IMC Trading") -- this is
//    deliberately an alias/substring match, not exact equality.
//
// 2. Everything else (the large majority of this app's real job sources
//    -- Stripe, Databricks, Brex, Accordion, Carvana's corporate roles,
//    Charlie Health, most of the quant/prop-trading cluster that isn't
//    individually name-brand-famous, etc.) falls to one of two broad,
//    HONESTLY-labeled tiers rather than an invented per-company number:
//      - "competitive" (~5-15%, midpoint 10%) when UC's own industry
//        taxonomy (job.relevant_industries, populated at ingestion --
//        JOB_ENGINE_ARCHITECTURE.md §3.2 -- the same field
//        pages/RealJobDetail.jsx already reads for the "Target industry"
//        checklist row) classifies the posting as management consulting,
//        investment banking, or private equity. These three fields are
//        well-documented industry-wide as running far tighter
//        applicant-to-hire ratios than a typical corporate role,
//        independent of any specific employer's individual fame -- a
//        real, principled signal already computed and already fetched
//        with the job row, so this adds zero new DB round trips.
//      - "accessible" (~15-25%, midpoint 20%) for everything else -- the
//        honest default when there's neither a named-company match nor a
//        structurally-tight-industry classification.
//
// KNOWN, DOCUMENTED LIMITATION: this can under-tier a real but
// lesser-known boutique quant/prop-trading shop (e.g. one of the many
// real firms in this app's `sources` table that aren't one of the dozen
// individually-famous "Citadel-tier" names below and also aren't tagged
// with a tight `relevant_industries` value) into "accessible," even
// though the quant-trading industry generally runs tighter than that
// tier implies. Rather than invent a firm-specific number for a company
// with no public data, this deliberately stays in the honest
// "unknown, use the general tier" bucket per the same
// don't-fabricate-precision principle -- worth revisiting if a better
// real signal (e.g. real applicant-volume data once members start using
// the tracker) ever exists.
//
// SOURCES (verified live via web search 2026-09-01 for this feature,
// re-verify before treating these as evergreen -- acceptance rates move
// year to year):
//   - MBB: CaseCoach ("How Selective are Bain, BCG and McKinsey"),
//     Management Consulted 2026 placement results, HackingTheCaseInterview
//     -- McKinsey >200k applications/yr, ~2,000 offers (<1%); BCG/Bain
//     reported slightly higher, ~1-3%.
//   - Bulge-bracket IB: Fox Business / Entrepreneur (Goldman Sachs --
//     2,600 offers of 360,000 applicants, 2026 class, ~0.7%, third
//     consecutive sub-1% year); MSN (JPMorgan -- 4,100 of 630,000, 2025
//     class, ~0.7%; Morgan Stanley reported in the same sub-1% band,
//     tighter in at least one cited year).
//   - Elite quant/prop trading: Extern / a quant-internship guide
//     (Substack) -- Citadel ~350 of ~115,900 applicants, 2026 class,
//     ~0.36%; the same guide describes the broader "Citadel-tier" cluster
//     (Jane Street, Optiver, SIG, DRW, Two Sigma, D.E. Shaw, Hudson River
//     Trading, Jump Trading, Akuna Capital, XTX Markets, IMC Trading) as
//     "well under 2%" without individually publishing each firm's own
//     number -- grouped here at a shared ~1% industry-tier estimate
//     accordingly, not a fabricated per-firm figure.
//   - Elite big tech: Candor (Google APM ~0.55%, ~8,000 applicants/40
//     spots; general SWE internship low single digits) and
//     community/analyst estimates for Meta (~1-3%, no official figure
//     published by Meta itself).

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function companyMatchesAlias(companyName, alias) {
  const re = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
  return re.test(companyName);
}

export const NAMED_COMPANY_RATES = [
  // --- MBB consulting: not currently among this app's live real job
  // sources (none of the 77+ real sources are MBB -- verified by
  // scanning supabase/migrations' source-seed company names), but kept
  // here so the moment one is onboarded it's tiered correctly rather than
  // needing another pass.
  {
    aliases: ["mckinsey"],
    rate: 0.008,
    tierLabel: "MBB-tier consulting (McKinsey & Company)",
  },
  {
    aliases: ["bain & company", "bain and company"],
    rate: 0.015,
    tierLabel: "MBB-tier consulting (Bain & Company)",
  },
  {
    aliases: ["bcg", "boston consulting group"],
    rate: 0.015,
    tierLabel: "MBB-tier consulting (BCG)",
  },

  // --- Bulge-bracket investment banking: also not currently a live real
  // source in this app.
  {
    aliases: ["goldman sachs"],
    rate: 0.007,
    tierLabel: "bulge-bracket investment banking (Goldman Sachs)",
  },
  {
    aliases: ["jpmorgan", "jp morgan", "j.p. morgan"],
    rate: 0.007,
    tierLabel: "bulge-bracket investment banking (JPMorgan Chase)",
  },
  {
    aliases: ["morgan stanley"],
    rate: 0.007,
    tierLabel: "bulge-bracket investment banking (Morgan Stanley)",
  },

  // --- Elite quant / prop trading ("Citadel-tier"). 5 of these 12 --
  // Jane Street, Jump Trading, Akuna Capital, XTX Markets, IMC Trading --
  // are live real job sources in this app today (see
  // JOB_ENGINE_ARCHITECTURE.md's Sixth-through-Ninth-addition entries);
  // the other 7 are included because they're equally "obviously famous"
  // in the same quant-recruiting literature, in case they're onboarded
  // later. Deliberately does NOT extend this individual-name treatment to
  // the rest of this app's much larger real quant/prop-trading cluster
  // (Point72, Squarepoint Capital, ExodusPoint, Schonfeld, Qube Research
  // & Technologies, Chicago Trading Company, Tower Research Capital,
  // Virtu Financial, Old Mission Capital, DV Trading, Flow Traders,
  // Geneva Trading, Simplex Trading, Graham Capital Management, Belvedere
  // Trading, etc.) -- real firms, but without an individually-published
  // figure to point to; they fall through to the broader tier below (see
  // the documented limitation above).
  {
    aliases: ["citadel"],
    rate: 0.005,
    tierLabel: "elite quant trading (Citadel)",
  },
  { aliases: ["jane street"], rate: 0.01, tierLabel: "elite quant trading (Jane Street)" },
  { aliases: ["optiver"], rate: 0.01, tierLabel: "elite quant trading (Optiver)" },
  { aliases: ["susquehanna"], rate: 0.01, tierLabel: "elite quant trading (SIG)" },
  { aliases: ["drw"], rate: 0.01, tierLabel: "elite quant trading (DRW)" },
  { aliases: ["two sigma"], rate: 0.01, tierLabel: "elite quant trading (Two Sigma)" },
  { aliases: ["d.e. shaw", "de shaw"], rate: 0.01, tierLabel: "elite quant trading (D.E. Shaw)" },
  { aliases: ["hudson river trading"], rate: 0.01, tierLabel: "elite quant trading (Hudson River Trading)" },
  { aliases: ["jump trading"], rate: 0.01, tierLabel: "elite quant trading (Jump Trading)" },
  { aliases: ["akuna capital"], rate: 0.01, tierLabel: "elite quant trading (Akuna Capital)" },
  { aliases: ["xtx markets"], rate: 0.01, tierLabel: "elite quant trading (XTX Markets)" },
  { aliases: ["imc trading", "imc financial", "imc"], rate: 0.01, tierLabel: "elite quant trading (IMC Trading)" },

  // --- Elite big tech: not currently a live real source in this app.
  { aliases: ["google"], rate: 0.03, tierLabel: "elite big tech (Google)" },
  { aliases: ["meta"], rate: 0.02, tierLabel: "elite big tech (Meta)" },
];

// The three CLAUDE.md/data/careerOptions.js industry strings that are
// well-documented industry-wide as running much tighter applicant-to-hire
// ratios than a typical corporate role, independent of any one employer's
// individual fame -- exact strings must match INDUSTRIES in
// data/careerOptions.js / occupationTaxonomy.ts's relevantIndustries.
const TIGHT_INDUSTRIES = new Set(["Management consulting", "Investment banking", "Private equity"]);

const COMPETITIVE_RATE = 0.1; // midpoint of the "competitive/well-known" band (~5-15%)
const ACCESSIBLE_RATE = 0.2; // midpoint of the "accessible/smaller-volume" band (~15-25%)

function namedCompanyRate(companyName) {
  if (!companyName) return null;
  return NAMED_COMPANY_RATES.find((entry) => entry.aliases.some((alias) => companyMatchesAlias(companyName, alias))) ?? null;
}

// Pure, synchronous, zero DB round trips -- everything it reads
// (job.company, job.relevant_industries) is already on the job row
// RealJobDetail.jsx fetches for every other section of the page.
export function industryBaselineForJob(job) {
  const named = namedCompanyRate(job.company);
  if (named) {
    return { rate: named.rate, tierLabel: named.tierLabel };
  }
  const industries = job.relevant_industries || [];
  if (industries.some((i) => TIGHT_INDUSTRIES.has(i))) {
    return { rate: COMPETITIVE_RATE, tierLabel: "a consulting, investment-banking, or private-equity role" };
  }
  return { rate: ACCESSIBLE_RATE, tierLabel: "this type of role" };
}
