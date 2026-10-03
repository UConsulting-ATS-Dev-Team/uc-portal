import { COMPANIES } from "./mockCompanies.js";

function matches(text, q) {
  return text && text.toLowerCase().includes(q);
}

// Substring search over the 8 hand-curated companies (data/mockCompanies.js)
// only -- jobs, people, real companies, feed posts and library resources are
// all searched from their real tables by pages/GlobalSearch.jsx itself.
export function searchAll(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { companies: [] };

  return {
    companies: COMPANIES.filter((c) => matches(c.name, q) || matches(c.industry, q)),
  };
}
