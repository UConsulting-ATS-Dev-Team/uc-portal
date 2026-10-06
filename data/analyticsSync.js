import { supabase } from "./supabaseClient.js";

// Reads for the Site analytics page. Every one is an admin-only database function or an admin-only table, so a non-admin session
// gets nothing even by calling these directly.

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const fetchDaily = (days) => rpc("analytics_daily", { p_days: days });
export const fetchRangeSummary = (days) => rpc("analytics_range_summary", { p_days: days });
export const fetchTopPages = (days, limit = 15) => rpc("analytics_top_pages", { p_days: days, p_limit: limit });
export const fetchEngagement = () => rpc("member_engagement_report", { inactive_threshold_days: 14 });

export async function fetchClientErrors(limit = 50) {
  const { data, error } = await supabase.from("client_error_reports").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countClientErrorsSince(iso) {
  const { count, error } = await supabase.from("client_error_reports").select("id", { count: "exact", head: true }).gte("created_at", iso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Email health from the send log: how many went out, how many failed, and how many addresses are unsubscribed.
export async function fetchEmailStats(days) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [{ data: messages, error }, { count: suppressed }, { count: contacts }] = await Promise.all([
    supabase.from("comm_messages").select("id, subject, channel, status, sent_count, failed_count, recipient_count, created_at, audience_label, is_test").eq("channel", "email").gte("created_at", since).order("created_at", { ascending: false }),
    supabase.from("comm_suppressions").select("email", { count: "exact", head: true }),
    supabase.from("mailing_list_contacts").select("id", { count: "exact", head: true }),
  ]);
  if (error) throw new Error(error.message);
  const real = (messages ?? []).filter((m) => !m.is_test);
  return {
    messages: real,
    sent: real.reduce((n, m) => n + m.sent_count, 0),
    failed: real.reduce((n, m) => n + m.failed_count, 0),
    suppressed: suppressed ?? 0,
    contacts: contacts ?? 0,
  };
}
