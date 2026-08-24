import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./fetchAllRows.js";

// Background sync for savedJobIds (data/store.jsx), same shape as
// data/trackerSync.js and data/networkSync.js. Presence-based (a row
// exists iff the job is saved), so this is insert-on-save/delete-on-unsave
// rather than an upsert with a boolean column.

export async function fetchRemoteSavedJobs() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const rows = await fetchAllRows("saved_jobs", "job_id", (q) => q.eq("member_id", session.user.id));
  if (rows.length === 0) return null;
  return rows.map((r) => r.job_id);
}

export async function syncSavedJobToRemote(jobId, isSaved) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  if (isSaved) {
    await supabase.from("saved_jobs").upsert({ member_id: session.user.id, job_id: jobId }, { onConflict: "member_id,job_id" });
  } else {
    await supabase.from("saved_jobs").delete().eq("member_id", session.user.id).eq("job_id", jobId);
  }
}
