import { describe, expect, it } from "vitest";
import { matchJob } from "../src/match.js";
import { normalizeJob } from "../src/normalize.js";
import type { MemberProfile, NormalizedJob, RawJob } from "../src/types.js";

// Bypasses normalizeJob()'s real taxonomy pipeline for the graduated-
// scoring tests below, which need exact control over relevantIndustries/
// relevantRoles/salaryMin rather than whatever a real title happens to
// classify to.
function normalizedJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    id: "job-1",
    sources: [{ sourceId: "source-a", sourceJobId: "1", sourceUrl: "https://example.com/1", isPrimary: true }],
    company: "Example Co",
    title: "Example Role",
    employmentType: "internship",
    applicationUrl: "https://example.com/jobs/1",
    description: null,
    department: null,
    jobFunction: null,
    city: null,
    state: null,
    country: null,
    remoteType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "USD",
    compensationType: "hourly",
    compensationText: null,
    postedDate: null,
    updatedDate: null,
    applicationDeadline: null,
    graduationYears: null,
    requiredSkills: null,
    preferredSkills: null,
    qualificationsText: null,
    relevantIndustries: [],
    relevantRoles: [],
    ucRecruitingNotes: null,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    lastVerifiedAt: null,
    active: true,
    status: "active",
    confidenceScore: null,
    qualityScore: null,
    classificationMethod: "rule",
    ...overrides,
  };
}

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

  it("matches a job tagged \"Management consulting\" against a \"Strategy consulting\" preference (industry synonym)", () => {
    // Real ingested jobs only ever get tagged "Management consulting" by
    // the taxonomy (server/src/taxonomy/occupationTaxonomy.ts) -- a
    // member who prefers "Strategy consulting" (added Sept 2026 as a
    // synonym, see match.ts's own comment) still needs to see them.
    const job = normalizeJob(rawJob());
    expect(job.relevantIndustries).toContain("Management consulting");
    const result = matchJob(job, profile({ industries: ["Strategy consulting"] }));
    const industryFactor = result.factors.find((f) => f.key === "industry")!;
    expect(industryFactor.match).toBe(true);
  });

  it("counts a preferred (not just required) skill toward the skills factor (Part 7 Stage 5)", () => {
    // "Business Analyst" classifies to the consulting occupation, whose
    // preferredSkills includes "Administration and Management" (a Knowledge
    // domain) but not any of its requiredSkills.
    const job = normalizeJob(rawJob());
    expect(job.preferredSkills).toContain("Administration and Management");
    expect(job.requiredSkills ?? []).not.toContain("Administration and Management");

    const withoutPreferredMatch = matchJob(job, profile({ skills: ["Critical Thinking"] }));
    const withPreferredMatch = matchJob(job, profile({ skills: ["Critical Thinking", "Administration and Management"] }));

    const skillsFactor = (result: typeof withPreferredMatch) => result.factors.find((f) => f.key === "skills")!;
    expect(skillsFactor(withPreferredMatch).detail).toContain("Administration and Management");
    expect(withPreferredMatch.score).toBeGreaterThan(withoutPreferredMatch.score);
  });
});

// 2026-09-23 redesign: direct report that every real job showed the same
// 75% match. Root cause was binary pass/fail factors flattening once a
// member's onboarding answers are broad enough to satisfy them on most of
// an already-curated board -- see matchJob()'s own header comment. These
// tests exercise the graduated/applicability-gated replacement directly
// against literal NormalizedJob fixtures (normalizedJob() above) rather
// than fighting real taxonomy classification, since what's under test is
// this function's own math, not normalizeJob()'s occupation matching.
describe("matchJob — graduated scoring differentiates sparse/broad profiles", () => {
  it("scores a job matching a member's #1 ranked industry higher than one matching only their #3", () => {
    const rankedProfile = profile({ industries: ["Management consulting", "Investment banking", "Technology"], roles: [], locations: [], skills: [] });
    const topPick = normalizedJob({ relevantIndustries: ["Management consulting"] });
    const thirdPick = normalizedJob({ relevantIndustries: ["Technology"] });
    expect(matchJob(topPick, rankedProfile).score).toBeGreaterThan(matchJob(thirdPick, rankedProfile).score);
  });

  it("scores a job matching more of a member's selected role chips higher than one matching fewer", () => {
    const roleProfile = profile({ industries: [], locations: [], skills: [], roles: ["Consultant", "Analyst", "Strategist"] });
    const matchesAll = normalizedJob({ relevantRoles: ["Consultant", "Analyst", "Strategist"] });
    const matchesOne = normalizedJob({ relevantRoles: ["Consultant"] });
    expect(matchJob(matchesAll, roleProfile).score).toBeGreaterThan(matchJob(matchesOne, roleProfile).score);
  });

  it("does not penalize a job that simply doesn't list a salary, vs. one that lists a salary below target", () => {
    const compProfile = profile({ industries: [], roles: [], locations: [], skills: [], compTarget: 40 });
    const noSalaryListed = normalizedJob({ salaryMin: null });
    const belowTarget = normalizedJob({ salaryMin: 20 });
    // Unlisted salary is excluded from scoring entirely (nothing to check);
    // a job that actively lists pay below the target should score lower,
    // not the same -- the old formula's compTarget-is-null bypass didn't
    // apply here (compTarget always has a real value), but this still
    // confirms "no data" and "confirmed miss" aren't conflated.
    expect(matchJob(noSalaryListed, compProfile).score).toBeGreaterThan(matchJob(belowTarget, compProfile).score);
  });

  it("differentiates between two jobs for a member with an entirely empty preferences profile", () => {
    // This is the exact bug: an empty profile used to make every job
    // resolve to the same flat score regardless of real per-job
    // differences. Now, factors with no member-side data (industry, role,
    // location, skills -- all empty here) are excluded from scoring
    // entirely, and compensation (always applicable when the job lists a
    // number, since compTarget has a real default) still differentiates.
    const emptyProfile = profile({ industries: [], roles: [], locations: [], skills: [], openToRelocating: false, remoteOrHybridOnly: false, compTarget: 30 });
    const paysWell = normalizedJob({ salaryMin: 50 });
    const paysPoorly = normalizedJob({ salaryMin: 15 });
    const strong = matchJob(paysWell, emptyProfile);
    const weak = matchJob(paysPoorly, emptyProfile);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("falls back to a neutral 50, not a false 0 or 100, when nothing is applicable on either side", () => {
    const emptyProfile = profile({ industries: [], roles: [], locations: [], skills: [], openToRelocating: false, remoteOrHybridOnly: false });
    const blankJob = normalizedJob({ relevantIndustries: [], relevantRoles: [], salaryMin: null, requiredSkills: [], preferredSkills: [] });
    expect(matchJob(blankJob, emptyProfile).score).toBe(50);
  });
});

// 2026-09-23 follow-up: the graduated redesign above was correct but
// couldn't fully solve the reported flatness alone, since ~76% of real
// active jobs have empty relevantIndustries/relevantRoles (the ingestion
// taxonomy is a small stub covering only a handful of occupations -- see
// matchJob()'s own comment). These test the title-text fallback signal
// directly against *unclassified* jobs (empty relevantIndustries/Roles),
// which the structured-tag-only formula could never differentiate.
describe("matchJob — title-text signal differentiates unclassified jobs", () => {
  it("credits an industry match from the job's own title when relevantIndustries is empty", () => {
    const consultingProfile = profile({ industries: ["Management consulting"], roles: [], locations: [], skills: [] });
    const unclassifiedConsultingTitle = normalizedJob({ relevantIndustries: [], title: "Strategy Consulting Summer Analyst" });
    const unclassifiedUnrelatedTitle = normalizedJob({ relevantIndustries: [], title: "Capital Processing Specialist II" });
    expect(matchJob(unclassifiedConsultingTitle, consultingProfile).score).toBeGreaterThan(
      matchJob(unclassifiedUnrelatedTitle, consultingProfile).score
    );
  });

  it("credits a role match from the job's own title when relevantRoles is empty", () => {
    const roleProfile = profile({ industries: [], locations: [], skills: [], roles: ["Product Manager"] });
    const unclassifiedMatchingTitle = normalizedJob({ relevantRoles: [], title: "Senior Product Manager, Payments" });
    const unclassifiedUnrelatedTitle = normalizedJob({ relevantRoles: [], title: "Performance Engineer" });
    expect(matchJob(unclassifiedMatchingTitle, roleProfile).score).toBeGreaterThan(matchJob(unclassifiedUnrelatedTitle, roleProfile).score);
  });

  it("doesn't let the title signal override a real, differently-classified structured tag -- both signals contribute, neither replaces the other", () => {
    // A job genuinely classified "Investment banking" but whose title also
    // happens to mention "strategy" shouldn't lose credit for the real tag
    // just because the title text is ambiguous -- structured OR title, not
    // structured overridden by title.
    const ibProfile = profile({ industries: ["Investment banking"], roles: [], locations: [], skills: [] });
    const job = normalizedJob({ relevantIndustries: ["Investment banking"], title: "Corporate Strategy & Investment Banking Analyst" });
    const industryFactor = matchJob(job, ibProfile).factors.find((f) => f.key === "industry")!;
    expect(industryFactor.match).toBe(true);
  });
});
