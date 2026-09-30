// Real self-service account deletion -- direct ask, given real member
// data now sits behind a public repo. Deliberately an Edge Function, not
// a client-side call -- auth.admin.deleteUser() has no client-safe
// equivalent, and needs the service role regardless.
//
// Auth model: re-derives the caller's own id from their own JWT via
// requireAuthenticated (same shared helper score-submission-duplicate
// already uses) -- there is no "which account to delete" parameter in
// the request body at all, by design. This can only ever delete the
// account making the call; an admin cannot use this endpoint to delete
// someone else's account (that's a different, unbuilt feature, and a
// meaningfully different trust decision).
//
// What actually happens on deletion -- investigated every real FK
// before writing this (see 20260930150000_account_deletion_fk_cleanup.sql
// and CLAUDE.md's dated entry for the full transcript), not assumed:
//   - profiles, member_preferences, tracked_applications, saved_jobs,
//     network_connections, work_history, uc_projects,
//     accelerator_submissions, weekly_digests, case_partner_pool/
//     requests, feed_posts: cascade-delete automatically via their own
//     existing FKs. Real, but entirely the member's own data -- gone is
//     correct.
//   - feature_requests/opportunity_submissions/interview_writeups
//     submitted_by, and every admin-attribution column (reviewed_by,
//     graded_by, created_by, uploaded_by, added_by): FK now set to
//     ON DELETE SET NULL (was NO ACTION, which would have thrown a raw
//     foreign-key error for anyone who'd ever posted a job, requested a
//     feature, or shared a write-up). The real content stays -- a
//     feature idea or interview experience outlives the member who
//     shared it -- only the identity link is cleared. Confirmed both
//     feature_requests and interview_writeups already display from a
//     denormalized submitted_by_name snapshot, not a live join, so this
//     has zero visible effect on those; opportunity_submissions never
//     displays submitter identity at all.
//   - messages.sender_id/recipient_id: FK dropped entirely (not
//     cascaded, not nulled) -- data/messagesSync.js#fetchConversations()
//     already groups by the raw id before ever resolving a name, so
//     nulling would have broken that; the existing `?? "Former member"`
//     fallback (already in the codebase, not built for this) handles
//     display once list_messageable_members() naturally stops returning
//     a deleted account.
// Storage (avatars/resumes/accelerator-submissions): no SQL FK covers
// these at all -- explicitly listed and removed per bucket below, since
// an orphaned Storage object under a now-nonexistent user id would just
// sit there forever otherwise.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuthenticated } from "../_shared/requireAuthenticated.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const STORAGE_BUCKETS = ["avatars", "resumes", "accelerator-submissions"];

async function clearStorageFolder(adminClient: ReturnType<typeof createClient>, bucket: string, userId: string) {
  const { data: files, error } = await adminClient.storage.from(bucket).list(userId);
  if (error || !files || files.length === 0) return;
  const paths = files.map((f) => `${userId}/${f.name}`);
  await adminClient.storage.from(bucket).remove(paths);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const ctx = await requireAuthenticated(req);
  if (ctx instanceof Response) return ctx;
  const { user, adminClient } = ctx;

  // Lightweight extra confirmation beyond "the request is authenticated
  // at all" -- the real confirmation UX (typing a phrase, a confirm
  // dialog) lives client-side; this just guards against a stray/
  // accidental call to a destructive endpoint with no body at all.
  let confirmed = false;
  try {
    const body = await req.json();
    confirmed = body?.confirm === true;
  } catch {
    // no/invalid body -- confirmed stays false, falls through to the check below
  }
  if (!confirmed) return jsonResponse({ error: "Missing confirmation" }, 400);

  await Promise.all(STORAGE_BUCKETS.map((bucket) => clearStorageFolder(adminClient, bucket, user.id)));

  // Deletes the auth.users row -- everything documented above cascades,
  // nulls, or is simply left with a dangling (never FK-enforced) id from
  // this single call.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) return jsonResponse({ error: deleteError.message }, 500);

  return jsonResponse({ ok: true });
});
