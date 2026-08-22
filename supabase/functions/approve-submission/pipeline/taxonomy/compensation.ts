import type { CompensationType } from "../types.ts";

// US-12 -- compensation normalization. Regex-based (§3.2 step 2): comp text
// is structured-but-variable, exactly the category the architecture doc
// assigns to pattern rules rather than exact-match tables or an LLM.
// Ported unchanged from server/src/taxonomy/compensation.ts.
export interface NormalizedCompensation {
  min: number | null;
  max: number | null;
  type: CompensationType;
}

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const kMatch = cleaned.match(/^([\d.]+)\s*k$/i);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  return parseFloat(cleaned);
}

export function normalizeCompensation(text: string | undefined | null): NormalizedCompensation {
  if (!text) return { min: null, max: null, type: "unspecified" };

  const isHourly = /\/\s*(hr|hour)/i.test(text);
  const isSalary = /\/\s*(yr|year)|annual/i.test(text) || (!isHourly && /\bk\b/i.test(text));
  const type: CompensationType = isHourly ? "hourly" : isSalary ? "salary" : "unspecified";

  // Range: "$35-45/hour", "$120,000 - $140,000"
  const rangeMatch = text.match(/\$?\s*([\d,.]+\s*k?)\s*[-–]\s*\$?\s*([\d,.]+\s*k?)/i);
  if (rangeMatch) {
    const min = parseNumber(rangeMatch[1]);
    const max = parseNumber(rangeMatch[2]);
    if (!Number.isNaN(min) && !Number.isNaN(max)) return { min, max, type };
  }

  // Single value: "$32/hr", "$85k/yr"
  const singleMatch = text.match(/\$?\s*([\d,.]+\s*k?)/i);
  if (singleMatch) {
    const value = parseNumber(singleMatch[1]);
    if (!Number.isNaN(value)) return { min: value, max: value, type };
  }

  return { min: null, max: null, type: "unspecified" };
}
