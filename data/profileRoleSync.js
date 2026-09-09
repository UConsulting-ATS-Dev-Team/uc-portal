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
