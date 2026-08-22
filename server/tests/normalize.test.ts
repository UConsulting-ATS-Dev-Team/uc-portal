import { describe, expect, it } from "vitest";
import { normalizeJob } from "../src/normalize.js";
import type { RawJob } from "../src/types.js";

const baseSource = { sourceId: "test-source", sourceJobId: "job-1", sourceUrl: "https://example.com/jobs/1", isPrimary: true };

function rawJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    source: baseSource,
    company: "Bain & Company",
    title: "Business Analyst Intern",
    employmentTypeText: "Internship",
    locationText: "Chicago, IL",
    compensationText: "$45/hour",
    qualificationsText: "Graduating 2027 or 2028.",
    applicationUrl: "https://example.com/jobs/1",
    ...overrides,
  };
}

describe("normalizeJob", () => {
  it("classifies employment type from free text", () => {
    const job = normalizeJob(rawJob());
    expect(job.employmentType).toBe("internship");
  });

  it("returns null employment type rather than guessing when unclassifiable", () => {
    const job = normalizeJob(rawJob({ employmentTypeText: "???" }));
    expect(job.employmentType).toBeNull();
  });

  it("normalizes a known city string", () => {
    const job = normalizeJob(rawJob({ locationText: "Chicago, IL" }));
    expect(job.city).toBe("Chicago");
    expect(job.state).toBe("IL");
  });

  it("detects remote/hybrid signals", () => {
    const remote = normalizeJob(rawJob({ locationText: "Remote" }));
    expect(remote.remoteType).toBe("remote");

    const hybrid = normalizeJob(rawJob({ locationText: "San Francisco, CA (Hybrid)" }));
    expect(hybrid.remoteType).toBe("hybrid");
    expect(hybrid.city).toBe("San Francisco");
  });

  it("parses an hourly compensation range", () => {
    const job = normalizeJob(rawJob({ compensationText: "$35-45/hour" }));
    expect(job.compensationType).toBe("hourly");
    expect(job.salaryMin).toBe(35);
    expect(job.salaryMax).toBe(45);
  });

  it("parses a salary figure with a k suffix", () => {
    const job = normalizeJob(rawJob({ compensationText: "$85k/yr" }));
    expect(job.compensationType).toBe("salary");
    expect(job.salaryMin).toBe(85000);
  });

  it("extracts explicit graduation years", () => {
    const job = normalizeJob(rawJob({ qualificationsText: "Graduating 2027 or 2028." }));
    expect(job.graduationYears).toEqual([2027, 2028]);
  });

  it("extracts graduation year from class-standing words relative to a reference year", () => {
    const job = normalizeJob(rawJob({ qualificationsText: "Rising junior preferred." }), new Date("2026-08-01"));
    expect(job.graduationYears).toEqual([2028]);
  });

  it("classifies a known title to an O*NET occupation and tags inferred skills accordingly", () => {
    const job = normalizeJob(rawJob({ title: "Summer Business Analyst" }));
    expect(job.jobFunction).toBe("Consulting");
    expect(job.requiredSkills).toContain("Critical Thinking");
    expect(job.classificationMethod).toBe("onet_occupation");
  });

  it("leaves jobFunction/skills unset for a title matching no known occupation", () => {
    const job = normalizeJob(rawJob({ title: "Assistant to the Regional Manager" }));
    expect(job.jobFunction).toBeNull();
    expect(job.requiredSkills).toBeNull();
    expect(job.classificationMethod).toBe("rule");
  });

  it("keeps exactly one source per job at normalization time (merging happens later)", () => {
    const job = normalizeJob(rawJob());
    expect(job.sources).toHaveLength(1);
    expect(job.sources[0]).toEqual(baseSource);
  });
});
