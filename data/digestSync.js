import { supabase } from "./supabaseClient.js";

// Weekly digest content -- see the weekly_digests migration's own header
// comment for the full "groundwork, not a finished email" rationale.
// Admin-only read, for sanity-checking real computed content before any
// of it is ever actually emailed.
export async function fetchWeeklyDigestLog(maxRows = 100) {
  const { data, error } = await supabase.rpc("list_weekly_digest_log", { max_rows: maxRows });
  if (error) throw new Error(error.message);
  return data ?? [];
}
