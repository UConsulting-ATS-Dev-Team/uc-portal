import type { MatchFactor, MatchResult, MemberProfile, NormalizedJob } from "./types.js";

// US-32/33/34 -- job-member matching. Hard constraints filter out entirely
// (§3.9); soft preferences only affect score. Every factor is returned
// alongside the score so it's always explainable (US-34) -- mirrors the
// existing prototype's Job detail match checklist and Odds Model factor
// table, which already do exactly this for the frontend.
export function matchJob(job: NormalizedJob, profile: MemberProfile): MatchResult {
  const factors: MatchFactor[] = [];

  // --- Hard constraints (US-33) ---
  const gradEligible = !job.graduationYears || job.graduationYears.includes(profile.graduationYear);
  factors.push({
    key: "graduationYear",
    label: `Graduation year ${profile.graduationYear}`,
    match: gradEligible,
    detail: job.graduationYears ? `Eligible years: ${job.graduationYears.join(", ")}` : "No graduation-year requirement listed",
  });

  // An unclassified employment type is neither confirmed-eligible nor
  // confirmed-ineligible -- treat it as ineligible for a specific filter
  // (never guess "yes" on missing data) but always eligible for "Both".
  const typeEligible =
    profile.opportunityType === "Both" ||
    (profile.opportunityType === "Internship" && job.employmentType === "internship") ||
    (profile.opportunityType === "Full-time" && job.employmentType === "full_time");

  const eligible = gradEligible && typeEligible;
  if (!eligible) {
    return { eligible: false, score: 0, factors };
  }

  // --- Soft preferences (§3.9) -- weights sum to 100 ---
  let weightedSum = 0;

  const industryMatch = job.relevantIndustries.some((i) => profile.industries.includes(i));
  factors.push({
    key: "industry",
    label: "Target industry",
    match: industryMatch,
    detail: job.relevantIndustries.join(", ") || "Not classified",
  });
  weightedSum += industryMatch ? 30 : 0;

  const roleMatch = job.relevantRoles.some((r) => profile.roles.some((pr) => r.toLowerCase().includes(pr.toLowerCase())));
  factors.push({ key: "role", label: "Target role", match: roleMatch, detail: job.title });
  weightedSum += roleMatch ? 25 : 0;

  const locationMatch =
    (!!job.city && profile.locations.includes(job.city)) ||
    (profile.remoteOrHybridOnly && (job.remoteType === "remote" || job.remoteType === "hybrid")) ||
    profile.openToRelocating;
  factors.push({
    key: "location",
    label: "Target location",
    match: locationMatch,
    detail: job.city ?? job.remoteType ?? "Unknown",
  });
  weightedSum += locationMatch ? 20 : 0;

  const compMatch = profile.compTarget == null || (job.salaryMin != null && job.salaryMin >= profile.compTarget);
  factors.push({
    key: "compensation",
    label: "Compensation target",
    match: compMatch,
    detail: job.compensationText ?? "Not listed",
  });
  weightedSum += compMatch ? 10 : 0;

  const relevantSkills = [...(job.requiredSkills ?? []), ...(job.preferredSkills ?? [])];
  const matchedSkills = relevantSkills.filter((skill) => profile.skills.some((s) => s.toLowerCase() === skill.toLowerCase()));
  factors.push({
    key: "skills",
    label: `${matchedSkills.length} relevant skill${matchedSkills.length === 1 ? "" : "s"}`,
    match: matchedSkills.length > 0,
    detail: matchedSkills.join(", ") || "None matched",
  });
  weightedSum += relevantSkills.length > 0 ? (matchedSkills.length / relevantSkills.length) * 15 : 0;

  return { eligible: true, score: Math.round(weightedSum), factors };
}
