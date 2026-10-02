import { daysUntil } from "./jobUtils.js";
import { companyMatchToken } from "./realPeople.js";

// Real numbers for onboarding's "here's what's waiting for you" payoff
// card and completion screen, computed from the same live jobs/people data
// the rest of the app reads. These replaced a made-up formula
// (computeMatches) and hardcoded counts, so every figure can be traced to a
// real posting or a real directory person.

// Real postings this member is eligible for and matches on (score > 0).
export function matchedJobs(realJobs) {
  return realJobs.filter((j) => j.matchEligible && j.matchScore > 0);
}

// Matched postings with a real deadline in the next 30 days.
export function upcomingDeadlineCount(matched) {
  return matched.filter((j) => {
    if (j.rolling || !j.deadlineDate) return false;
    const days = daysUntil(j.deadlineDate);
    return days !== null && days >= 0 && days <= 30;
  }).length;
}

// Real alumni who share something with the member's answers so far: a
// followed company, a chosen industry, or a chosen location. With nothing
// chosen yet it is simply every alumnus in the directory.
export function matchingAlumni(people, { industries = [], locations = [], followedCompanies = [] }) {
  const alumni = people.filter((p) => p.status !== "Current member");
  const hasCriteria = industries.length + locations.length + followedCompanies.length > 0;
  if (!hasCriteria) return alumni;
  const tokens = followedCompanies.map((c) => companyMatchToken(c).toLowerCase());
  return alumni.filter(
    (p) =>
      (p.company && tokens.some((t) => p.company.toLowerCase().startsWith(t))) ||
      (p.industry && industries.includes(p.industry)) ||
      (p.location && locations.some((l) => p.location.toLowerCase().includes(l.toLowerCase())))
  );
}

export function alumniAtCompany(people, companyName) {
  const token = companyMatchToken(companyName).toLowerCase();
  return people.filter((p) => p.status !== "Current member" && p.company?.toLowerCase().startsWith(token)).length;
}

export function openRolesAtCompany(realJobs, companyName) {
  const token = companyMatchToken(companyName).toLowerCase();
  return realJobs.filter((j) => j.company?.toLowerCase().startsWith(token)).length;
}
