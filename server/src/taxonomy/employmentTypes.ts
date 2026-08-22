import type { EmploymentType } from "../types.js";

// US-10/US-13 (partial) -- exact-match lookup first, per §3.2's normalization
// order of preference. Deliberately simple: employment type has a small,
// well-known vocabulary, so a regex/LLM fallback isn't needed here.
// Word-boundary'd on intern/co-op -- found via the Stage 3 Greenhouse pilot
// against real Stripe titles: unbounded /intern(ship)?/ matches "Internal
// Audit Lead" and "International Accounting Lead" as substrings,
// misclassifying senior full-time roles as internships (9 real titles hit
// this in one fetch). /co-?op/ has the same latent risk against
// "Cooperation"/"Cooperative" titles, fixed defensively even though no live
// collision was observed yet.
const EMPLOYMENT_TYPE_PATTERNS: Array<{ pattern: RegExp; type: EmploymentType }> = [
  { pattern: /\bintern(ship)?\b/i, type: "internship" },
  { pattern: /\bco-?op\b/i, type: "co_op" },
  { pattern: /fellowship/i, type: "fellowship" },
  { pattern: /apprentice/i, type: "apprenticeship" },
  { pattern: /part[\s-]?time/i, type: "part_time" },
  { pattern: /full[\s-]?time|permanent|analyst\b|associate\b/i, type: "full_time" },
];

// Returns null (not a default) when nothing matches -- callers decide how to
// handle an unclassifiable input rather than silently guessing "full_time".
export function normalizeEmploymentType(text: string | undefined | null): EmploymentType | null {
  if (!text) return null;
  for (const { pattern, type } of EMPLOYMENT_TYPE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return null;
}
