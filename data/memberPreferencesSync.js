import { supabase } from "./supabaseClient.js";

// Background sync between the local `preferences` object (data/store.jsx,
// still the source of truth for the UI -- Onboarding.jsx/MyProfile.jsx are
// untouched by this) and the real member_preferences table (Stage 2). Local
// state stays authoritative for rendering; this only reads once on mount to
// hydrate a returning member's real data, and writes in the background
// whenever preferences change, so the data exists in Supabase for
// data/jobMatch.js to eventually run server-side against (Part 3.9).
// Column names are snake_case (Postgres convention); local field names are
// camelCase -- these two functions are the only place that translation
// needs to happen.

function rowToPreferences(row) {
  return {
    industries: row.industries,
    roles: row.roles,
    skills: row.skills,
    locations: row.locations,
    openToRelocating: row.open_to_relocating,
    remoteOrHybridOnly: row.remote_or_hybrid_only,
    followedCompanies: row.followed_companies,
    recruitingCycle: row.recruiting_cycle,
    helpNeeded: row.help_needed,
    remindersEnabled: row.reminders_enabled,
    resumeAttached: row.resume_attached,
    opportunityType: row.opportunity_type,
    compTarget: row.comp_target,
    recruitingSettings: row.recruiting_settings,
  };
}

function preferencesToRow(userId, preferences) {
  return {
    id: userId,
    industries: preferences.industries,
    roles: preferences.roles,
    skills: preferences.skills,
    locations: preferences.locations,
    open_to_relocating: preferences.openToRelocating,
    remote_or_hybrid_only: preferences.remoteOrHybridOnly,
    followed_companies: preferences.followedCompanies,
    recruiting_cycle: preferences.recruitingCycle,
    help_needed: preferences.helpNeeded,
    reminders_enabled: preferences.remindersEnabled,
    resume_attached: preferences.resumeAttached,
    opportunity_type: preferences.opportunityType,
    comp_target: preferences.compTarget,
    recruiting_settings: preferences.recruitingSettings,
    updated_at: new Date().toISOString(),
  };
}

// Called once on mount. Returns null if there's no signed-in session or no
// remote row yet (a brand new member, or the prototype's demo/offline mode)
// -- callers should keep the local/default preferences in that case, not
// treat null as an error.
export async function fetchRemotePreferences() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase.from("member_preferences").select("*").eq("id", session.user.id).maybeSingle();
  if (error || !data) return null;
  return rowToPreferences(data);
}

// Fire-and-forget upsert -- callers don't await this on the UI thread, a
// failed background sync shouldn't block or roll back a local state update
// the member already sees reflected on screen.
export async function syncPreferencesToRemote(preferences) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.from("member_preferences").upsert(preferencesToRow(session.user.id, preferences));
}
