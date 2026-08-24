import { supabase } from "./supabaseClient.js";

// Frontend counterpart to supabase/functions/_shared/dedupeHelpers.ts's
// fetchAllRows() -- same bug, same fix, different runtime. PostgREST caps a
// plain .select() at its default 1000-row page regardless of which client
// calls it (anon key from the browser or service role from an Edge
// Function), and pages/Jobs.jsx's original unbounded
// .select("*").eq("active", true) was silently truncating the live Jobs
// board once the Greenhouse expansion (Stage 4) pushed total active jobs
// past 1000 -- members were seeing an arbitrary ~1000-row slice with no
// error, no indication anything was missing. Every read against `jobs`
// that isn't already scoped small (e.g. a single company, a single id)
// should go through this instead of a bare .select().
const PAGE_SIZE = 1000;

export async function fetchAllRows(table, columns, applyFilters) {
  const rows = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (applyFilters) query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw new Error(`Fetching ${table} failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}
