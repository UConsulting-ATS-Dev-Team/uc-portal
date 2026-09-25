// Weekly digest content computation -- see the weekly_digests migration's
// own header comment for the full "why this is groundwork, not a finished
// email" rationale. Runs every Monday via pg_cron (net.http_post, no user
// JWT -- same pattern check-job-links/snapshot-job-board already use for
// a scheduled, not user-triggered, function).
//
// Scope: current_member and alumni only -- interns are route-guarded away
// from Jobs/Messages/Feed almost entirely (components/RequireNotIntern.jsx),
// so a digest built from those signals wouldn't mean anything for them.
// Respects member_preferences.reminders_enabled -- the same real opt-out
// Notifications' own settings panel already writes to, not a new consent
// flag invented for this.
//
// Upserts on (profile_id, week_of) so re-running this manually for testing
// (or a retry after a transient failure) doesn't create duplicate rows for
// the same week.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

function mondayOfThisWeek(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday));
  return monday.toISOString().slice(0, 10);
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const weekOf = mondayOfThisWeek();
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Real new-feed-posts count is shared across every member's digest this
  // run (it's a board-wide fact, not personal) -- computed once, not once
  // per member.
  const { count: newFeedPostsCount, error: feedCountError } = await adminClient
    .from("feed_posts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgoIso);
  if (feedCountError) return jsonResponse({ error: feedCountError.message }, 500);

  const { data: members, error: membersError } = await adminClient
    .from("profiles")
    .select("id, member_status")
    .in("member_status", ["current_member", "alumni"]);
  if (membersError) return jsonResponse({ error: membersError.message }, 500);

  const results: { profileId: string; skipped: boolean; reason?: string }[] = [];

  for (const member of members ?? []) {
    const { data: prefs } = await adminClient
      .from("member_preferences")
      .select("industries, followed_companies, reminders_enabled")
      .eq("id", member.id)
      .maybeSingle();

    if (prefs && prefs.reminders_enabled === false) {
      results.push({ profileId: member.id, skipped: true, reason: "reminders_disabled" });
      continue;
    }

    let newMatchesCount = 0;
    if (member.member_status === "current_member") {
      const topIndustry = prefs?.industries?.[0];
      const followedCompanies = prefs?.followed_companies ?? [];
      if (topIndustry || followedCompanies.length > 0) {
        let query = adminClient
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .gte("posted_date", sevenDaysAgoIso.slice(0, 10));
        const orParts: string[] = [];
        if (topIndustry) orParts.push(`relevant_industries.cs.{${topIndustry}}`);
        if (followedCompanies.length > 0) orParts.push(`company.in.(${followedCompanies.map((c: string) => `"${c}"`).join(",")})`);
        query = query.or(orParts.join(","));
        const { count } = await query;
        newMatchesCount = count ?? 0;
      }
    }

    let deadlineCount = 0;
    {
      const { data: tracked } = await adminClient
        .from("tracked_applications")
        .select("job_id")
        .eq("member_id", member.id)
        .neq("stage", "Closed");
      const jobIds = (tracked ?? []).map((t) => t.job_id).filter((id: string) => /^[0-9a-f-]{36}$/i.test(id));
      if (jobIds.length > 0) {
        const sevenDaysAheadIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const { count } = await adminClient
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("id", jobIds)
          .gte("application_deadline", new Date().toISOString().slice(0, 10))
          .lte("application_deadline", sevenDaysAheadIso);
        deadlineCount = count ?? 0;
      }
    }

    let unreadMessageCount = 0;
    {
      const { count } = await adminClient
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", member.id)
        .is("read_at", null);
      unreadMessageCount = count ?? 0;
    }

    const feedCount = newFeedPostsCount ?? 0;

    if (newMatchesCount === 0 && deadlineCount === 0 && unreadMessageCount === 0 && feedCount === 0) {
      results.push({ profileId: member.id, skipped: true, reason: "nothing_to_report" });
      continue;
    }

    const lines: string[] = [];
    if (newMatchesCount > 0) lines.push(`${newMatchesCount} new role${newMatchesCount === 1 ? "" : "s"} matched your profile this week.`);
    if (deadlineCount > 0) lines.push(`${deadlineCount} deadline${deadlineCount === 1 ? "" : "s"} coming up in the next 7 days on your tracked applications.`);
    if (unreadMessageCount > 0) lines.push(`${unreadMessageCount} unread message${unreadMessageCount === 1 ? "" : "s"} waiting for you.`);
    if (feedCount > 0) lines.push(`${feedCount} new post${feedCount === 1 ? "" : "s"} on the UC feed this week.`);

    const subject = "Your UC Portal weekly digest";
    const bodyText = lines.join(" ");

    const { error: upsertError } = await adminClient.from("weekly_digests").upsert(
      {
        profile_id: member.id,
        week_of: weekOf,
        new_matches_count: newMatchesCount,
        deadline_count: deadlineCount,
        unread_message_count: unreadMessageCount,
        new_feed_posts_count: feedCount,
        subject,
        body_text: bodyText,
      },
      { onConflict: "profile_id,week_of" }
    );
    if (upsertError) {
      results.push({ profileId: member.id, skipped: true, reason: upsertError.message });
      continue;
    }
    results.push({ profileId: member.id, skipped: false });
  }

  const written = results.filter((r) => !r.skipped).length;
  return jsonResponse({ weekOf, totalMembers: (members ?? []).length, written, results });
});
