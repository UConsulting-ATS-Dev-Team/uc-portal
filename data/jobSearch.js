import { supabase } from "./supabaseClient.js";

// Real Postgres full-text search (US-35, §3.8) against the jobs table's
// generated search_vector column (title weighted highest, then company,
// then qualifications text -- see supabase/migrations/20260821120000's
// jobs table definition). Deliberately standalone: this doesn't touch
// Jobs.jsx's existing filter UI, which still reads mockJobs.js -- wiring
// the two together is a separate, larger piece of work.
//
// `websearch` query type is used over `plain`/`phrase` because it tolerates
// real user input the way a search engine would (quoted phrases, "-word" to
// exclude, "or" between terms) rather than requiring a strict tsquery
// syntax a member would never type correctly.
export async function searchJobs(query, filters = {}) {
  const { employmentType, city, remoteType, graduationYear, limit = 20 } = filters;

  let q = supabase.from("jobs").select("*").eq("active", true);

  if (query?.trim()) {
    q = q.textSearch("search_vector", query, { type: "websearch", config: "english" });
  }
  if (employmentType) q = q.eq("employment_type", employmentType);
  if (city) q = q.eq("city", city);
  if (remoteType) q = q.eq("remote_type", remoteType);
  if (graduationYear) q = q.contains("graduation_years", [graduationYear]);

  q = q.order("posted_date", { ascending: false }).limit(limit);

  const { data, error } = await q;
  return { data: data ?? [], error };
}
