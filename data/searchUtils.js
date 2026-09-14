import { JOBS } from "./mockJobs.js";
import { PEOPLE } from "./mockPeople.js";
import { COMPANIES } from "./mockCompanies.js";
import { RESOURCES } from "./mockResources.js";

function matches(text, q) {
  return text && text.toLowerCase().includes(q);
}

// Simple substring search across each mock dataset's obvious display
// fields. Good enough at this data scale; a real backend would swap this
// for a proper index (see JOB_ENGINE_ARCHITECTURE.md's search section for
// the job-side version of that same tradeoff). jobs/people/companies
// results here are dead weight in practice -- pages/GlobalSearch.jsx
// fully replaces them with real ones (data/jobSearch.js, data/
// realPeople.js, data/realCompanies.js) -- kept computed rather than
// removed since nothing here is expensive at this data scale and no
// caller has been audited to confirm it never reads the mock fallback.
// Feed posts no longer come from here at all (data/feedSync.js's
// searchFeedPosts replaces it, same as the other three) -- resources is
// the one category still genuinely sourced from here.
export function searchAll(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { jobs: [], people: [], companies: [], resources: [] };

  return {
    jobs: JOBS.filter((j) => matches(j.role, q) || matches(j.company, q) || matches(j.industry, q)),
    people: PEOPLE.filter((p) => matches(p.name, q) || matches(p.company, q) || matches(p.role, q)),
    companies: COMPANIES.filter((c) => matches(c.name, q) || matches(c.industry, q)),
    resources: RESOURCES.filter((r) => matches(r.title, q) || matches(r.category, q)),
  };
}
