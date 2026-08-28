// Mirror of supabase/functions/_shared/pipeline/relevance.ts -- keep both
// copies in sync (this codebase has been bitten twice by two copies of the
// same pipeline logic drifting apart; see JOB_ENGINE_ARCHITECTURE.md's
// US-56/US-09 writeup). This file has no test-only purpose of its own: it
// exists so server/tests/relevance.test.ts can exercise the exact same
// regexes the deployed Edge Functions run, the same way normalize.ts and
// occupationTaxonomy.ts already have real server/src/ mirrors alongside
// their Edge Function copies.

// Title-based relevance filter for ATS adapters (fetch-greenhouse-companies,
// fetch-deloitte-jobs) that pull a company's *entire* public job board
// rather than a pre-scoped feed. Greenhouse in particular has no way to ask
// "only entry-level/student roles" -- it returns every open req company-wide,
// so a company like Databricks (820 postings) is overwhelmingly senior
// individual-contributor and management roles no UC undergrad would ever
// apply to. Ingesting those anyway wasn't just noise: it was real, avoidable
// Edge Function compute (the O(n^2) dedup cost documented in dedupe.ts scales
// with however many postings get this far) spent processing roles the Jobs
// board was never going to usefully surface.
//
// Denylist, not allowlist, and deliberately conservative: an allowlist (only
// keep titles containing "intern"/"analyst"/"associate"/etc.) would silently
// drop real entry-level roles that carry no seniority marker at all in their
// title (common at big tech employers -- a new-grad hire is often just
// "Software Engineer", no "I" or "entry" suffix). A denylist only removes
// titles carrying an explicit senior/executive signal, so the failure mode
// on an ambiguous title is "kept, let a member judge for themselves" rather
// than "dropped, member never sees it" -- the same asymmetry that motivated
// keeping a low-confidence odds-model factor visible instead of suppressing
// it (see CLAUDE.md's sparse-data decision).
//
// Deliberately excludes "manager", "lead", and bare "executive" -- all
// legitimately entry/mid-level titles at some companies (Product Manager,
// Team Lead, Account Executive are common non-senior tech/sales titles), so
// including them would cut real relevant roles, not just noise.
const SENIOR_TITLE_PATTERN =
  /\b(senior|sr\.?|staff|principal|distinguished|director|vp|svp|evp|vice president|head of|chief|president|fellow)\b/i;

export function isLikelySeniorRole(title: string): boolean {
  return SENIOR_TITLE_PATTERN.test(title);
}

// Second denylist, same axis of conservatism, different question: not "is
// this too senior" but "is this the *kind* of job UC Portal exists for at
// all." UC Portal serves UCLA business-club students seeking white-collar
// corporate roles -- finance, consulting, tech, investment banking, general
// corporate-office work. Two source companies exposed this gap concretely:
// Carvana's Greenhouse board is 45% of the entire live jobs table (1,474 of
// ~3,283 active rows) and the overwhelming majority of that is manual/
// hourly automotive-operations work (detailers, technicians, CDL drivers,
// security guards) that isLikelySeniorRole() correctly lets through, since
// it isn't senior, it's just the wrong *kind* of job. Charlie Health mixes
// genuine corporate roles (Commercial Strategy Associate, Growth Strategy
// Analyst) with direct clinical/patient-care postings (Licensed Mental
// Health Therapist, Crisis Intervention Specialist, SUD Group Facilitator).
//
// Same denylist discipline as SENIOR_TITLE_PATTERN: keyword-based, not a
// classifier, and deliberately conservative -- an ambiguous title (no clear
// manual-trade or clinical-care marker) is kept, not dropped. That also
// means neither pattern tries to catch every synonym; each word here was
// checked against every active company's real titles (not just Carvana/
// Charlie Health) before being added, specifically to keep it from also
// catching legitimate corporate titles that happen to share a word:
//   - "security" alone is NOT used -- Databricks/Figma/Stripe/IMC/Airbnb/
//     Deloitte all have real "Security Engineer"/"Information Security"
//     roles. Only the unambiguous "security guard" phrase is denylisted.
//   - "delivery" alone is NOT used -- Databricks has 14 real "Delivery
//     Solutions Architect" postings and Deloitte has a "Tech Delivery"
//     consultant role. Only "delivery driver/ambassador/advocate/specialist"
//     and "vehicle/customer delivery" are denylisted.
//   - "warehouse" is scoped to "warehouse associate/worker/supervisor/
//     technician" rather than left bare, since "Data Warehouse" is a common
//     legitimate title fragment at data/analytics employers even though no
//     current posting collides.
//   - "operator" is scoped to "line operator"/"machine operator" -- Stripe
//     has a real "Engineering Manager, Operator Tooling" role.
//   - "tech" is NOT used bare -- "Tech Lead", "Tech Ops", "Tech Delivery",
//     and "High Tech" all appear as real corporate/tech titles across
//     Airbnb/Databricks/Deloitte/Stripe/IMC. Carvana's many "___ Tech"
//     abbreviations (PDR Tech, Lube Tech, Heavy Body Tech, Combo Tech,
//     Diagnostic Tech, Auto Tech, Body Tech) are instead caught by their
//     specific trade-word prefixes.
//   - "counselor" is spelled out in full -- a substring match on "counsel"
//     would have wrongly caught every "Counsel"/"Legal Counsel"/"Assistant
//     General Counsel" attorney title (Brex, Coinbase, Databricks, Figma,
//     IMC, Robinhood, Stripe all have real ones).
//   - "clinical"/"facilitator"/"care coach"/"care navigator"/"mental
//     health"/"crisis intervention" are used relatively broadly (not
//     narrowed to exact Charlie Health phrasings) because zero other
//     company in the live table uses any of those words for a legitimate
//     corporate title -- UC Portal's company roster is curated
//     consulting/finance/tech employers, so the forward risk is low.
//   - bare "sud" was deliberately dropped after validation: Charlie Health
//     also posts "Territory Manager, SUD (...)" roles (a real field-sales/
//     business-development title, not clinical), and every genuinely
//     clinical SUD posting already contains "Facilitator" and is caught by
//     that branch instead. "Patient" was dropped for the same reason --
//     it only ever appeared in "Patient Finance Collector/Specialist",
//     which are billing/collections roles, not direct patient care.
//   - "Data Entry Specialist" (Carvana) is included per an explicit human
//     judgment call: not manual trade in the literal sense, but not a
//     business/finance/consulting/tech role either.
const MANUAL_TRADE_TITLE_PATTERN =
  /\b(technicians?|mechanics?|painters?|detailers?|preppers?|airbrush(es)?|inspectors?|cdl|lot\s+attendants?|lot\s+assistants?|auto\s*body|upholstery|security\s+guards?|data\s+entry|wheel\s+repair|dent\s+repair|parts\s+associates?|line\s+operators?|machine\s+operators?|warehouse\s+(associates?|workers?|supervisors?|technicians?)|delivery\s+(drivers?|ambassadors?|advocates?|specialists?)|(vehicle|customer)\s+delivery|drivers?|forklift|custodians?|housekeeping|cashiers?|pdr|lube|refinish\w*|interior\s+repair|glass\s+repair|heavy\s+body|body\s+techs?|rim\s+repair|restoration|brakes?|combo\s+techs?|diagnostic\s+techs?|auto\s+techs?)\b/i;

const CLINICAL_CARE_TITLE_PATTERN =
  /\b(therapists?|clinicians?|counselors?|nurses?|nursing|physicians?|psychiatr\w*|social\s+workers?|care\s+coach(es)?|crisis\s+intervention|behavioral\s+health(\s+specialists?)?|clinical|facilitators?|mental\s+health|substance\s+use\s+disorder|lcsw|lmft|lpc|rn|care\s+navigators?|(clinical|patient)\s+case\s+managers?)\b/i;

export function isLikelyNonCorporateRole(title: string): boolean {
  return MANUAL_TRADE_TITLE_PATTERN.test(title) || CLINICAL_CARE_TITLE_PATTERN.test(title);
}
