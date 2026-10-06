// Delivery: turns queued recipients into sent messages. Called by process-comm-queue (every minute, and the only thing that sends
// scheduled messages) and by send-communication right after it queues a message, so a send starts at once instead of waiting for
// the next minute.
//
// It does nothing for a channel whose provider has no credentials yet: those recipients stay queued, untouched, and go out the
// minute credentials appear. send-communication refuses to queue anything while a provider is unconfigured, so in practice that
// only happens if credentials are removed after a send was queued.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { composeEmailHtml, fillMergeFields, fillMergeFieldsHtml, markdownToHtml, markdownToSlack, markdownToText, mergeVarsFor } from "./render.ts";
import { emailConfigured, sendEmail, sendSlack, slackConfigured, unsubscribeBaseUrl, unsubscribeSecret } from "./providers.ts";
import { signUnsubscribeToken } from "./unsubscribe.ts";

interface Claimed {
  recipient_id: string;
  message_id: string;
  channel: "email" | "slack" | "imessage";
  subject: string | null;
  body: string;
  slack_target: string | null;
  is_test: boolean;
  person_key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface QueueResult {
  released: number;
  sent: number;
  failed: number;
  skipped: number;
  email: { configured: boolean };
  slack: { configured: boolean };
}

const CONCURRENCY = 5;

async function deliver(item: Claimed): Promise<{ ok: boolean; skipped?: string; providerId?: string; error?: string }> {
  const vars = mergeVarsFor({ name: item.name ?? "", email: item.email });
  if (item.channel === "email") {
    if (!item.email) return { ok: false, skipped: "No email address" };
    const bulk = !item.is_test;
    let unsubscribeUrl: string | null = null;
    if (bulk) {
      const token = await signUnsubscribeToken(item.email, unsubscribeSecret());
      unsubscribeUrl = `${unsubscribeBaseUrl()}?t=${encodeURIComponent(token)}`;
    }
    const html = composeEmailHtml({ bodyHtml: fillMergeFieldsHtml(markdownToHtml(item.body), vars), unsubscribeUrl });
    const text = fillMergeFields(markdownToText(item.body), vars) + (unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : "");
    const subject = fillMergeFields(item.subject ?? "", vars);
    const result = await sendEmail({ to: item.email, subject: item.is_test ? `[Test] ${subject}` : subject, html, text, unsubscribeUrl });
    return result;
  }
  // slack
  const text = fillMergeFields(markdownToSlack(item.body), vars);
  if (item.person_key === "slack-channel") {
    if (!item.slack_target) return { ok: false, error: "No Slack channel chosen" };
    return await sendSlack({ channel: item.slack_target }, text);
  }
  if (!item.email) return { ok: false, skipped: "No email address to find them on Slack" };
  return await sendSlack({ email: item.email }, text);
}

export async function processQueue(admin: SupabaseClient, opts: { budgetMs?: number; batch?: number } = {}): Promise<QueueResult> {
  const budgetMs = opts.budgetMs ?? 100_000;
  const batch = opts.batch ?? 25;
  const started = Date.now();
  const result: QueueResult = { released: 0, sent: 0, failed: 0, skipped: 0, email: { configured: emailConfigured() }, slack: { configured: slackConfigured() } };

  // 1. Scheduled messages whose time has come join the queue.
  const { data: due } = await admin
    .from("comm_messages")
    .update({ status: "queued", started_at: new Date().toISOString() })
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .select("id");
  result.released = due?.length ?? 0;

  const touched = new Set<string>();
  // Email needs the unsubscribe secret as well as SES: bulk mail without a working unsubscribe link is not allowed out.
  const channels = [...(emailConfigured() && unsubscribeSecret() ? ["email"] : []), ...(slackConfigured() ? ["slack"] : [])];
  if (channels.length === 0) return result;

  // 2. Deliver, a batch at a time, until the queue is empty or the time budget is spent.
  while (Date.now() - started < budgetMs) {
    const { data: claimed, error } = await admin.rpc("claim_comm_recipients", { p_limit: batch, p_channels: channels });
    if (error || !claimed || claimed.length === 0) break;
    const sendable = claimed as Claimed[];

    // Someone who unsubscribed (or whose account was deactivated) after the message was queued must not get it.
    const emails = [...new Set(sendable.filter((i) => i.channel === "email" && i.email).map((i) => i.email!.toLowerCase()))];
    const stopped = new Set<string>();
    if (emails.length > 0) {
      const [{ data: suppressed }, { data: unsubscribed }] = await Promise.all([
        admin.from("comm_suppressions").select("email").in("email", emails),
        admin.from("mailing_list_contacts").select("email").in("email", emails).eq("subscribed", false),
      ]);
      for (const row of [...(suppressed ?? []), ...(unsubscribed ?? [])]) stopped.add((row.email as string).toLowerCase());
    }
    const profileIds = sendable.filter((i) => i.person_key.startsWith("a:")).map((i) => i.person_key.slice(2));
    const deactivated = new Set<string>();
    if (profileIds.length > 0) {
      const { data: rows } = await admin.from("profiles").select("id").in("id", profileIds).not("deactivated_at", "is", null);
      for (const row of rows ?? []) deactivated.add(row.id as string);
    }

    for (let i = 0; i < sendable.length; i += CONCURRENCY) {
      await Promise.all(
        sendable.slice(i, i + CONCURRENCY).map(async (item) => {
          touched.add(item.message_id);
          let outcome: Awaited<ReturnType<typeof deliver>>;
          if (item.channel === "email" && !item.is_test && item.email && stopped.has(item.email.toLowerCase())) outcome = { ok: false, skipped: "Unsubscribed since this was queued" };
          else if (!item.is_test && item.person_key.startsWith("a:") && deactivated.has(item.person_key.slice(2))) outcome = { ok: false, skipped: "Account deactivated since this was queued" };
          else outcome = await deliver(item);

          if (outcome.ok) {
            result.sent++;
            await admin.from("comm_recipients").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: outcome.providerId ?? null, error: null }).eq("id", item.recipient_id);
          } else if (outcome.skipped) {
            result.skipped++;
            await admin.from("comm_recipients").update({ status: "skipped", error: outcome.skipped }).eq("id", item.recipient_id);
          } else {
            result.failed++;
            await admin.from("comm_recipients").update({ status: "failed", error: (outcome.error ?? "Send failed").slice(0, 500) }).eq("id", item.recipient_id);
          }
        })
      );
    }
  }

  for (const id of touched) await admin.rpc("refresh_comm_message", { p_message: id });
  return result;
}
