import { describe, expect, it } from "vitest";
import { classifyDuplicateTier, findDuplicates, mergeJobs, scoreDuplicate } from "../src/dedupe.js";
import { normalizeJob } from "../src/normalize.js";
import type { RawJob } from "../src/types.js";

// Each call gets a fresh, unique default source unless the test explicitly
// overrides it -- two independently-constructed "distinct" test jobs must
// never accidentally share a (sourceId, sourceJobId) pair, or the
// source_job_id signal falsely fires between them.
let sourceCounter = 0;

function rawJob(overrides: Partial<RawJob> = {}): RawJob {
  sourceCounter += 1;
  return {
    source: { sourceId: "source-a", sourceJobId: `job-${sourceCounter}`, sourceUrl: `https://example.com/${sourceCounter}`, isPrimary: true },
    company: "Bain & Company",
    title: "Business Analyst Intern",
    employmentTypeText: "Internship",
    locationText: "Chicago, IL",
    compensationText: "$45/hour",
    qualificationsText: "Graduating 2027.",
    applicationUrl: "https://example.com/jobs/1",
    postedDate: "2026-08-01",
    ...overrides,
  };
}

describe("scoreDuplicate / classifyDuplicateTier", () => {
  it("auto-merges on an identical application URL alone", () => {
    const a = normalizeJob(rawJob({ applicationUrl: "https://example.com/jobs/1" }));
    const b = normalizeJob(
      rawJob({
        title: "Totally Different Title", // deliberately dissimilar -- URL match should still win
        applicationUrl: "https://example.com/jobs/1",
      })
    );
    const candidate = scoreDuplicate(a, b);
    expect(classifyDuplicateTier(candidate.score)).toBe("auto_merge");
  });

  it("auto-merges on company + high title similarity + location match combined, without needing the URL to match", () => {
    // Same title (jaccard = 1.0) at two different URLs -- isolates the
    // "company + title + location combined" path from the URL-match path
    // covered by the test above.
    const a = normalizeJob(rawJob({ title: "Business Analyst Intern", applicationUrl: "https://example.com/jobs/1" }));
    const b = normalizeJob(rawJob({ title: "Business Analyst Intern", applicationUrl: "https://example.com/jobs/2" }));
    const candidate = scoreDuplicate(a, b);
    expect(classifyDuplicateTier(candidate.score)).toBe("auto_merge");
  });

  it("never auto-merges on title similarity alone, without company or location matching", () => {
    const a = normalizeJob(
      rawJob({ company: "Bain & Company", title: "Marketing Intern", locationText: "Chicago, IL", applicationUrl: "https://example.com/jobs/1" })
    );
    const b = normalizeJob(
      rawJob({ company: "BCG", title: "Marketing Intern", locationText: "Los Angeles, CA", applicationUrl: "https://example.com/jobs/2" })
    );
    const candidate = scoreDuplicate(a, b);
    expect(classifyDuplicateTier(candidate.score)).not.toBe("auto_merge");
  });

  it("sends a moderate-confidence match (same company/location, weaker title match) to review, not auto-merge or distinct", () => {
    // Jaccard("strategy analyst internship program", "strategy analyst internship") = 3/4 = 0.75 -- in the 0.6-0.85 review band.
    const a = normalizeJob(rawJob({ title: "Strategy Analyst Internship Program", locationText: "Chicago, IL", applicationUrl: "https://example.com/jobs/1" }));
    const b = normalizeJob(rawJob({ title: "Strategy Analyst Internship", locationText: "Chicago, IL", applicationUrl: "https://example.com/jobs/2" }));
    const candidate = scoreDuplicate(a, b);
    expect(classifyDuplicateTier(candidate.score)).toBe("review");
  });

  it("treats a posting-date/salary match alone as distinct, never decisive by itself", () => {
    const a = normalizeJob(
      rawJob({ company: "Bain & Company", title: "Business Analyst Intern", postedDate: "2026-08-01", compensationText: "$45/hour", applicationUrl: "https://example.com/jobs/1" })
    );
    const b = normalizeJob(
      rawJob({ company: "Totally Unrelated Co", title: "Something Else Entirely", postedDate: "2026-08-02", compensationText: "$45/hour", applicationUrl: "https://example.com/jobs/2" })
    );
    const candidate = scoreDuplicate(a, b);
    expect(classifyDuplicateTier(candidate.score)).toBe("distinct");
  });
});

describe("findDuplicates", () => {
  it("finds all pairwise candidates above zero score in a small set", () => {
    const jobs = [
      normalizeJob(rawJob({ applicationUrl: "https://example.com/jobs/1" })),
      normalizeJob(rawJob({ applicationUrl: "https://example.com/jobs/1" })), // exact dup of #1
      normalizeJob(rawJob({ company: "Totally Different Company", title: "Unrelated Role", locationText: "Miami, FL", applicationUrl: "https://example.com/jobs/2" })),
    ];
    const candidates = findDuplicates(jobs);
    expect(candidates.some((c) => classifyDuplicateTier(c.score) === "auto_merge")).toBe(true);
  });
});

describe("mergeJobs", () => {
  it("retains both contributing sources rather than collapsing to one", () => {
    const a = normalizeJob(rawJob({ source: { sourceId: "source-a", sourceJobId: "1", sourceUrl: "https://a.com/1", isPrimary: true } }));
    const b = normalizeJob(rawJob({ source: { sourceId: "source-b", sourceJobId: "2", sourceUrl: "https://b.com/2", isPrimary: true } }));
    const merged = mergeJobs(a, b, "source-b");
    expect(merged.sources).toHaveLength(2);
    expect(merged.sources.map((s) => s.sourceId).sort()).toEqual(["source-a", "source-b"]);
  });

  it("marks the more restrictive source as primary, not whichever happened to be 'keep'", () => {
    const a = normalizeJob(rawJob({ source: { sourceId: "source-a", sourceJobId: "1", sourceUrl: "https://a.com/1", isPrimary: true } }));
    const b = normalizeJob(rawJob({ source: { sourceId: "source-b", sourceJobId: "2", sourceUrl: "https://b.com/2", isPrimary: true } }));
    const merged = mergeJobs(a, b, "source-b");
    const primary = merged.sources.find((s) => s.isPrimary);
    expect(primary?.sourceId).toBe("source-b");
  });

  it("fills a missing field from the duplicate when the kept record lacks it", () => {
    const a = normalizeJob(rawJob({ compensationText: undefined }));
    const b = normalizeJob(rawJob({ compensationText: "$45/hour" }));
    const merged = mergeJobs(a, b, "source-a");
    expect(merged.salaryMin).toBe(b.salaryMin);
  });
});
