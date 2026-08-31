import { describe, expect, it } from "vitest";
import { scoreQuality, validateJob } from "../src/quality.js";
import { normalizeJob } from "../src/normalize.js";
import type { RawJob } from "../src/types.js";

function rawJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    source: { sourceId: "source-a", sourceJobId: "1", sourceUrl: "https://example.com/1", isPrimary: true },
    company: "Bain & Company",
    title: "Business Analyst Intern",
    employmentTypeText: "Internship",
    locationText: "Chicago, IL",
    compensationText: "$45/hour",
    qualificationsText: "Graduating 2027 or 2028.",
    applicationUrl: "https://example.com/jobs/1",
    postedDate: "2026-08-01",
    applicationDeadlineText: "2026-09-15",
    ...overrides,
  };
}

describe("validateJob", () => {
  it("passes a complete, well-formed job", () => {
    const job = normalizeJob(rawJob());
    expect(validateJob(job)).toHaveLength(0);
  });

  it("flags a missing company", () => {
    const job = normalizeJob(rawJob({ company: "" }));
    expect(validateJob(job).some((i) => i.field === "company")).toBe(true);
  });

  it("flags a malformed application URL", () => {
    const job = normalizeJob(rawJob({ applicationUrl: "not a real url" }));
    expect(validateJob(job).some((i) => i.field === "applicationUrl")).toBe(true);
  });

  it("flags an unclassifiable employment type", () => {
    const job = normalizeJob(rawJob({ employmentTypeText: "???" }));
    expect(validateJob(job).some((i) => i.field === "employmentType")).toBe(true);
  });
});

describe("scoreQuality", () => {
  it("floors the score at 0 for a record with a required-field failure", () => {
    const job = normalizeJob(rawJob({ company: "" }));
    expect(scoreQuality(job)).toBe(0);
  });

  it("scores a complete record higher than a sparse one", () => {
    const complete = normalizeJob(rawJob());
    const sparse = normalizeJob(
      rawJob({
        locationText: undefined,
        compensationText: undefined,
        qualificationsText: undefined,
        applicationDeadlineText: undefined,
      })
    );
    expect(scoreQuality(complete)).toBeGreaterThan(scoreQuality(sparse));
  });

  describe("link health (US-52)", () => {
    it("does not change the score when link health is unchecked (default)", () => {
      const job = normalizeJob(rawJob());
      const withoutField = { ...job };
      delete (withoutField as { linkHealth?: unknown }).linkHealth;
      const withUnchecked = { ...job, linkHealth: "unchecked" as const };
      expect(scoreQuality(withoutField)).toBe(scoreQuality(job));
      expect(scoreQuality(withUnchecked)).toBe(scoreQuality(job));
    });

    it("rewards a confirmed-ok link with a small positive bump", () => {
      const base = normalizeJob(rawJob());
      const ok = { ...base, linkHealth: "ok" as const };
      expect(scoreQuality(ok)).toBeGreaterThan(scoreQuality(base));
    });

    it("caps the ok bonus at 1 rather than exceeding it", () => {
      const job = normalizeJob(rawJob());
      const ok = { ...job, confidenceScore: 1, linkHealth: "ok" as const };
      expect(scoreQuality(ok)).toBeLessThanOrEqual(1);
    });

    it("meaningfully depresses the score for a confirmed-broken link", () => {
      const base = normalizeJob(rawJob());
      const broken = { ...base, linkHealth: "broken" as const };
      const baseScore = scoreQuality(base);
      const brokenScore = scoreQuality(broken);
      expect(brokenScore).toBeLessThan(baseScore);
      expect(brokenScore).toBeCloseTo(baseScore * 0.5, 2);
    });

    it("never floors a broken-but-structurally-valid job all the way to 0, unlike a real validation failure", () => {
      const sparse = normalizeJob(
        rawJob({
          locationText: undefined,
          compensationText: undefined,
          qualificationsText: undefined,
          applicationDeadlineText: undefined,
          postedDate: undefined,
        })
      );
      const broken = { ...sparse, linkHealth: "broken" as const };
      expect(scoreQuality(broken)).toBeGreaterThan(0);

      const invalid = normalizeJob(rawJob({ company: "" }));
      expect(scoreQuality({ ...invalid, linkHealth: "broken" as const })).toBe(0);
    });
  });
});
