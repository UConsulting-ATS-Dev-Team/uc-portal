import { describe, expect, it } from "vitest";
import { matchJob } from "../src/match.js";
import { normalizeJob } from "../src/normalize.js";
import type { MemberProfile, RawJob } from "../src/types.js";

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
    ...overrides,
  };
}

function profile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    graduationYear: 2027,
    opportunityType: "Internship",
    industries: ["Management consulting"],
    roles: ["Consultant"],
    locations: ["Chicago"],
    openToRelocating: false,
    remoteOrHybridOnly: false,
    followedCompanies: [],
    compTarget: 35,
    skills: ["Critical Thinking"],
    ...overrides,
  };
}

describe("matchJob — hard constraints (US-33)", () => {
  it("is ineligible when the member's graduation year isn't in the job's eligible years", () => {
    const job = normalizeJob(rawJob({ qualificationsText: "Graduating 2029 only." }));
    const result = matchJob(job, profile({ graduationYear: 2027 }));
    expect(result.eligible).toBe(false);
    expect(result.score).toBe(0);
  });

  it("is eligible when the job lists no graduation-year requirement at all", () => {
    const job = normalizeJob(rawJob({ qualificationsText: "Open to all class years." }));
    const result = matchJob(job, profile());
    expect(result.eligible).toBe(true);
  });

  it("is ineligible when the employment type doesn't match a specific preference", () => {
    const job = normalizeJob(rawJob({ employmentTypeText: "Full-time" }));
    const result = matchJob(job, profile({ opportunityType: "Internship" }));
    expect(result.eligible).toBe(false);
  });

  it("is eligible for any employment type when the member is open to Both", () => {
    const job = normalizeJob(rawJob({ employmentTypeText: "Full-time" }));
    const result = matchJob(job, profile({ opportunityType: "Both" }));
    expect(result.eligible).toBe(true);
  });
});

describe("matchJob — soft preferences and explainability (US-34)", () => {
  it("returns a factor for every dimension considered, matched or not", () => {
    const job = normalizeJob(rawJob());
    const result = matchJob(job, profile());
    const keys = result.factors.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["graduationYear", "industry", "role", "location", "compensation", "skills"]));
  });

  it("scores a job matching every soft preference higher than one matching none", () => {
    const strongMatch = normalizeJob(
      rawJob({ locationText: "Chicago, IL", compensationText: "$45/hour", qualificationsText: "Graduating 2027." })
    );
    const weakMatch = normalizeJob(
      rawJob({
        company: "Some Other Firm",
        title: "Unrelated Role",
        locationText: "Miami, FL",
        compensationText: "$20/hour",
        qualificationsText: "Graduating 2027.", // still eligible, just a worse soft-preference fit
      })
    );
    const strongResult = matchJob(strongMatch, profile());
    const weakResult = matchJob(weakMatch, profile());
    expect(strongResult.score).toBeGreaterThan(weakResult.score);
  });
});
