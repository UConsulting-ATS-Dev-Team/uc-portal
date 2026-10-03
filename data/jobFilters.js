// The Jobs board's filter predicate, shared with the notifications that count new roles matching a saved
// search. `job` is the adapted card shape (data/realJobAdapter.js) plus `yc` (data/useYcCompanies.js).
import { canonicalIndustry } from "./careerOptions.js";
import { locationPrefMatches } from "./locationUtils.js";
import { matchesDeadlineBucket } from "./jobUtils.js";

// A blank slate: no filter set, so everything passes.
export const NEUTRAL_FILTERS = {
  keyword: "",
  types: [],
  gradYears: [],
  industries: [],
  locations: [],
  compMin: 15,
  compMax: 75,
  deadlines: [],
  yc: false, // only companies Y Combinator backed
};

export function matchesFilters(job, filters) {
  if (filters.keyword) {
    const q = filters.keyword.toLowerCase();
    if (!job.role.toLowerCase().includes(q) && !job.company.toLowerCase().includes(q)) return false;
  }
  if (filters.types.length && !filters.types.includes(job.type)) return false;
  // A job with no graduation-year requirement listed passes every grad-year
  // filter rather than being excluded -- "unknown" isn't "ineligible."
  if (filters.gradYears.length && job.classYears.length && !job.classYears.some((y) => filters.gradYears.includes(String(y))))
    return false;
  // A job with no recognisable industry passes, same "unknown isn't excluded" rule as grad year. `industries`
  // is the structured tag plus what the title reads as (data/industryPatterns.js), the same signal the
  // profile's match score uses.
  if (
    filters.industries.length &&
    job.industries?.length &&
    !job.industries.some((i) => filters.industries.some((f) => canonicalIndustry(f) === canonicalIndustry(i)))
  )
    return false;
  // Places the posting lists (a metro or country chip matches its cities), or the work mode chip.
  if (
    filters.locations.length &&
    !filters.locations.some((l) => locationPrefMatches(l, { remote_type: job.remoteType }, job.places ?? [])) &&
    !filters.locations.includes(job.workMode)
  )
    return false;
  if (job.compHourly && job.compMin != null && (job.compMax < filters.compMin || job.compMin > filters.compMax)) return false;
  if (filters.deadlines.length && !filters.deadlines.some((d) => matchesDeadlineBucket(job, d))) return false;
  if (filters.yc && !job.yc) return false;
  return true;
}
