import { supabase } from "./supabaseClient.js";
import { companyMatchToken } from "./realPeople.js";

// Real interview write-ups (see the interview_writeups migration for the
// full rationale) -- the real-data counterpart to data/jobUtils.js's mock
// WRITEUP_POOL, but per-company/per-job rather than an author-shuffled
// pool since every row here is a genuine submission, not filler content.
//
// Matches on job_id first (an exact tie to one specific real posting), then
// falls back to a company-token match (same ilike-prefix approach
// data/realPeople.js's fetchRealPeopleAtCompany already uses) so a
// write-up submitted generically from Career Resources -- company typed
// freehand, no job context -- still surfaces on that company's real job
// pages. Already scoped small (one job's company), so this reads directly
// rather than going through fetchAllRows.js's pagination helper.
export async function fetchRealWriteupsForJob(job) {
  const token = companyMatchToken(job.company);
  const { data, error } = await supabase
    .from("interview_writeups")
    .select("*")
    .or(`job_id.eq.${job.id},company.ilike.${token}%`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Fetching interview_writeups failed: ${error.message}`);
  const rows = data ?? [];
  // Exact job_id matches first (most specific to what the member is
  // actually looking at), newest-first within each group.
  return rows.sort((a, b) => {
    const aExact = a.job_id === job.id ? 1 : 0;
    const bExact = b.job_id === job.id ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

// Company-page counterpart to fetchRealWriteupsForJob above -- no specific
// job to tie an exact match to, so this is the company-token match alone
// (same as that function's own fallback branch). Real companies' Company
// Page (data/realCompanies.js) uses these in place of
// data/companyUtils.js's fabricated quotesFor() -- genuine submitted
// write-ups instead of quotes attributed to invented people.
export async function fetchRealWriteupsForCompany(companyName) {
  const token = companyMatchToken(companyName);
  const { data, error } = await supabase
    .from("interview_writeups")
    .select("*")
    .ilike("company", `${token}%`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Fetching interview_writeups failed: ${error.message}`);
  return data ?? [];
}

// Shared by ContributeModal.jsx for both entry points: from a specific real
// job's detail page (job_id set) and from Career Resources' generic
// "+ Contribute" (job_id null, company typed freehand). submitted_by is
// always the real signed-in auth id (needed for the insert_own RLS check
// even when posting anonymously) -- only the display name is withheld.
export async function submitInterviewWriteup({ jobId, company, title, round, outcome, body, isAnonymous, submitterName }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("interview_writeups").insert({
    job_id: jobId ?? null,
    company: company.trim(),
    title: title.trim(),
    round: round.trim() || null,
    outcome,
    body: body.trim(),
    is_anonymous: isAnonymous,
    submitted_by: user.id,
    submitted_by_name: isAnonymous ? null : submitterName,
  });
  if (error) throw new Error(error.message);
}

// Real own-row delete -- interview_writeups_delete_own (RLS) already
// scoped this to submitted_by = auth.uid() since the RLS gap fixes pass;
// this just closes the missing UI, not a new backend capability.
export async function deleteInterviewWriteup(id) {
  const { error } = await supabase.from("interview_writeups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
