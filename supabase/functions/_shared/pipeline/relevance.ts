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
