import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./fetchAllRows.js";

// Background sync between the local trackedJobs/prepLogged/timelineShiftDays
// maps (data/store.jsx, still the source of truth for the UI) and the real
// tracked_applications table -- same pattern as data/memberPreferencesSync.js,
// just per-application (one upsert per job) instead of one blob for the
// whole member. Local state stays authoritative for rendering (so drag-and-
// drop on the Board/Timeline stays instant, no round-trip before the UI
// updates); this only hydrates once on mount and writes in the background
// whenever a specific application changes.
//
// One row per (member, job) folds trackedJobs + prepLogged +
// timelineShiftDays into a single table -- see the migration's own comment
// for why those were only ever three separate local maps for incremental-
// build reasons, not because they're logically distinct.

function rowsToLocalMaps(rows) {
  const trackedJobs = {};
  const prepLogged = {};
  const timelineShiftDays = {};
  for (const row of rows) {
    trackedJobs[row.job_id] = { stage: row.stage, addedAt: row.added_at, stageHistory: row.stage_history };
    if (row.prep_logged_hours) prepLogged[row.job_id] = row.prep_logged_hours;
    if (row.timeline_shift_days) timelineShiftDays[row.job_id] = row.timeline_shift_days;
  }
  return { trackedJobs, prepLogged, timelineShiftDays };
}

// Called once on mount. Returns null if there's no signed-in session or the
// member has no real tracked applications yet -- callers should keep
// whatever's already local (including the seed demo data) in that case,
// same "null isn't an error, it's an untouched member" convention
// memberPreferencesSync.js already established.
export async function fetchRemoteTrackedApplications() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const rows = await fetchAllRows("tracked_applications", "*", (q) => q.eq("member_id", session.user.id));
  if (rows.length === 0) return null;
  return rowsToLocalMaps(rows);
}

// Fire-and-forget upsert of one application's complete current record --
// callers pass the full post-update {stage, addedAt, stageHistory,
// prepLoggedHours, timelineShiftDays} for that one job_id, computed
// locally right before/alongside the setState call that updates the UI, so
// this never has to read state back out of React to know what to send.
export async function syncTrackedApplicationToRemote(jobId, record) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.from("tracked_applications").upsert(
    {
      member_id: session.user.id,
      job_id: jobId,
      stage: record.stage,
      added_at: record.addedAt,
      stage_history: record.stageHistory,
      prep_logged_hours: record.prepLoggedHours ?? 0,
      timeline_shift_days: record.timelineShiftDays ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id,job_id" }
  );
}
