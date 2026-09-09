import { supabase } from "./supabaseClient.js";

// Frontend counterpart to the tier-cap constants in
// supabase/functions/_shared/pipeline/companyCap.ts (mirrored again in
// server/src/companyCap.ts for tests) -- same numbers, third copy, because
// this is the one Deno/Node/browser split every other piece of shared
// pipeline logic in this codebase already has (relevance.ts, companyCap.ts
// itself) when the same values are needed in runtimes with no shared import
// path. Keep TIER_CAPS/DEFAULT_COMPANY_TIER in sync across all three if the
// caps ever change -- the actual company -> tier mapping is NOT duplicated
// here, though; it lives once, in the real `company_tiers` table, and
// fetchCompanyTiers() below reads it directly so the frontend's own display
// cap (pages/Jobs.jsx's capPerCompany) can never drift from what the
// ingestion-side cap enforces. See
// supabase/migrations/20260909070000_company_tiers.sql for the seeded list
// and the full tiering rationale.
export const DEFAULT_COMPANY_TIER = 3;
export const TIER_CAPS = { 0: 25, 1: 15, 2: 10, 3: 3 };

export function capForCompanyTier(tier) {
  return TIER_CAPS[tier ?? DEFAULT_COMPANY_TIER] ?? TIER_CAPS[DEFAULT_COMPANY_TIER];
}

// company_tiers is a small reference table (86 rows as of this writing, one
// row per real company ever sourced) -- a plain select is fine here, unlike
// the real `jobs` table fetchAllRows.js exists to page around; same
// category as job_functions, not the same category as jobs.
export async function fetchCompanyTiers() {
  const { data, error } = await supabase.from("company_tiers").select("company_name, tier");
  if (error) throw new Error(`Fetching company_tiers failed: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.company_name, row.tier]));
}
