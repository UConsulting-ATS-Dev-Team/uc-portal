import { supabase } from "./supabaseClient.js";

// Real "new signups" visibility for admins -- see the list_recent_signups()
// migration (20260914190000) for the full rationale. No persistent
// notification/queue exists (or is needed): profiles.created_at is already
// the real source of truth, so both of these are direct real-time reads,
// not something enqueued once and marked read later.

// Full list with real display names, for Admin Dashboard's own panel.
export async function fetchRecentSignups(daysBack = 14, maxRows = 25) {
  const { data, error } = await supabase.rpc("list_recent_signups", { days_back: daysBack, max_rows: maxRows });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Just a count, for TopBar.jsx's admin-only badge -- a plain client count
// query against `profiles` rather than the RPC above, since a badge only
// ever needs a number, not names/emails, and profiles_select_admin's RLS
// (20260821130000) already grants admins direct select access to every
// profiles row, no security-definer function needed just to count them.
export async function countNewSignupsSince(sinceIso) {
  const { count, error } = await supabase.from("profiles").select("id", { count: "exact", head: true }).gt("created_at", sinceIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
