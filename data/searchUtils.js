import { JOBS } from "./mockJobs.js";
import { PEOPLE } from "./mockPeople.js";
import { COMPANIES } from "./mockCompanies.js";
import { RESOURCES } from "./mockResources.js";
import { FEED_POSTS } from "./mockFeed.js";

function matches(text, q) {
  return text && text.toLowerCase().includes(q);
}

// Simple substring search across each mock dataset's obvious display
// fields. Good enough at this data scale; a real backend would swap this
// for a proper index (see JOB_ENGINE_ARCHITECTURE.md's search section for
// the job-side version of that same tradeoff).
export function searchAll(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { jobs: [], people: [], companies: [], resources: [], posts: [] };

  return {
    jobs: JOBS.filter((j) => matches(j.role, q) || matches(j.company, q) || matches(j.industry, q)),
    people: PEOPLE.filter((p) => matches(p.name, q) || matches(p.company, q) || matches(p.role, q)),
    companies: COMPANIES.filter((c) => matches(c.name, q) || matches(c.industry, q)),
    resources: RESOURCES.filter((r) => matches(r.title, q) || matches(r.category, q)),
    posts: FEED_POSTS.filter((p) => matches(p.body, q) || matches(p.author, q)),
  };
}
