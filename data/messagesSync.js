import { supabase } from "./supabaseClient.js";

// Real 1:1 messaging (see the real_messages migration for the full
// rationale -- accounts only, since the 207-row real people directory
// has no link to auth.users yet). Conversations aren't a separate stored
// entity -- derived client-side from the flat messages table, grouped by
// "the other participant," same "derive it from what's really there"
// approach data/timelineUtils.js/data/notificationUtils.js already use
// rather than maintaining a second table that could drift out of sync.

export async function listMessageableMembers() {
  const { data, error } = await supabase.rpc("list_messageable_members");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findMemberByEmail(email) {
  const { data, error } = await supabase.rpc("find_member_by_email", { lookup_email: email });
  if (error) throw new Error(error.message);
  return data ?? null;
}

// Real members who've turned on "Open to coffee chat requests from
// members" (MyProfile.jsx's Recruiting Settings tab -- already a real,
// synced setting; this is just the first cross-member read of it). Used
// by Home.jsx's "Meet X" nudge and Feed.jsx's "Alumni active this week"
// rail in place of the old mock PEOPLE fallback.
export async function listOpenToCoffeeChatMembers() {
  const { data, error } = await supabase.rpc("list_open_to_coffee_chat_members");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// One row per conversation: the other participant's id, their real
// display name (from members, the same list_messageable_members() result
// the "New" picker uses -- so a name is available even for a counterpart
// with zero messages sent, and consistent everywhere it's shown), the
// most recent message, how many of their messages to me are unread, and
// whether I've archived this thread (data/archived_conversations.js --
// own-row-only, so this is just a second small fetch, not a join).
export async function fetchConversations() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: rows, error }, members, archivedIds] = await Promise.all([
    supabase.from("messages").select("*").or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order("created_at", { ascending: true }),
    listMessageableMembers(),
    fetchArchivedCounterpartIds(),
  ]);
  if (error) throw new Error(error.message);

  const nameById = new Map(members.map((m) => [m.member_id, m.display_name]));
  const byCounterpart = new Map();
  for (const row of rows ?? []) {
    const counterpartId = row.sender_id === user.id ? row.recipient_id : row.sender_id;
    byCounterpart.set(counterpartId, row); // last one wins -- rows are ascending by created_at
  }

  return [...byCounterpart.entries()]
    .map(([counterpartId, lastMessage]) => ({
      counterpartId,
      counterpartName: nameById.get(counterpartId) ?? "Former member",
      lastMessage,
      unreadCount: (rows ?? []).filter((r) => r.sender_id === counterpartId && r.recipient_id === user.id && !r.read_at).length,
      archived: archivedIds.has(counterpartId),
    }))
    .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));
}

// Real per-viewer archiving -- a row's existence is the signal, same
// "derive it, don't duplicate-store a flag" approach as the rest of this
// file. Never deletes the underlying messages (the other participant's
// copy of the conversation is untouched); a new message from an archived
// counterpart un-archives automatically (see the migration's trigger).
export async function fetchArchivedCounterpartIds() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("archived_conversations").select("counterpart_id").eq("account_id", user.id);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.counterpart_id));
}

export async function archiveConversation(counterpartId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("archived_conversations").upsert({ account_id: user.id, counterpart_id: counterpartId });
  if (error) throw new Error(error.message);
}

export async function unarchiveConversation(counterpartId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("archived_conversations").delete().eq("account_id", user.id).eq("counterpart_id", counterpartId);
  if (error) throw new Error(error.message);
}

export async function fetchThread(counterpartId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},recipient_id.eq.${user.id})`)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function sendMessage(recipientId, body) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: user.id, recipient_id: recipientId, body })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function markThreadRead(counterpartId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("sender_id", counterpartId).eq("recipient_id", user.id).is("read_at", null);
}

export async function fetchUnreadCount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
