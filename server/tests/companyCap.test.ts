import { describe, expect, it } from "vitest";
import {
  MAX_ACTIVE_JOBS_PER_COMPANY,
  DEFAULT_COMPANY_TIER,
  TIER_CAPS,
  idsExceedingCompanyCap,
  rankForCompanyCap,
  tierForJobFunction,
  capForCompanyTier,
  indexCompanyTiers,
  type CompanyCapCandidate,
} from "../src/companyCap.js";

describe("tierForJobFunction", () => {
  it("ranks Consulting/Investment Banking/Software Engineering/Product Management as tier 0", () => {
    expect(tierForJobFunction("Consulting")).toBe(0);
    expect(tierForJobFunction("Investment Banking")).toBe(0);
    expect(tierForJobFunction("Software Engineering")).toBe(0);
    expect(tierForJobFunction("Product Management")).toBe(0);
  });

  it("ranks Marketing/Operations/Sales as tier 1", () => {
    expect(tierForJobFunction("Marketing")).toBe(1);
    expect(tierForJobFunction("Operations")).toBe(1);
    expect(tierForJobFunction("Sales")).toBe(1);
  });

  it("ranks null/unrecognized as tier 2 (unclassified)", () => {
    expect(tierForJobFunction(null)).toBe(2);
    expect(tierForJobFunction(undefined)).toBe(2);
    expect(tierForJobFunction("Something Else")).toBe(2);
  });
});

function candidate(overrides: Partial<CompanyCapCandidate> & { id: string }): CompanyCapCandidate {
  return {
    jobFunctionName: null,
    qualityScore: null,
    postedDate: null,
    ...overrides,
  };
}

describe("rankForCompanyCap", () => {
  it("ranks tier 0 above tier 1 above unclassified regardless of quality score", () => {
    const unclassifiedHighQuality = candidate({ id: "unclassified", jobFunctionName: null, qualityScore: 1 });
    const midTierLowQuality = candidate({ id: "mid", jobFunctionName: "Operations", qualityScore: 0.1 });
    const topTierLowQuality = candidate({ id: "top", jobFunctionName: "Consulting", qualityScore: 0.1 });

    const ranked = rankForCompanyCap([unclassifiedHighQuality, midTierLowQuality, topTierLowQuality]);
    expect(ranked.map((c) => c.id)).toEqual(["top", "mid", "unclassified"]);
  });

  it("breaks ties within a tier by quality_score descending", () => {
    const low = candidate({ id: "low", jobFunctionName: "Consulting", qualityScore: 0.3 });
    const high = candidate({ id: "high", jobFunctionName: "Consulting", qualityScore: 0.9 });
    const ranked = rankForCompanyCap([low, high]);
    expect(ranked.map((c) => c.id)).toEqual(["high", "low"]);
  });

  it("breaks ties within a tier and equal quality by posted_date descending (more recent first)", () => {
    const older = candidate({ id: "older", jobFunctionName: "Consulting", qualityScore: 0.5, postedDate: "2026-01-01" });
    const newer = candidate({ id: "newer", jobFunctionName: "Consulting", qualityScore: 0.5, postedDate: "2026-06-01" });
    const ranked = rankForCompanyCap([older, newer]);
    expect(ranked.map((c) => c.id)).toEqual(["newer", "older"]);
  });

  it("treats a null quality_score as 0 (ranked below any real score in the same tier)", () => {
    const nullScore = candidate({ id: "null-score", jobFunctionName: "Marketing", qualityScore: null });
    const zeroPointOne = candidate({ id: "0.1", jobFunctionName: "Marketing", qualityScore: 0.1 });
    const ranked = rankForCompanyCap([nullScore, zeroPointOne]);
    expect(ranked.map((c) => c.id)).toEqual(["0.1", "null-score"]);
  });

  it("is deterministic (stable id tiebreak) when every other field ties", () => {
    const a = candidate({ id: "aaa", jobFunctionName: "Consulting", qualityScore: 0.5, postedDate: "2026-01-01" });
    const b = candidate({ id: "bbb", jobFunctionName: "Consulting", qualityScore: 0.5, postedDate: "2026-01-01" });
    const ranked1 = rankForCompanyCap([b, a]).map((c) => c.id);
    const ranked2 = rankForCompanyCap([a, b]).map((c) => c.id);
    expect(ranked1).toEqual(["aaa", "bbb"]);
    expect(ranked2).toEqual(["aaa", "bbb"]);
  });
});

describe("idsExceedingCompanyCap", () => {
  it("returns an empty array when at or under the cap", () => {
    const candidates = Array.from({ length: MAX_ACTIVE_JOBS_PER_COMPANY }, (_, i) => candidate({ id: `job-${i}`, qualityScore: 0.5 }));
    expect(idsExceedingCompanyCap(candidates)).toEqual([]);
    expect(idsExceedingCompanyCap(candidates.slice(0, 10))).toEqual([]);
  });

  it("returns exactly the excess count when over the cap", () => {
    const candidates = Array.from({ length: MAX_ACTIVE_JOBS_PER_COMPANY + 15 }, (_, i) => candidate({ id: `job-${i}`, qualityScore: Math.random() }));
    const excess = idsExceedingCompanyCap(candidates);
    expect(excess).toHaveLength(15);
  });

  it("keeps every tier-0 job over a lower tier when tier 0 alone exceeds the cap", () => {
    const topTier = Array.from({ length: 35 }, (_, i) => candidate({ id: `top-${i}`, jobFunctionName: "Consulting", qualityScore: 0.5 }));
    const unclassified = Array.from({ length: 5 }, (_, i) => candidate({ id: `unclassified-${i}`, qualityScore: 0.9 }));
    const excess = idsExceedingCompanyCap([...topTier, ...unclassified]);
    // all 5 unclassified plus the 5 lowest-scoring/oldest top-tier jobs (35 - 30 = 5) should be excess
    expect(excess).toHaveLength(10);
    for (const id of unclassified.map((c) => c.id)) expect(excess).toContain(id);
  });

  it("respects a custom cap argument", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => candidate({ id: `job-${i}`, qualityScore: 0.5 }));
    expect(idsExceedingCompanyCap(candidates, 5)).toHaveLength(5);
  });

  it("is idempotent: re-running against the survivors of a prior pass is always a no-op", () => {
    const candidates = Array.from({ length: 50 }, (_, i) => candidate({ id: `job-${i}`, jobFunctionName: i % 3 === 0 ? "Consulting" : i % 3 === 1 ? "Operations" : null, qualityScore: Math.random(), postedDate: `2026-0${(i % 6) + 1}-01` }));
    const excess = new Set(idsExceedingCompanyCap(candidates));
    const survivors = candidates.filter((c) => !excess.has(c.id));
    expect(survivors).toHaveLength(MAX_ACTIVE_JOBS_PER_COMPANY);
    expect(idsExceedingCompanyCap(survivors)).toEqual([]);
  });
});

describe("capForCompanyTier", () => {
  it("resolves each of the 4 tiers to its documented cap", () => {
    expect(capForCompanyTier(0)).toBe(25);
    expect(capForCompanyTier(1)).toBe(15);
    expect(capForCompanyTier(2)).toBe(10);
    // Tier 3's cap was raised from 3 to 10 (2026-09-11 direct instruction)
    // once the admin "Company tiers" view surfaced real, legitimate
    // companies sitting on this default with 200+ real active postings
    // each -- see TIER_CAPS's own comment.
    expect(capForCompanyTier(3)).toBe(10);
  });

  it("defaults null/undefined (a company missing from company_tiers) to tier 3's cap", () => {
    expect(capForCompanyTier(null)).toBe(TIER_CAPS[DEFAULT_COMPANY_TIER]);
    expect(capForCompanyTier(undefined)).toBe(TIER_CAPS[DEFAULT_COMPANY_TIER]);
    expect(DEFAULT_COMPANY_TIER).toBe(3);
  });

  it("defaults an unrecognized tier number to tier 3's cap rather than throwing", () => {
    expect(capForCompanyTier(99)).toBe(TIER_CAPS[DEFAULT_COMPANY_TIER]);
  });

  it("ranks tier caps descending 0 > 1 > 2, with tier 3 now tied with tier 2 (both 10) rather than the strictly-lower cap it used to be", () => {
    expect(capForCompanyTier(0)).toBeGreaterThan(capForCompanyTier(1));
    expect(capForCompanyTier(1)).toBeGreaterThan(capForCompanyTier(2));
    expect(capForCompanyTier(2)).toBe(capForCompanyTier(3));
  });
});

describe("indexCompanyTiers", () => {
  it("indexes each row under its own canonical company name", () => {
    const index = indexCompanyTiers([{ companyName: "Deloitte", tier: 0, aliases: [] }]);
    expect(index.get("Deloitte")).toBe(0);
  });

  it("also indexes each row under every alias, resolving to the same tier", () => {
    const index = indexCompanyTiers([{ companyName: "IMC Trading", tier: 1, aliases: ["IMC", "IMC Financial"] }]);
    expect(index.get("IMC Trading")).toBe(1);
    expect(index.get("IMC")).toBe(1);
    expect(index.get("IMC Financial")).toBe(1);
  });

  it("treats a missing/null aliases array as no aliases, not a crash", () => {
    const index = indexCompanyTiers([{ companyName: "Solo Co", tier: 2, aliases: null }]);
    expect(index.get("Solo Co")).toBe(2);
    expect(index.size).toBe(1);
  });

  it("does not partial-match an alias -- only an exact string resolves", () => {
    const index = indexCompanyTiers([{ companyName: "IMC Trading", tier: 1, aliases: ["IMC"] }]);
    expect(index.get("IMC Trading LLC")).toBeUndefined();
    expect(index.get("imc")).toBeUndefined(); // case-sensitive, deliberately -- see this table's own migration comment
  });

  it("keeps every row's own entries independent across multiple companies", () => {
    const index = indexCompanyTiers([
      { companyName: "Deloitte", tier: 0, aliases: [] },
      { companyName: "IMC Trading", tier: 1, aliases: ["IMC"] },
    ]);
    expect(index.get("Deloitte")).toBe(0);
    expect(index.get("IMC")).toBe(1);
    expect(index.get("Deloitte", )).not.toBe(index.get("IMC"));
  });
});
