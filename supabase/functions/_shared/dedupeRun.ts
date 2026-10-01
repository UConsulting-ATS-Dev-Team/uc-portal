// Real, confirmed-live mitigation for a systemic pg_net worker-level
// duplicate-delivery bug -- see the cron_run_locks migration's own
// header comment for the full finding (every scheduled function invoked
// twice per real cron firing, every day, confirmed across both a slow
// and a fast function, with only one net.http_post() call per day at
// the SQL level and no duplicate cron.job registration). This can't be
// fixed at the cause (inside pg_net itself), so each scheduled function
// calls this right before doing any real external-API/expensive work,
// and short-circuits if it loses the race.
//
// A unique-constraint-backed claim, not a read-then-check: two
// near-simultaneous invocations both attempt to INSERT a row keyed by
// (job_key, minute-bucket). Postgres's own unique-index enforcement is
// atomic, so exactly one of the two inserts can ever succeed -- no
// read-then-write race the way a "select, then insert if absent" check
// would have. The bucket is computed client-side (rounded to the
// minute), so two invocations that happen to straddle an exact minute
// boundary could both slip through unsuppressed -- a rare, low-stakes
// edge case (no worse than today's status quo on that one occurrence),
// not worth a server-side round-trip to close completely.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function claimRunOrSkip(adminClient: SupabaseClient, jobKey: string): Promise<boolean> {
  const runWindow = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const { error } = await adminClient.from("cron_run_locks").insert({ job_key: jobKey, run_window: runWindow });

  if (!error) return true; // claimed the lock -- this is the real run, proceed
  if (error.code === "23505") return false; // unique violation -- a duplicate delivery, skip

  // Any other error (transient network blip talking to Postgres, etc.)
  // -- fail OPEN. Silently skipping the day's only real run is a worse
  // failure mode than occasionally letting a genuine duplicate through.
  return true;
}
