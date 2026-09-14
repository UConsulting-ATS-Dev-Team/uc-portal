import { supabase } from "./supabaseClient.js";
import { fetchRealPersonByEmail } from "./realPeople.js";

// Real "auto-fill profile from the existing roster/Directory" -- the quick
// win the 2026-09-14 MVP-feedback triage flagged as "pre-provisioned
// logins," scoped down to this (see CLAUDE.md's Progress entry for the
// full reasoning) after a live diagnostic query found class_year/
// uc_committee have no real source anywhere in `people` (0/207 rows have
// class_year filled -- only admit_class, a different, non-numeric field,
// does). name/major/linkedin do have real coverage (100%/44%/94% of 207
// rows respectively), so those are what this can actually fill.
//
// data/store.jsx is the only caller -- it applies the result as a
// "fill only if still empty" patch to profileOverrides, never overwriting
// a value the member (or an earlier run of this) already set.
export async function fetchDirectoryPrefill() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.email) return null;
  return fetchRealPersonByEmail(session.user.email);
}
