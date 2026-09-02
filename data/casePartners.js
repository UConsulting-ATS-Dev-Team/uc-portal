import { supabase } from "./supabaseClient.js";

// Case-practice partner matching (moves the club's real "Case Partners"
// Google Sheet tab into the app -- see the migration
// 20260902140000_case_partner_matching.sql's own header comment for the
// full design writeup and why this deliberately does NOT go through
// data/store.jsx's local-first/background-sync pattern the way saved
// jobs/coffee chats do: those are fundamentally single-player state (your
// own status label), while a case-partner request has to be visible to
// the OTHER member's own session, so Postgres has to be the source of
// truth here, not localStorage-with-eventual-sync. Every function below
// talks to Supabase directly and is awaited by its caller.
//
// CRITICAL constraint this whole module exists to enforce (not just
// describe): nobody is ever paired automatically. Two explicit actions --
// opting into the pool, then one member's own accept -- are required
// before a "match" exists, and that's structurally enforced by
// case_partner_requests' RLS policies (see the migration), not just by
// this module choosing to call things in a particular order.

async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

// Whether the signed-in member has opted into the pool -- gates whether
// Career Resources shows "Join the pool" or the browse/request UI.
export async function fetchMyPoolStatus() {
  const session = await getSession();
  if (!session) return { signedIn: false, optedIn: false };
  const { data, error } = await supabase.from("case_partner_pool").select("member_id").eq("member_id", session.user.id).maybeSingle();
  if (error) throw new Error(`Checking case partner pool status failed: ${error.message}`);
  return { signedIn: true, optedIn: Boolean(data) };
}

// Own, explicit opt-in -- the first of the two required actions.
export async function joinCasePartnerPool() {
  const session = await getSession();
  if (!session) return;
  const { error } = await supabase.from("case_partner_pool").insert({ member_id: session.user.id });
  if (error) throw new Error(`Joining the case partner pool failed: ${error.message}`);
}

// Opting out doesn't cancel existing requests/matches -- those live in
// case_partner_requests independently -- it only removes the member from
// future browsing/candidate lists.
export async function leaveCasePartnerPool() {
  const session = await getSession();
  if (!session) return;
  const { error } = await supabase.from("case_partner_pool").delete().eq("member_id", session.user.id);
  if (error) throw new Error(`Leaving the case partner pool failed: ${error.message}`);
}

// Other opted-in members, with the real matching signal
// (industries/roles/recruitingCycle straight off member_preferences, per
// CLAUDE.md's odds-model "traceable, not invented" principle) --
// case_partner_candidates() (security definer) does the join server-side
// since member_preferences itself is locked to each member's own row.
export async function fetchCandidates() {
  const { data, error } = await supabase.rpc("case_partner_candidates");
  if (error) throw new Error(`Loading case partner candidates failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    memberId: row.member_id,
    displayName: row.display_name,
    classYear: row.class_year,
    industries: row.industries ?? [],
    roles: row.roles ?? [],
    recruitingCycle: row.recruiting_cycle,
    optedInAt: row.opted_in_at,
  }));
}

// Sending a request is the ONLY way a case_partner_requests row is
// created, and the table's own insert policy forces it to start
// 'pending' -- see the migration. Upserts on the (requester,recipient)
// unique pair so re-requesting after a decline/cancel revives the same
// row instead of erroring on the unique index.
export async function sendRequest(recipientId, note) {
  const session = await getSession();
  if (!session) throw new Error("Sign in to send a case partner request.");
  const { error } = await supabase.from("case_partner_requests").upsert(
    {
      requester_id: session.user.id,
      recipient_id: recipientId,
      status: "pending",
      note: note || null,
      responded_at: null,
    },
    { onConflict: "requester_id,recipient_id" }
  );
  if (error) throw new Error(`Sending the case partner request failed: ${error.message}`);
}

// Every request involving the signed-in member, either direction -- RLS
// (case_partner_requests_select_involved) already scopes this to exactly
// those rows, so no extra filter is needed beyond fetching everything the
// policy allows.
export async function fetchMyRequests() {
  const session = await getSession();
  if (!session) return { sent: [], received: [] };
  const { data, error } = await supabase
    .from("case_partner_requests")
    .select("*")
    .or(`requester_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Loading your case partner requests failed: ${error.message}`);
  const rows = data ?? [];
  const sent = rows.filter((r) => r.requester_id === session.user.id);
  const received = rows.filter((r) => r.recipient_id === session.user.id);
  return { sent, received, myId: session.user.id };
}

// Resolves display names for a set of member ids -- used to label request
// rows, since case_partner_requests itself only stores ids. Scoped
// server-side (case_partner_display_names) to ids that are either still
// in the pool or already in a request relationship with the caller.
export async function resolveDisplayNames(memberIds) {
  const ids = [...new Set(memberIds)].filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc("case_partner_display_names", { member_ids: ids });
  if (error) throw new Error(`Resolving case partner names failed: ${error.message}`);
  const map = {};
  for (const row of data ?? []) map[row.member_id] = row.display_name;
  return map;
}

// The recipient's own, separate action -- the second of the two required
// actions, and the only path (per the migration's update policy) that can
// ever move a request to 'accepted'.
export async function respondToRequest(requestId, accept) {
  const { error } = await supabase
    .from("case_partner_requests")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw new Error(`Responding to the case partner request failed: ${error.message}`);
}

// The requester withdrawing their own still-pending request -- the only
// update a requester's RLS policy allows.
export async function cancelRequest(requestId) {
  const { error } = await supabase.from("case_partner_requests").update({ status: "cancelled" }).eq("id", requestId);
  if (error) throw new Error(`Cancelling the case partner request failed: ${error.message}`);
}
