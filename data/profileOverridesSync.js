import { supabase } from "./supabaseClient.js";

// Background sync for My Profile's Personal tab (profileOverrides) and
// onboardingComplete -- the one piece of real member identity that never
// had this treatment, unlike preferences/trackedJobs/savedJobIds/network
// connections, which all already sync this same way. Local state stays
// authoritative for rendering; this only reads once on mount to hydrate a
// returning member's real data (now this genuinely means "on any device",
// not just this browser) and writes in the background whenever it changes.
// Column names are snake_case (Postgres convention); local field names are
// camelCase -- these two functions are the only place that translation
// needs to happen. Same shape as memberPreferencesSync.js's pair.

function rowToOverrides(row) {
  return {
    profileOverrides: {
      fullName: row.full_name ?? "",
      classYear: row.class_year,
      majors: row.majors ?? "",
      ucCommittee: row.uc_committee ?? "",
      linkedIn: row.linkedin ?? "",
      resumeFileName: row.resume_file_name,
    },
    onboardingComplete: row.onboarding_complete,
    profileLastUpdated: row.profile_last_updated,
  };
}

// Nothing yet to hydrate is a real, common case (a brand new member, or
// the prototype's demo/offline mode) -- callers should keep local state
// in that case, not treat null as an error.
export async function fetchRemoteProfileOverrides() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, class_year, majors, uc_committee, linkedin, resume_file_name, onboarding_complete, profile_last_updated")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToOverrides(data);
}

// Fire-and-forget update -- callers don't await this on the UI thread.
// A plain update (not upsert) deliberately: the profiles row always
// already exists by the time any real session can call this (auto-
// created by handle_new_user() the moment someone signs up), and
// members correctly have no INSERT policy on this table (nothing should
// let a member create an arbitrary profiles row) -- Postgres/PostgREST's
// upsert still requires INSERT privilege to plan the ON CONFLICT attempt
// even when it always resolves to an update, so upsert() 403'd here with
// a real RLS violation on first live test, caught before this ever
// reached a device this session didn't already own a row on. Only ever
// writes the columns this file owns -- never touches `role`
// (profiles_update_admin/the self-escalation trigger's own concern) or
// any column another sync module owns.
export async function syncProfileOverridesToRemote(profileOverrides, onboardingComplete, profileLastUpdated) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  await supabase
    .from("profiles")
    .update({
      full_name: profileOverrides.fullName || null,
      class_year: profileOverrides.classYear,
      majors: profileOverrides.majors || null,
      uc_committee: profileOverrides.ucCommittee || null,
      linkedin: profileOverrides.linkedIn || null,
      resume_file_name: profileOverrides.resumeFileName,
      onboarding_complete: onboardingComplete,
      profile_last_updated: profileLastUpdated,
    })
    .eq("id", session.user.id);
}
