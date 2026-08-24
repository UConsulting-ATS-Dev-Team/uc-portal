import { fetchAllRows } from "./fetchAllRows.js";

// Determines which of the app's known company profiles (data/mockCompanies.js)
// have real automated sourcing in the live `jobs` table, keyed by company name.
// This is the actual test pages/CompanyPage.jsx and pages/Companies.jsx use to
// decide between showing real postings and the "no live feed" panel -- not a
// hardcoded "which companies we've integrated" list, which would silently go
// stale the next time a source is added (or a feed goes quiet). See
// CompanyPage.jsx's header comment for why this distinction matters: the
// pre-existing mock jobsAt() data rendered identically to a real scraped
// listing for companies UC has no actual feed for (Bain, McKinsey, Goldman
// Sachs, BCG, EY-Parthenon, Accenture all had fabricated postings in
// data/mockJobs.js despite never having been fetched from anywhere real).
//
// A company with zero rows here reads as "no live feed" even in the edge
// case where it actually has an approved source that's simply returned zero
// active postings recently -- deliberately conflated rather than trying to
// also check the `sources` table's authorization_status, because "we don't
// know of any current openings" and "we've never verified this company's
// data" lead to the identical honest UI (a real careers-page link-out, no
// invented specifics), and erring toward the more conservative label is the
// safer of the two possible mistakes.
export async function fetchLiveJobsByCompany(companyNames) {
  const rows = await fetchAllRows("jobs", "*", (q) => q.eq("active", true).in("company", companyNames));
  const byCompany = new Map(companyNames.map((name) => [name, []]));
  for (const row of rows) {
    if (!byCompany.has(row.company)) byCompany.set(row.company, []);
    byCompany.get(row.company).push(row);
  }
  return byCompany;
}
