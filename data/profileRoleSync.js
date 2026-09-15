import { supabase } from "./supabaseClient.js";

// Real admin-role check, replacing the fully-disconnected mock
// data/mockUser.js#currentUser.role that NavRail.jsx/BottomTabBar.jsx used
// to gate the Leadership nav section on -- that constant never reflected
// who was actually signed in; every real session saw the exact same
// hardcoded "member" regardless of their real profiles.role. Same
// fetch-session-then-query-by-id shape as memberPreferencesSync.js's
// fetchRemotePreferences(), just against `profiles` instead.
export async function fetchRealRole() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
  if (error || !data) return null;
  return data.role;
}

// Same fetch-session-then-query-by-id shape as fetchRealRole() above, for
// the separate member_status column (membership status: current_member vs
// alumni -- not an access level, that's still role above). A second query
// rather than folding into fetchRealRole()'s single select, matching how
// every other small real-data signal in this app gets its own tiny sync
// function/effect rather than one growing combined one.
export async function fetchRealMemberStatus() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase.from("profiles").select("member_status").eq("id", session.user.id).maybeSingle();
  if (error || !data) return null;
  return data.member_status;
}
