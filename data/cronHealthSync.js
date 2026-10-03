import { supabase } from "./supabaseClient.js";

// Real cron-failure alerting -- see check_cron_health() (migration
// 20260930220000) for the full rationale: this club runs on 6 unattended
// pg_cron jobs (5 daily + the weekly digest), and a silent failure in any
// of them would otherwise be invisible until someone noticed stale data.
export async function fetchCronHealth() {
  const { data, error } = await supabase.rpc("check_cron_health");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Employer boards that look gone: a source whose last 3 fetches all failed with HTTP 404 (see
// list_dead_sources, migration 20261008400000). A board that has been taken down makes its source fail on
// every run, and a failed fetch never marks jobs missed, so its jobs would otherwise stay active forever.
export async function fetchDeadSources() {
  const { data, error } = await supabase.rpc("list_dead_sources");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Disables the source and expires the jobs only it tracked. Returns how many jobs were expired. The
// database re-checks that the source really is flagged dead and refuses otherwise.
export async function disableDeadSource(sourceId) {
  const { data, error } = await supabase.rpc("disable_dead_source", { p_source_id: sourceId });
  if (error) throw new Error(error.message);
  return data ?? 0;
}
