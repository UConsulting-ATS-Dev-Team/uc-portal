import { supabase } from "./supabaseClient.js";

// Reads and actions for the admin tools that sit beside user management: the audit log, class rollover and the exportable reports.
// Everything here is an admin-only table or database function; a non-admin session gets nothing back.

// Which audit actions belong to which filter on the log page.
export const AUDIT_GROUPS = {
  accounts: ["role_changed", "membership_changed", "account_edited", "account_created", "account_deactivated", "account_reactivated", "class_rollover"],
  messages: ["message_sent", "message_scheduled", "message_cancelled", "imessage_logged", "sender_added", "sender_removed"],
  mailing: ["contacts_imported", "contacts_removed", "contacts_tagged", "suppression_added", "suppression_removed"],
  automatic: ["automatic_email_on", "automatic_email_off", "automatic_email_reworded"],
};

export async function fetchAuditLog({ group = "", offset = 0, limit = 50 } = {}) {
  let query = supabase.from("admin_audit_log").select("*").order("at", { ascending: false }).order("id").range(offset, offset + limit - 1);
  if (group && AUDIT_GROUPS[group]) query = query.in("action", AUDIT_GROUPS[group]);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Moves the chosen people (still current members of that class) to alumni. Returns how many actually changed.
export async function applyClassRollover(ids, classYear) {
  const { data, error } = await supabase.rpc("admin_class_rollover_apply", { p_ids: ids, p_class_year: classYear });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

// Tracked-application counts by stage and class year. Counts only; small classes are folded into one row with classYear null.
export async function fetchStageCounts() {
  const { data, error } = await supabase.rpc("admin_application_stage_counts");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ stage: r.stage, classYear: r.class_year, applications: r.applications, members: r.members }));
}
