// Daily (pg_cron, 9 AM Pacific): finds who is due an automatic email and queues it. Only the emails an admin has switched on, and
// only while email is connected; otherwise it does nothing and nothing is recorded, so switching an email on later doesn't send a
// backlog of old reminders for things that already passed.
//
// Each email goes to a person at most once per thing (a lesson, a meeting, a week): auto_email_log is the memory. Delivery is the
// ordinary queue (process-comm-queue), which re-checks unsubscribes and deactivation at send time.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCronSecret } from "../_shared/requireCronSecret.ts";
import { claimRunOrSkip } from "../_shared/dedupeRun.ts";
import { AUTO_EMAILS, effectiveCopy, type AutoEmailDef } from "../_shared/comms/autoEmails.ts";
import { fillMergeFields, mergeVarsFor } from "../_shared/comms/render.ts";
import { emailConfigured, unsubscribeSecret } from "../_shared/comms/providers.ts";
import { processQueue } from "../_shared/comms/queue.ts";

const TZ = "America/Los_Angeles";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface Account {
  member_id: string;
  display_name: string;
  email: string | null;
  member_status: string;
  deactivated_at: string | null;
}

interface Candidate {
  profileId: string;
  ref: string;
  vars: Record<string, string>;
}

// The club's meetings are scheduled in Pacific time: an event dated 2026-10-14 at 18:00 means 6 PM there.
function pacificInstant(date: string, time: string | null): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "23:59").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value])
  );
  const asPacific = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute));
  return new Date(guess - (asPacific - guess));
}

const longDate = (d: Date) => d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
const longDateTime = (d: Date) => `${longDate(d)} at ${d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })}`;
const todayPacific = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD

type Admin = ReturnType<typeof createClient>;

async function digestCandidates(admin: Admin): Promise<Candidate[]> {
  const since = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await admin.from("weekly_digests").select("profile_id, week_of, body_text").gte("week_of", since);
  return (data ?? []).map((row) => ({ profileId: row.profile_id as string, ref: row.week_of as string, vars: { digest: row.body_text as string } }));
}

async function assignmentCandidates(admin: Admin, interns: Account[]): Promise<Candidate[]> {
  const { data: lessons } = await admin.from("accelerator_lessons").select("id, title, lesson_date").order("lesson_date");
  const ordered = lessons ?? [];
  const today = todayPacific();
  const horizon = new Date(Date.parse(`${today}T12:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
  const due = ordered.filter((l) => l.lesson_date >= today && l.lesson_date <= horizon);
  if (due.length === 0 || interns.length === 0) return [];
  const { data: submissions } = await admin.from("accelerator_submissions").select("lesson_id, profile_id").in("lesson_id", due.map((l) => l.id));
  const done = new Set((submissions ?? []).map((s) => `${s.lesson_id}:${s.profile_id}`));
  const out: Candidate[] = [];
  for (const lesson of due) {
    const weekNumber = ordered.findIndex((l) => l.id === lesson.id) + 1;
    const dueDate = longDate(pacificInstant(lesson.lesson_date, "12:00"));
    for (const intern of interns) {
      if (!done.has(`${lesson.id}:${intern.member_id}`)) {
        out.push({ profileId: intern.member_id, ref: lesson.id, vars: { lessonTitle: lesson.title, weekNumber: String(weekNumber), dueDate } });
      }
    }
  }
  return out;
}

async function chatCandidates(admin: Admin, interns: Account[]): Promise<Candidate[]> {
  const { data: events } = await admin.from("accelerator_events").select("id, event_date, start_time").eq("kind", "accelerator").order("event_date");
  const meetings = (events ?? []).map((e) => ({ id: e.id as string, at: pacificInstant(e.event_date as string, e.start_time as string | null) })).sort((a, b) => a.at.getTime() - b.at.getTime());
  const now = Date.now();
  const upcomingIndex = meetings.findIndex((m) => m.at.getTime() > now && m.at.getTime() <= now + 36 * 3_600_000);
  if (upcomingIndex < 0 || interns.length === 0) return [];
  const meeting = meetings[upcomingIndex];
  const since = upcomingIndex > 0 ? meetings[upcomingIndex - 1].at.toISOString() : "1970-01-01T00:00:00Z";
  const { data: chats } = await admin
    .from("accelerator_coffee_chats")
    .select("profile_id")
    .in("profile_id", interns.map((i) => i.member_id))
    .gt("created_at", since)
    .lte("created_at", meeting.at.toISOString());
  const counts = new Map<string, number>();
  for (const c of chats ?? []) counts.set(c.profile_id as string, (counts.get(c.profile_id as string) ?? 0) + 1);
  return interns
    .filter((i) => (counts.get(i.member_id) ?? 0) < 3)
    .map((i) => ({ profileId: i.member_id, ref: meeting.id, vars: { meetingTime: longDateTime(meeting.at), chatsLogged: String(Math.min(3, counts.get(i.member_id) ?? 0)) } }));
}

const FOLLOW_UP_AFTER_DAYS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// A member's coffee chat requests that still read "Request sent" five days on. One email lists the ones not mentioned before, and
// each request is only ever mentioned once (the log keeps the person ids it covered).
async function followUpCandidates(admin: Admin, members: Account[]): Promise<Candidate[]> {
  if (members.length === 0) return [];
  const cutoff = new Date(Date.now() - FOLLOW_UP_AFTER_DAYS * 86_400_000).toISOString();
  const { data: rows } = await admin
    .from("network_connections")
    .select("member_id, person_id")
    .eq("coffee_chat_status", "Request sent")
    .lte("updated_at", cutoff)
    .in("member_id", members.map((m) => m.member_id));
  const pending = (rows ?? []).filter((r) => UUID.test(r.person_id as string));
  if (pending.length === 0) return [];

  const { data: people } = await admin.from("people").select("id, name").in("id", [...new Set(pending.map((r) => r.person_id as string))]);
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, p.name as string]));
  const { data: logged } = await admin.from("auto_email_log").select("profile_id, ref").eq("key", "coffee_chat_followup").in("profile_id", members.map((m) => m.member_id));
  const mentioned = new Set<string>();
  for (const l of logged ?? []) for (const id of String(l.ref).split(",")) mentioned.add(`${l.profile_id}:${id}`);

  const byMember = new Map<string, string[]>();
  for (const r of pending) {
    const id = r.person_id as string;
    if (!nameOf.has(id) || mentioned.has(`${r.member_id}:${id}`)) continue;
    byMember.set(r.member_id as string, [...(byMember.get(r.member_id as string) ?? []), id]);
  }
  return [...byMember.entries()].map(([profileId, ids]) => {
    const sorted = [...ids].sort();
    return { profileId, ref: sorted.join(","), vars: { personNames: joinNames(sorted.map((id) => nameOf.get(id)!)) } };
  });
}

Deno.serve(async (req) => {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!(await claimRunOrSkip(admin, "comms:auto-emails"))) return jsonResponse({ skipped: true, reason: "duplicate invocation suppressed" });
  if (!emailConfigured() || !unsubscribeSecret()) return jsonResponse({ skipped: true, reason: "email isn't connected" });

  const { data: settings } = await admin.from("auto_email_settings").select("key, enabled, subject, body").eq("enabled", true);
  if (!settings || settings.length === 0) return jsonResponse({ skipped: true, reason: "no automatic email is switched on" });

  const { data: accounts, error } = await admin.rpc("comm_accounts_internal");
  if (error) return jsonResponse({ error: error.message }, 500);
  const byId = new Map((accounts as Account[]).map((a) => [a.member_id, a]));
  const activeInterns = (accounts as Account[]).filter((a) => a.member_status === "intern" && !a.deactivated_at && a.email);
  const activeMembers = (accounts as Account[]).filter((a) => a.member_status === "current_member" && !a.deactivated_at && a.email);

  const queued: Record<string, number> = {};
  for (const setting of settings) {
    const def = AUTO_EMAILS.find((a) => a.key === setting.key) as AutoEmailDef | undefined;
    if (!def) continue;
    let candidates: Candidate[] = [];
    if (def.key === "weekly_digest") candidates = await digestCandidates(admin);
    else if (def.key === "accelerator_assignment_due") candidates = await assignmentCandidates(admin, activeInterns);
    else if (def.key === "accelerator_chats_due") candidates = await chatCandidates(admin, activeInterns);
    else if (def.key === "coffee_chat_followup") candidates = await followUpCandidates(admin, activeMembers);

    candidates = candidates.filter((c) => {
      const account = byId.get(c.profileId);
      return account && account.email && !account.deactivated_at;
    });
    if (candidates.length === 0) continue;

    const { data: already } = await admin.from("auto_email_log").select("profile_id, ref").eq("key", def.key).in("profile_id", candidates.map((c) => c.profileId));
    const sent = new Set((already ?? []).map((r) => `${r.profile_id}:${r.ref}`));
    const fresh = candidates.filter((c) => !sent.has(`${c.profileId}:${c.ref}`));
    if (fresh.length === 0) continue;

    const copy = effectiveCopy(def, setting);
    const { data: message, error: messageError } = await admin
      .from("comm_messages")
      .insert({ channel: "email", subject: copy.subject, body: copy.body, audience: {}, audience_label: `Automatic: ${def.label}`, status: "queued", is_test: false, started_at: new Date().toISOString(), recipient_count: fresh.length })
      .select("id")
      .single();
    if (messageError) return jsonResponse({ error: messageError.message }, 500);

    const rows = fresh.map((c) => {
      const account = byId.get(c.profileId)!;
      const vars = { ...mergeVarsFor({ name: account.display_name, email: account.email }), ...c.vars };
      return {
        message_id: message.id,
        person_key: `a:${c.profileId}`,
        profile_id: c.profileId,
        name: account.display_name,
        email: account.email,
        subject_override: fillMergeFields(copy.subject, vars),
        body_override: fillMergeFields(copy.body, vars),
      };
    });
    for (let i = 0; i < rows.length; i += 500) await admin.from("comm_recipients").insert(rows.slice(i, i + 500));
    await admin.from("auto_email_log").insert(fresh.map((c) => ({ key: def.key, profile_id: c.profileId, ref: c.ref })));
    queued[def.key] = fresh.length;
  }

  const delivery = await processQueue(admin, { budgetMs: 100_000 });
  return jsonResponse({ queued, delivery });
});
