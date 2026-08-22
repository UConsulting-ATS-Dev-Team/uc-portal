import { randomUUID } from "node:crypto";
import type { NormalizedJob, RawJob } from "./types.js";
import { normalizeEmploymentType } from "./taxonomy/employmentTypes.js";
import { normalizeLocation } from "./taxonomy/locations.js";
import { normalizeCompensation } from "./taxonomy/compensation.js";
import { classifyTitleToOccupation, skillsForOccupation } from "./taxonomy/occupationTaxonomy.js";
import { extractGraduationYears } from "./taxonomy/eligibility.js";

// US-10/11/12/13/24/25/27/28 -- turns one as-fetched RawJob into a
// NormalizedJob, per §3.2's normalization order (exact-match/rule-based
// first, no LLM fallback in Stage 1 -- see JOB_ENGINE_ARCHITECTURE.md Part 5).
export function normalizeJob(raw: RawJob, now: Date = new Date()): NormalizedJob {
  const employmentType = normalizeEmploymentType(raw.employmentTypeText ?? raw.title);
  const location = normalizeLocation(raw.locationText);
  const compensation = normalizeCompensation(raw.compensationText);
  const occupation = classifyTitleToOccupation(raw.title);
  const graduationYears = extractGraduationYears(raw.qualificationsText, now.getFullYear());

  return {
    id: randomUUID(),
    sources: [raw.source],
    company: raw.company.trim(),
    title: raw.title.trim(),
    employmentType,
    applicationUrl: raw.applicationUrl.trim(),

    description: raw.description?.trim() || null,
    department: raw.department?.trim() || null,
    jobFunction: occupation?.jobFunction ?? null,

    city: location.city,
    state: location.state,
    country: location.country,
    remoteType: location.remoteType,

    salaryMin: compensation.min,
    salaryMax: compensation.max,
    salaryCurrency: "USD",
    compensationType: compensation.type,
    compensationText: raw.compensationText?.trim() || null,

    postedDate: raw.postedDate ?? null,
    updatedDate: raw.updatedDate ?? null,
    applicationDeadline: raw.applicationDeadlineText ?? null,

    graduationYears,
    // US-26/US-28: occupation-inferred skills, kept separate from anything
    // the posting itself stated -- there's no source-stated skills field
    // being merged in here, since RawJob doesn't carry one at this stage.
    requiredSkills: occupation ? skillsForOccupation(occupation) : null,
    preferredSkills: null,
    qualificationsText: raw.qualificationsText?.trim() || null,

    relevantIndustries: occupation?.relevantIndustries ?? [],
    relevantRoles: occupation?.relevantRoles ?? [],
    ucRecruitingNotes: null,

    firstSeenAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    lastVerifiedAt: now.toISOString(),
    active: true,
    status: "active",
    confidenceScore: occupation ? 0.8 : 0.5, // lower confidence when title didn't match any known occupation
    qualityScore: null, // set by scoreQuality() as a separate step, not here
    classificationMethod: occupation ? "onet_occupation" : "rule",
  };
}
