// US-27 -- graduation-year eligibility extraction. Rule-based (§3.2): both
// explicit years ("Class of 2027", "graduating 2027 or 2028") and
// class-standing words ("rising junior") are structured-but-variable text,
// so this is pattern rules, not an exact-match table or LLM.
// Ported unchanged from server/src/taxonomy/eligibility.ts.
const CLASS_STANDING_OFFSET: Record<string, number> = {
  freshman: 4,
  sophomore: 3,
  junior: 2,
  senior: 1,
};

// referenceYear defaults to "now" but is a parameter so tests (and callers
// working with synthetic/backdated data) get deterministic results rather
// than a moving target.
export function extractGraduationYears(
  text: string | undefined | null,
  referenceYear: number = new Date().getFullYear()
): number[] | null {
  if (!text) return null;
  const years = new Set<number>();

  const yearMatches = text.matchAll(/\b(20\d{2})\b/g);
  for (const m of yearMatches) years.add(parseInt(m[1], 10));

  for (const [word, offset] of Object.entries(CLASS_STANDING_OFFSET)) {
    if (new RegExp(`\\b${word}s?\\b`, "i").test(text)) {
      years.add(referenceYear + offset);
    }
  }

  return years.size > 0 ? Array.from(years).sort((a, b) => a - b) : null;
}
