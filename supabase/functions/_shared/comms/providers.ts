// Where messages actually leave the system. Every send goes through one of these, and each reports whether it is configured, so
// the rest of the app can be built and used before any credentials exist and simply switches on when they are added:
//
//   Email  (Amazon SES):  AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, COMMS_FROM_EMAIL
//                         optional COMMS_FROM_NAME, COMMS_REPLY_TO
//   Slack  (bot token):   SLACK_BOT_TOKEN
//   Unsubscribe links:    COMMS_UNSUBSCRIBE_SECRET (any long random string)
//
// Set them with `supabase secrets set NAME=value`. Nothing here is called unless an admin asks for a send, and no function sends
// while its provider is unconfigured.
//
// Swapping providers (say, Resend instead of SES) means rewriting sendEmail() below and emailConfigured(); nothing else changes.

import { SESv2Client, SendEmailCommand } from "npm:@aws-sdk/client-sesv2@3";

const env = (name: string) => (Deno.env.get(name) ?? "").trim();

export function emailConfigured(): boolean {
  return Boolean(env("AWS_REGION") && env("AWS_ACCESS_KEY_ID") && env("AWS_SECRET_ACCESS_KEY") && env("COMMS_FROM_EMAIL"));
}

export function slackConfigured(): boolean {
  return Boolean(env("SLACK_BOT_TOKEN"));
}

export function unsubscribeSecret(): string {
  return env("COMMS_UNSUBSCRIBE_SECRET");
}

export function providerStatus() {
  return {
    email: { configured: emailConfigured(), fromEmail: env("COMMS_FROM_EMAIL") || null, fromName: env("COMMS_FROM_NAME") || null },
    slack: { configured: slackConfigured() },
    unsubscribeSecretSet: Boolean(unsubscribeSecret()),
  };
}

// Where the public unsubscribe function lives for this project.
export function unsubscribeBaseUrl(): string {
  return `${env("SUPABASE_URL")}/functions/v1/unsubscribe`;
}

let sesClient: SESv2Client | null = null;
function ses(): SESv2Client {
  sesClient ??= new SESv2Client({ region: env("AWS_REGION") });
  return sesClient;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Present on bulk mail: becomes the List-Unsubscribe headers mail clients show as an "Unsubscribe" button.
  unsubscribeUrl?: string | null;
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export async function sendEmail(message: OutgoingEmail): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: "Email isn't connected yet." };
  const fromName = env("COMMS_FROM_NAME");
  const from = fromName ? `${fromName} <${env("COMMS_FROM_EMAIL")}>` : env("COMMS_FROM_EMAIL");
  const headers = message.unsubscribeUrl
    ? [
        { Name: "List-Unsubscribe", Value: `<${message.unsubscribeUrl}>` },
        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
      ]
    : undefined;
  try {
    const result = await ses().send(
      new SendEmailCommand({
        FromEmailAddress: from,
        ReplyToAddresses: env("COMMS_REPLY_TO") ? [env("COMMS_REPLY_TO")] : undefined,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: "UTF-8" },
            Body: { Html: { Data: message.html, Charset: "UTF-8" }, Text: { Data: message.text, Charset: "UTF-8" } },
            Headers: headers,
          },
        },
      })
    );
    return { ok: true, providerId: result.MessageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function slackCall(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("SLACK_BOT_TOKEN")}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return await res.json();
}

// Posts text to a channel (by id or name) or, for a person, finds them by email address and sends a direct message.
export async function sendSlack(target: { channel: string } | { email: string }, text: string): Promise<SendResult> {
  if (!slackConfigured()) return { ok: false, error: "Slack isn't connected yet." };
  try {
    let channel: string;
    if ("channel" in target) {
      channel = target.channel;
    } else {
      const user = await slackCall("users.lookupByEmail", { email: target.email });
      if (!user.ok) return { ok: false, error: `Slack couldn't find ${target.email} (${user.error})` };
      const opened = await slackCall("conversations.open", { users: (user.user as { id: string }).id });
      if (!opened.ok) return { ok: false, error: `Slack couldn't open a direct message (${opened.error})` };
      channel = (opened.channel as { id: string }).id;
    }
    const posted = await slackCall("chat.postMessage", { channel, text, mrkdwn: true });
    return posted.ok ? { ok: true, providerId: String(posted.ts ?? "") } : { ok: false, error: String(posted.error ?? "Slack refused the message") };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Public channels the bot can see, for the Slack tab's picker.
export async function listSlackChannels(): Promise<Array<{ id: string; name: string }>> {
  if (!slackConfigured()) return [];
  const result = await slackCall("conversations.list", { types: "public_channel", exclude_archived: true, limit: 200 });
  if (!result.ok) return [];
  return ((result.channels as Array<{ id: string; name: string }>) ?? []).map((c) => ({ id: c.id, name: c.name }));
}
