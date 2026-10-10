// Sends, schedules or test-sends a mass message (email or Slack). Admin only, re-checked here, never trusting the page.
//
//   preview   resolve the audience and report who would receive it (and who is left out, and why). Sends nothing.
//   test      send ONE copy to the calling admin only, rendered with their own details. Nothing else is touched.
//   send      queue the message for every recipient and start delivering now.
//   schedule  queue it for a later time; the queue worker releases it when due.
//
// send and schedule take `confirmCount`: the recipient count the admin saw and confirmed. If the audience changed since
// (someone unsubscribed, an account was added) the call is refused with the new count instead of sending to a different crowd.
//
// Nothing goes out while a provider is unconfigured: the function answers 412 and writes nothing. That is also what keeps the
// pages usable before the email provider exists. iMessage is not handled here (it is handed off from the admin's own phone,
// see the iMessage tab).

import { requireAdmin } from "../_shared/requireAdmin.ts";
import { describeAudience, resolveAudience, EXCLUDE_LABEL, type Audience, type Channel } from "../_shared/comms/audience.ts";
import { loadPeople } from "../_shared/comms/people.ts";
import { unknownMergeFields, previewLine } from "../_shared/comms/render.ts";
import { emailConfigured, slackConfigured, unsubscribeSecret } from "../_shared/comms/providers.ts";
import { processQueue } from "../_shared/comms/queue.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const MAX_RECIPIENTS = 2000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;
  const { adminClient, user } = ctx;

  let input: {
    action?: string;
    channel?: Channel;
    subject?: string;
    body?: string;
    audience?: Audience;
    slackTarget?: string | null;
    scheduledFor?: string | null;
    templateId?: string | null;
    senderPresetId?: string | null;
    confirmCount?: number;
  };
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Send a JSON body." }, 400);
  }

  const { action, channel } = input;
  if (!["preview", "test", "send", "schedule"].includes(action ?? "")) return jsonResponse({ error: "Unknown action." }, 400);
  if (channel !== "email" && channel !== "slack") return jsonResponse({ error: "Channel must be email or slack." }, 400);

  const body = (input.body ?? "").trim();
  const subject = (input.subject ?? "").trim();
  const audience = input.audience ?? { match: "all", groups: [] };

  let loaded: Awaited<ReturnType<typeof loadPeople>>;
  try {
    loaded = await loadPeople(adminClient, "comm_accounts_internal");
  } catch (err) {
    return jsonResponse({ error: `Couldn't load recipients: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
  const { people, suppressedEmails } = loaded;
  const resolved = resolveAudience(people, audience, { channel, suppressedEmails });

  if (action === "preview") {
    const byReason: Record<string, number> = {};
    for (const e of resolved.excluded) byReason[EXCLUDE_LABEL[e.reason]] = (byReason[EXCLUDE_LABEL[e.reason]] ?? 0) + 1;
    return jsonResponse({
      recipientCount: resolved.recipients.length,
      excluded: byReason,
      sample: resolved.recipients.slice(0, 200).map((p) => ({ name: p.name, email: p.email })),
    });
  }

  // Everything below can send, so it needs content, a connected provider, and (for email) a working unsubscribe link.
  if (!body) return jsonResponse({ error: "Write a message first." }, 400);
  if (channel === "email" && !subject) return jsonResponse({ error: "Add a subject." }, 400);
  const unknown = unknownMergeFields(`${subject}\n${body}`);
  if (unknown.length > 0) return jsonResponse({ error: `These aren't fields we can fill in: ${unknown.map((u) => `{{${u}}}`).join(", ")}.` }, 400);
  if (channel === "email" && !emailConfigured()) return jsonResponse({ error: "email_not_configured" }, 412);
  if (channel === "email" && !unsubscribeSecret()) return jsonResponse({ error: "unsubscribe_secret_missing" }, 412);
  if (channel === "slack" && !slackConfigured()) return jsonResponse({ error: "slack_not_configured" }, 412);

  // The sender preset the admin picked (email only). Copied onto the message so later edits to the preset don't rewrite it.
  let sender: { from_name: string | null; reply_to: string | null } = { from_name: null, reply_to: null };
  if (channel === "email" && input.senderPresetId) {
    const { data: preset } = await adminClient.from("comm_sender_presets").select("from_name, reply_to").eq("id", input.senderPresetId).maybeSingle();
    if (!preset) return jsonResponse({ error: "That sender no longer exists. Pick another." }, 400);
    sender = { from_name: preset.from_name as string, reply_to: preset.reply_to as string | null };
  }

  // ---- test: one copy to the admin, nothing else ----
  if (action === "test") {
    if (!user.email) return jsonResponse({ error: "Your account has no email address to send a test to." }, 400);
    const { data: message, error: messageError } = await adminClient
      .from("comm_messages")
      .insert({ channel, subject: subject || null, body, audience: {}, audience_label: "Test to you", status: "queued", is_test: true, created_by: user.id, started_at: new Date().toISOString(), recipient_count: 1, slack_target: null, ...sender })
      .select("id")
      .single();
    if (messageError) return jsonResponse({ error: messageError.message }, 500);
    const displayName = (user.user_metadata as { full_name?: string } | undefined)?.full_name || (user.email as string).split("@")[0];
    await adminClient.from("comm_recipients").insert({ message_id: message.id, person_key: `a:${user.id}`, profile_id: user.id, name: displayName, email: user.email });
    const outcome = await processQueue(adminClient, { budgetMs: 20_000, batch: 5 });
    return jsonResponse({ messageId: message.id, sent: outcome.sent, failed: outcome.failed });
  }

  // ---- send / schedule ----
  const isChannelPost = channel === "slack" && Boolean(input.slackTarget);
  const recipients = isChannelPost ? [] : resolved.recipients;
  const recipientCount = isChannelPost ? 1 : recipients.length;
  if (recipientCount === 0) return jsonResponse({ error: "Nobody would receive this. Check the audience." }, 400);
  if (recipientCount > MAX_RECIPIENTS) return jsonResponse({ error: `That's ${recipientCount} recipients; the limit per send is ${MAX_RECIPIENTS}.` }, 400);
  if (input.confirmCount !== recipientCount) return jsonResponse({ error: "audience_changed", recipientCount }, 409);

  let scheduledFor: string | null = null;
  if (action === "schedule") {
    const when = input.scheduledFor ? new Date(input.scheduledFor) : null;
    if (!when || Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) return jsonResponse({ error: "Pick a time at least a minute from now." }, 400);
    scheduledFor = when.toISOString();
  }

  const { data: message, error: messageError } = await adminClient
    .from("comm_messages")
    .insert({
      channel,
      subject: subject || null,
      body,
      audience,
      audience_label: isChannelPost ? `Slack channel ${input.slackTarget}` : describeAudience(audience),
      slack_target: isChannelPost ? input.slackTarget : null,
      status: action === "schedule" ? "scheduled" : "queued",
      scheduled_for: scheduledFor,
      template_id: input.templateId ?? null,
      created_by: user.id,
      started_at: action === "send" ? new Date().toISOString() : null,
      recipient_count: recipientCount,
      ...sender,
    })
    .select("id")
    .single();
  if (messageError) return jsonResponse({ error: messageError.message }, 500);

  const rows = isChannelPost
    ? [{ message_id: message.id, person_key: "slack-channel", name: `#${input.slackTarget}` }]
    : recipients.map((p) => ({ message_id: message.id, person_key: p.key, profile_id: p.profileId, contact_id: p.contactId, name: p.name, email: p.email, phone: p.phone }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await adminClient.from("comm_recipients").insert(rows.slice(i, i + 500));
    if (error) {
      await adminClient.from("comm_messages").delete().eq("id", message.id);
      return jsonResponse({ error: error.message }, 500);
    }
  }

  if (action === "send") await processQueue(adminClient, { budgetMs: 25_000 });
  return jsonResponse({ messageId: message.id, recipientCount, preview: previewLine(body), scheduledFor });
});
