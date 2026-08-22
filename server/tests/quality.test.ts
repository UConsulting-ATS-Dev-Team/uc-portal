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
});
