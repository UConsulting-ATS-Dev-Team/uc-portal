import { describe, expect, it } from "vitest";
import { rankJobs } from "../src/rank.js";
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
    postedDate: "2026-08-01",
    applicationDeadlineText: "2026-09-15",
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

const now = new Date("2026-08-21");

describe("rankJobs", () => {
  it("excludes hard-ineligible jobs from the results entirely", () => {
    const eligible = normalizeJob(rawJob({ applicationUrl: "https://example.com/jobs/1" }), now);
    const ineligible = normalizeJob(
      rawJob({ qualificationsText: "Graduating 2029 only.", applicationUrl: "https://example.com/jobs/2" }),
      now
    );
    const results = rankJobs([eligible, ineligible], profile({ graduationYear: 2027 }), { now });
    expect(results).toHaveLength(1);
    expect(results[0].job.id).toBe(eligible.id);
  });

  it("ranks a closer deadline above an otherwise-identical job with a distant deadline", () => {
    const soon = normalizeJob(
      rawJob({ applicationUrl: "https://example.com/jobs/1", applicationDeadlineText: "2026-08-25" }),
      now
    );
    const later = normalizeJob(
      rawJob({ applicationUrl: "https://example.com/jobs/2", applicationDeadlineText: "2026-11-01" }),
      now
    );
    const results = rankJobs([later, soon], profile(), { now });
    expect(results[0].job.id).toBe(soon.id);
  });

  it("caps results per company within the top window (US-43 anti-domination)", () => {
    // 10 Bain postings alone can't demonstrate a cap -- with nothing else to
    // fill the remaining slots, capping only reorders them, it can't remove
    // them from a 20-slot window smaller than the whole result set. Mix in
    // enough other companies that the cap actually has room to matter.
    const bainJobs = Array.from({ length: 10 }, (_, i) =>
      normalizeJob(rawJob({ applicationUrl: `https://example.com/bain/${i}`, title: `Business Analyst Intern ${i}` }), now)
    );
    const otherCompanies = ["McKinsey & Company", "Deloitte", "Stripe", "Goldman Sachs", "BCG", "EY-Parthenon", "Accenture", "Bridgewater", "Citadel", "Amazon"];
    const otherJobs = otherCompanies.flatMap((company, ci) =>
      Array.from({ length: 3 }, (_, i) =>
        normalizeJob(rawJob({ company, applicationUrl: `https://example.com/${ci}/${i}`, title: `Business Analyst Intern ${ci}-${i}` }), now)
      )
    );

    const results = rankJobs([...bainJobs, ...otherJobs], profile(), { now });
    const topWindow = results.slice(0, 20);
    const bainCount = topWindow.filter((r) => r.job.company === "Bain & Company").length;
    expect(bainCount).toBeLessThanOrEqual(3);
  });

  it("never lets quality alone overturn a genuinely better member match", () => {
    const strongMatchLowQuality = normalizeJob(
      rawJob({ applicationUrl: "https://example.com/jobs/1", locationText: "Chicago, IL", compensationText: "$45/hour" }),
      now
    );
    const weakMatchHighQuality = normalizeJob(
      rawJob({
        applicationUrl: "https://example.com/jobs/2",
        title: "Unrelated Analyst Role",
        company: "Some Other Firm",
        locationText: "Miami, FL",
        compensationText: "$20/hour",
      }),
      now
    );
    strongMatchLowQuality.qualityScore = 0.3;
    weakMatchHighQuality.qualityScore = 1.0;

    const results = rankJobs([weakMatchHighQuality, strongMatchLowQuality], profile(), { now });
    expect(results[0].job.id).toBe(strongMatchLowQuality.id);
  });
});
