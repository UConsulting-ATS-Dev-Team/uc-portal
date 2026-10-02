import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./fetchAllRows.js";

// Real persistence for Contribute-to-the-library's non-write-up types --
// see the library_contributions migration's own header for the full
// rationale.
export async function submitContribution({ type, title, body, company, categories, isAnonymous, submitterName }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  const { error } = await supabase.from("library_contributions").insert({
    type,
    title,
    body,
    company: company || null,
    categories: categories ?? [],
    is_anonymous: isAnonymous,
    submitted_by: session.user.id,
    submitted_by_name: isAnonymous ? null : submitterName,
  });
  if (error) throw error;
}

export async function fetchContributions() {
  return fetchAllRows("library_contributions", "*", (q) => q.order("created_at", { ascending: false }));
}

// Own-row delete already existed via RLS (library_contributions_delete_own);
// an admin-delete policy was added alongside the content-moderation page --
// this one function covers both callers, RLS decides what's actually
// allowed.
export async function deleteContribution(id) {
  const { error } = await supabase.from("library_contributions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
