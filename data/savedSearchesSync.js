import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./fetchAllRows.js";

// Saved job searches (data/store.jsx `savedSearches`) kept on the account, same shape as data/savedJobsSync.js. The store keeps
// its own copy for rendering; this reads it once per sign-in and mirrors each save and removal. Searches saved before this existed
// live only in the browser: the store uploads those once after the first fetch (see its savedSearchesHydrated effect).

const rowToSearch = (r) => ({ id: r.id, label: r.label, filters: r.filters ?? {}, savedAt: r.saved_at });

export async function fetchRemoteSavedSearches() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const rows = await fetchAllRows("saved_searches", "id, label, filters, saved_at", (q) => q.eq("member_id", session.user.id));
  return rows.map(rowToSearch);
}

// An upsert keyed on the search's own id, so re-sending one that is already stored is harmless.
export async function syncSavedSearchesToRemote(searches) {
  if (searches.length === 0) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from("saved_searches")
    .upsert(searches.map((s) => ({ id: s.id, member_id: session.user.id, label: s.label, filters: s.filters, saved_at: s.savedAt })), { onConflict: "id" });
}

export async function removeSavedSearchesFromRemote(ids) {
  if (ids.length === 0) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("saved_searches").delete().eq("member_id", session.user.id).in("id", ids);
}
