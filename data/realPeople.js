import { fetchAllRows } from "./fetchAllRows.js";
import { realPersonToCardShape } from "./realPeopleAdapter.js";

// All real people, adapted to the same shape data/mockPeople.js's PEOPLE
// array uses. 150 rows -- nowhere near PostgREST's 1000-row page default,
// but fetchAllRows() is used anyway rather than a bare .select() for the
// same reason every other real-data read in this app does: cheap
// insurance against the exact truncation bug that caused real damage
// elsewhere this session, and this table will only grow as more alumni
// history gets added to the source sheet.
export async function fetchRealPeople() {
  const rows = await fetchAllRows("people", "*");
  return rows.map(realPersonToCardShape);
}

// The directory's real "company" values are however each person happened
// to type it in ("Bain", "Bain & Co", "Deloitte Human Capital"), not the
// canonical display names data/mockCompanies.js uses ("Bain & Company",
// "Goldman Sachs"). An exact match against the canonical name returns
// nothing for every one of those real companies. Matching on the
// canonical name's first token ("Bain & Company" -> "Bain", "Goldman
// Sachs" -> "Goldman") against a starts-with pattern catches the real
// spellings actually seen in the data without also matching an unrelated
// company whose name merely contains the token mid-string.
export function companyMatchToken(canonicalName) {
  return canonicalName.split(/\s*&\s*|\s+/)[0];
}

export async function fetchRealPeopleAtCompany(companyName) {
  const token = companyMatchToken(companyName);
  const rows = await fetchAllRows("people", "*", (q) => q.ilike("company", `${token}%`));
  return rows.map(realPersonToCardShape);
}

export async function fetchRealPersonById(id) {
  const rows = await fetchAllRows("people", "*", (q) => q.eq("id", id));
  return rows.length > 0 ? realPersonToCardShape(rows[0]) : null;
}

// Global Search's own substring matching (data/searchUtils.js), just
// against real people instead of the mock roster -- at 150 rows, a proper
// indexed search (like jobs' search_vector column, data/jobSearch.js)
// isn't warranted yet. Client-side filtering after one small fetch is
// "good enough at this data scale," same call searchUtils.js's own
// comment already makes for the rest of the mock-data search.
export async function searchRealPeople(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const people = await fetchRealPeople();
  return people.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.company && p.company.toLowerCase().includes(q)) ||
      (p.role && p.role.toLowerCase().includes(q))
  );
}
