import { describe, expect, it } from "vitest";
import { generateSyntheticJobs } from "../synthetic/generateSyntheticJobs.js";
import { normalizeJob } from "../src/normalize.js";
import { validateJob, scoreQuality } from "../src/quality.js";
import { classifyDuplicateTier, findDuplicates, mergeJobs } from "../src/dedupe.js";
import { rankJobs } from "../src/rank.js";
import type { MemberProfile, NormalizedJob } from "../src/types.js";

// Repeatedly merges the highest-confidence auto-merge pair until none
// remain -- the step between dedup detection and ranking that the earlier
// tests deliberately don't need, but ranking does: an un-merged set of
// duplicates would make one posting look like several distinct openings
// from the same company, which is exactly what the anti-domination cap
// (US-43) is meant to guard against for genuinely distinct postings, not
// an artifact of skipping the merge step.
function mergeAllAutoMergeDuplicates(jobs: NormalizedJob[]): NormalizedJob[] {
  let working = jobs;
  for (;;) {
    const candidates = findDuplicates(working);
    const autoMerge = candidates.find((c) => classifyDuplicateTier(c.score) === "auto_merge");
    if (!autoMerge) return working;
    const a = working.find((j) => j.id === autoMerge.jobIdA)!;
    const b = working.find((j) => j.id === autoMerge.jobIdB)!;
    const merged = mergeJobs(a, b, a.sources[0].sourceId);
    working = [...working.filter((j) => j.id !== a.id && j.id !== b.id), merged];
  }
}

// End-to-end proof, per Stage 1 (JOB_ENGINE_ARCHITECTURE.md Part 7): run the
// full normalize -> validate/quality -> dedupe -> rank pipeline against a
// synthetic dataset seeded with known duplicates and malformed records, and
// confirm the pipeline actually catches what it's supposed to. No real
// source or database involved.

const now = new Date("2026-08-21");

const testProfile: MemberProfile = {
  graduationYear: 2027,
  opportunityType: "Internship",
  industries: ["Management consulting", "Investment banking"],
  roles: ["Consultant"],
  locations: ["Chicago", "New York"],
  openToRelocating: false,
  remoteOrHybridOnly: false,
  followedCompanies: [],
  compTarget: 30,
  skills: ["Critical Thinking"],
};

describe("Stage 1 pipeline (synthetic dataset)", () => {
  const rawJobs = generateSyntheticJobs({ count: 250, seed: 42 });

  it("generates the requested dataset size deterministically for a given seed", () => {
    expect(rawJobs).toHaveLength(250);
    const rerun = generateSyntheticJobs({ count: 250, seed: 42 });
    expect(rerun).toEqual(rawJobs);
  });

  it("normalizes every raw job without throwing, even the deliberately malformed ones", () => {
    const normalized = rawJobs.map((raw) => normalizeJob(raw, now));
    expect(normalized).toHaveLength(rawJobs.length);
  });

  it("flags a meaningful fraction of records as invalid (US-14), matching the injected malformed rate", () => {
    const normalized = rawJobs.map((raw) => normalizeJob(raw, now));
    const invalidCount = normalized.filter((job) => validateJob(job).length > 0).length;
    // ~10% malformed rate requested -- allow a wide tolerance since near-dup/
    // malform injection can overlap in the generator, just confirm it's in
    // the right ballpark and not zero or the whole dataset.
    expect(invalidCount).toBeGreaterThan(0);
    expect(invalidCount).toBeLessThan(normalized.length * 0.3);
  });

  it("scores every invalid record's quality at exactly 0, never partially credited", () => {
    const normalized = rawJobs.map((raw) => normalizeJob(raw, now));
    const invalid = normalized.filter((job) => validateJob(job).length > 0);
    expect(invalid.every((job) => scoreQuality(job) === 0)).toBe(true);
  });

  // Both tests below dedupe only the jobs that already passed validation --
  // matching Part 1's documented pipeline order (Validation -> Normalization
  // -> Deduplication), not an incidental test convenience. A record that
  // failed validation (e.g. an unparseable application URL) has nothing
  // meaningful to compare on and shouldn't be fed into dedup at all.
  it("finds both auto-merge and review-tier duplicates in the seeded dataset", () => {
    const normalized = rawJobs.map((raw) => normalizeJob(raw, now)).filter((job) => validateJob(job).length === 0);
    const candidates = findDuplicates(normalized);
    const tiers = candidates.map((c) => classifyDuplicateTier(c.score));
    expect(tiers).toContain("auto_merge"); // the exact-URL duplicates injected by the generator
    expect(tiers).toContain("review"); // the near-duplicate title variants injected by the generator
  });

  it("never auto-merges two jobs from genuinely different companies just because titles are similar", () => {
    const normalized = rawJobs.map((raw) => normalizeJob(raw, now)).filter((job) => validateJob(job).length === 0);
    const candidates = findDuplicates(normalized);
    const wronglyMerged = candidates.filter((c) => {
      if (classifyDuplicateTier(c.score) !== "auto_merge") return false;
      const a = normalized.find((j) => j.id === c.jobIdA)!;
      const b = normalized.find((j) => j.id === c.jobIdB)!;
      return a.company !== b.company;
    });
    expect(wronglyMerged).toHaveLength(0);
  });

  it("produces a ranked, eligible-only result set for a member profile", () => {
    const normalized = mergeAllAutoMergeDuplicates(
      rawJobs.map((raw) => normalizeJob(raw, now)).filter((job) => validateJob(job).length === 0)
    ).map((job) => ({ ...job, qualityScore: scoreQuality(job) }));

    const ranked = rankJobs(normalized, testProfile, { now });

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.match.eligible)).toBe(true);

    // Sorted descending by final score *within* the top-20 window and
    // within the remainder separately -- not globally across that boundary.
    // The anti-domination cap (US-43) deliberately demotes an over-cap item
    // below a lower-scored item from a different company specifically to
    // enforce diversity, so global monotonicity isn't the real invariant
    // here; each partition staying internally sorted is.
    const topWindow = ranked.slice(0, 20);
    const remainder = ranked.slice(20);
    for (const partition of [topWindow, remainder]) {
      for (let i = 1; i < partition.length; i++) {
        expect(partition[i - 1].finalScore).toBeGreaterThanOrEqual(partition[i].finalScore);
      }
    }
  });

  it("keeps the per-company cap intact even across the full synthetic dataset", () => {
    const normalized = mergeAllAutoMergeDuplicates(
      rawJobs.map((raw) => normalizeJob(raw, now)).filter((job) => validateJob(job).length === 0)
    ).map((job) => ({ ...job, qualityScore: scoreQuality(job) }));

    const ranked = rankJobs(normalized, testProfile, { now });
    const topWindow = ranked.slice(0, 20);
    const perCompanyCounts = new Map<string, number>();
    for (const r of topWindow) {
      perCompanyCounts.set(r.job.company, (perCompanyCounts.get(r.job.company) ?? 0) + 1);
    }
    expect(Math.max(...perCompanyCounts.values())).toBeLessThanOrEqual(3);
  });
});
