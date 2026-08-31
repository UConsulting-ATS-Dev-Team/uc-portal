import { describe, expect, it } from "vitest";
import {
  MAX_ACTIVE_JOBS_PER_COMPANY,
  idsExceedingCompanyCap,
  rankForCompanyCap,
  tierForJobFunction,
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
