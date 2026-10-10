import { supabase } from "./supabaseClient.js";
import { loadPeople } from "../supabase/functions/_shared/comms/people.ts";

// Everything the Communications pages read and write. Reads and the simple writes (templates, drafts, the mailing list, the
// unsubscribe list) go straight to the tables, which only admins can touch. Sending goes through the send-communication
// function, which re-checks admin access, re-resolves the audience itself and refuses while a provider isn't connected.

async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// The function's own message (the page shows it) rather than supabase-js's generic "non-2xx status code".
async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data;
  let parsed = null;
  try {
    parsed = await error.context?.json?.();
  } catch {
    // no body
  }
  const failure = new Error(parsed?.error ?? error.message);
  failure.code = parsed?.error;
  failure.details = parsed;
  throw failure;
}

export const fetchProviderStatus = ({ slackChannels = false } = {}) => invoke("comms-status", { slackChannels });

// { people, suppressedEmails }: portal accounts plus the mailing list, built the same way the send function builds them.
export const fetchPeople = () => loadPeople(supabase, "admin_list_accounts");

// action: "preview" | "test" | "send" | "schedule"
export const sendCommunication = (payload) => invoke("send-communication", payload);

// ---- templates ----
export const fetchTemplates = (channel) => {
  let q = supabase.from("comm_templates").select("*").order("name");
  if (channel) q = q.eq("channel", channel);
  return unwrap(q);
};
export async function saveTemplate({ id, name, channel, subject, body }) {
  const row = { name: name.trim(), channel, subject: subject?.trim() || null, body, updated_at: new Date().toISOString() };
  if (id) await unwrap(supabase.from("comm_templates").update(row).eq("id", id));
  else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await unwrap(supabase.from("comm_templates").insert({ ...row, created_by: user.id }));
  }
}
export const deleteTemplate = (id) => unwrap(supabase.from("comm_templates").delete().eq("id", id));

// ---- drafts ----
export const fetchDrafts = () => unwrap(supabase.from("comm_drafts").select("*").order("updated_at", { ascending: false }));
export async function saveDraft({ id, name, channel, subject, body, audience, slackTarget, scheduledFor }) {
  const row = {
    name: name.trim(),
    channel,
    subject: subject?.trim() || null,
    body,
    audience,
    slack_target: slackTarget || null,
    scheduled_for: scheduledFor || null,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    await unwrap(supabase.from("comm_drafts").update(row).eq("id", id));
    return id;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rows = await unwrap(supabase.from("comm_drafts").insert({ ...row, created_by: user.id }).select("id"));
  return rows[0].id;
}
export const deleteDraft = (id) => unwrap(supabase.from("comm_drafts").delete().eq("id", id));

// ---- saved audiences ----
export const fetchSavedAudiences = () => unwrap(supabase.from("comm_saved_audiences").select("*").order("name"));
export async function saveAudience(name, audience) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await unwrap(supabase.from("comm_saved_audiences").insert({ name: name.trim(), audience, created_by: user.id }));
}
export const deleteSavedAudience = (id) => unwrap(supabase.from("comm_saved_audiences").delete().eq("id", id));

// ---- log of sends ----
export const fetchMessages = ({ statuses, limit = 100 } = {}) => {
  let q = supabase.from("comm_messages").select("*").order("created_at", { ascending: false }).limit(limit);
  if (statuses) q = q.in("status", statuses);
  return unwrap(q);
};
export const fetchRecipients = (messageId) =>
  unwrap(supabase.from("comm_recipients").select("*").eq("message_id", messageId).order("created_at").order("id"));

// Cancels a message that is still scheduled: nobody receives it.
export async function cancelScheduled(messageId) {
  await unwrap(supabase.from("comm_messages").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", messageId).eq("status", "scheduled"));
  await unwrap(supabase.from("comm_recipients").update({ status: "skipped", error: "Cancelled before it was sent" }).eq("message_id", messageId).eq("status", "queued"));
}

// ---- iMessage: the portal writes the text, the admin sends it from their own phone, and this records that it was handed off ----
export async function logImessage({ body, audienceLabel, audience, recipients }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [message] = await unwrap(
    supabase
      .from("comm_messages")
      .insert({
        channel: "imessage",
        body,
        audience,
        audience_label: audienceLabel,
        status: "sent",
        created_by: user.id,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        recipient_count: recipients.length,
        sent_count: recipients.length,
      })
      .select("id")
  );
  await unwrap(
    supabase.from("comm_recipients").insert(
      recipients.map((p) => ({
        message_id: message.id,
        person_key: p.key,
        profile_id: p.profileId,
        contact_id: p.contactId,
        name: p.name,
        email: p.email,
        phone: p.phone,
        status: "handed_off",
        sent_at: new Date().toISOString(),
      }))
    )
  );
  return message.id;
}

// ---- mailing list ----
export const fetchContacts = () => unwrap(supabase.from("mailing_list_contacts").select("*").order("created_at", { ascending: false }).order("id"));

// rows: [{ email, name, tags }]. Existing addresses keep their subscribed flag and gain any new tags; nothing here can
// re-subscribe someone who unsubscribed.
export async function importContacts(rows) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const existing = new Map((await fetchContacts()).map((c) => [c.email, c]));
  const suppressed = new Set((await fetchSuppressions()).map((s) => s.email));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const inserts = [];
  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    const have = existing.get(email);
    if (have) {
      const tags = [...new Set([...(have.tags ?? []), ...row.tags])];
      if (tags.length !== (have.tags ?? []).length || (row.name && !have.name)) {
        await unwrap(supabase.from("mailing_list_contacts").update({ tags, name: have.name || row.name || null }).eq("id", have.id));
        updated++;
      } else skipped++;
    } else {
      inserts.push({ email, name: row.name?.trim() || null, tags: row.tags, subscribed: !suppressed.has(email), created_by: user.id });
      existing.set(email, { email });
      added++;
    }
  }
  for (let i = 0; i < inserts.length; i += 500) await unwrap(supabase.from("mailing_list_contacts").insert(inserts.slice(i, i + 500)));
  return { added, updated, skipped };
}
export const deleteContact = (id) => unwrap(supabase.from("mailing_list_contacts").delete().eq("id", id));
export async function deleteContacts(ids) {
  for (let i = 0; i < ids.length; i += 200) await unwrap(supabase.from("mailing_list_contacts").delete().in("id", ids.slice(i, i + 200)));
}
// Adds and/or removes tags on many contacts in one step (a database function, so it is one change and one audit entry).
export async function tagContacts(ids, { add = [], remove = [] }) {
  const { data, error } = await supabase.rpc("admin_contacts_tag", { p_ids: ids, p_add: add, p_remove: remove });
  if (error) throw new Error(error.message);
  return data;
}
// Map of contact id -> { lastEmailedAt, timesEmailed } for contacts that have received a real email.
export async function fetchContactActivity() {
  const { data, error } = await supabase.rpc("admin_contacts_last_emailed");
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r) => [r.contact_id, { lastEmailedAt: r.last_emailed_at, timesEmailed: r.times_emailed }]));
}

// ---- unsubscribes ----
export const fetchSuppressions = () => unwrap(supabase.from("comm_suppressions").select("*").order("created_at", { ascending: false }).order("email"));
export async function addSuppression(email, reason = "manual", note = null) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const address = email.trim().toLowerCase();
  await unwrap(supabase.from("comm_suppressions").upsert({ email: address, reason, note, created_by: user.id }, { onConflict: "email" }));
  await unwrap(supabase.from("mailing_list_contacts").update({ subscribed: false }).eq("email", address));
}
// Removing someone from the list lets them be emailed again. The page asks first.
export async function removeSuppression(email) {
  await unwrap(supabase.from("comm_suppressions").delete().eq("email", email));
  await unwrap(supabase.from("mailing_list_contacts").update({ subscribed: true }).eq("email", email));
}

// ---- automatic emails ----
export const fetchAutoEmailSettings = async () => new Map((await unwrap(supabase.from("auto_email_settings").select("*"))).map((r) => [r.key, r]));
export async function saveAutoEmailSetting({ key, enabled, subject, body }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await unwrap(
    supabase
      .from("auto_email_settings")
      .upsert({ key, enabled, subject: subject ?? null, body: body ?? null, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key" })
  );
}

// ---- sender presets: who an email says it is from, and where replies go ----
export const fetchSenderPresets = () => unwrap(supabase.from("comm_sender_presets").select("*").order("name"));
export async function saveSenderPreset({ name, fromName, replyTo, isDefault }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (isDefault) await unwrap(supabase.from("comm_sender_presets").update({ is_default: false }).eq("is_default", true));
  await unwrap(supabase.from("comm_sender_presets").insert({ name: name.trim(), from_name: fromName.trim(), reply_to: replyTo?.trim() || null, is_default: Boolean(isDefault), created_by: user.id }));
}
export async function setDefaultSenderPreset(id) {
  await unwrap(supabase.from("comm_sender_presets").update({ is_default: false }).eq("is_default", true));
  if (id) await unwrap(supabase.from("comm_sender_presets").update({ is_default: true }).eq("id", id));
}
export const deleteSenderPreset = (id) => unwrap(supabase.from("comm_sender_presets").delete().eq("id", id));
