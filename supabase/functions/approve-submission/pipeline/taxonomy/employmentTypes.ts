import type { EmploymentType } from "../types.ts";

// US-10/US-13 (partial) -- exact-match lookup first, per §3.2's normalization
// order of preference. Deliberately simple: employment type has a small,
// well-known vocabulary, so a regex/LLM fallback isn't needed here.
// Ported unchanged from server/src/taxonomy/employmentTypes.ts.
const EMPLOYMENT_TYPE_PATTERNS: Array<{ pattern: RegExp; type: EmploymentType }> = [
  { pattern: /intern(ship)?/i, type: "internship" },
  { pattern: /co-?op/i, type: "co_op" },
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
