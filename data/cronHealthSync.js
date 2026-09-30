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
