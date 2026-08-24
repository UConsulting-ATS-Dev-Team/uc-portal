import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./fetchAllRows.js";

// Background sync for savedConnections/coffeeChatStatus (data/store.jsx),
// same shape as data/trackerSync.js: local state stays authoritative for
// rendering, one hydration fetch on mount (merged into local, not
// replacing it, so SEED_COFFEE_CHATS survives until a member has real
// synced connections of their own), fire-and-forget upsert per mutation.

function rowsToLocalMaps(rows) {
  const savedConnections = [];
  const coffeeChatStatus = {};
  for (const row of rows) {
    if (row.saved) savedConnections.push(row.person_id);
    if (row.coffee_chat_status) coffeeChatStatus[row.person_id] = row.coffee_chat_status;
  }
  return { savedConnections, coffeeChatStatus };
}

export async function fetchRemoteNetworkConnections() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const rows = await fetchAllRows("network_connections", "*", (q) => q.eq("member_id", session.user.id));
  if (rows.length === 0) return null;
  return rowsToLocalMaps(rows);
}

// Callers pass the complete current {saved, coffeeChatStatus} for this one
// person -- both fields live in the same row, so toggling just one (e.g.
// requestCoffeeChat) still has to know the other's current value (e.g.
// whether this person is already saved) or the upsert would silently reset
// it to its default. Same reasoning as tracked_applications' per-mutation
// full-record payloads.
export async function syncNetworkConnectionToRemote(personId, { saved, coffeeChatStatus }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.from("network_connections").upsert(
    {
      member_id: session.user.id,
      person_id: personId,
      saved: saved ?? false,
      coffee_chat_status: coffeeChatStatus ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id,person_id" }
  );
}
