// Direct ask, from the original MVP notes ("create logins using existing
// info"): pre-create real auth accounts for roster members who haven't
// signed up yet, so their first real interaction is "confirm your info
// and set a password" instead of a full signup from scratch.
//
// Deliberately does NOT pre-fill profiles.majors/linkedin/full_name/etc
// itself -- data/directoryPrefillSync.js already does exactly that, for
// ANY account, the moment it first signs in (matched by email against the
// same `people` Directory table, "fill only if still empty"). This
// function's only real job is making the auth.users row exist before that
// first sign-in ever happens; everything downstream (member_status
// classification via handle_new_user(), the Directory prefill, avatar
// fallback display) already works unmodified for an admin-created account
// exactly the same as a self-signed-up one.
//
// Deliberately does NOT send any invite/notification email -- createUser()
// with email_confirm: true creates a real, usable account with no email
// sent at all. A member claims it through the real "Forgot your password?"
// flow (SignIn.jsx), which is the actual point where an email would send --
// left for a separate, explicit admin action once real SMTP exists (see
// CLAUDE.md's "held on Gavin's SES setup" note), not bundled into this
// bulk-create step. The random password generated here is never returned
// to the caller or used by anyone -- it only exists because createUser()
// requires some password value, and gets invalidated the moment a member
// claims the account for real.
//
// Auth model: same requireAdmin() pattern as approve-submission/
// resolve-duplicate-candidate -- re-derives the caller's admin status
// server-side rather than trusting the client, since this needs the
// service role (auth.admin.createUser has no client-safe equivalent).
//
// Accepts an optional { emails: [...] } body to scope this to a specific
// subset instead of the full roster (falls back to full roster when
// omitted, which is what Admin Dashboard's real button does) -- this is
// also the only way to actually test this function at all without
// creating real accounts for real, not-yet-signed-up club members as a
// side effect of testing.

import { requireAdmin } from "../_shared/requireAdmin.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;
  const { adminClient } = ctx;

  // Optional { emails: [...] } body scopes this to a specific subset
  // (e.g. re-running for one late addition to roster) instead of the
  // full roster -- also what makes this function safely testable at all
  // without touching real members' accounts for real.
  let requestedEmails: string[] | null = null;
  try {
    const body = await req.json();
    if (Array.isArray(body?.emails)) requestedEmails = body.emails;
  } catch {
    // No body / not JSON -- fine, falls through to the full-roster default.
  }

  let emails: string[];
  if (requestedEmails) {
    emails = requestedEmails;
  } else {
    const { data: rosterRows, error: rosterError } = await adminClient.from("roster").select("email");
    if (rosterError) return jsonResponse({ error: rosterError.message }, 500);
    emails = (rosterRows ?? []).map((r) => r.email as string);
  }

  const created: string[] = [];
  const alreadyExists: string[] = [];
  const errors: { email: string; message: string }[] = [];

  for (const email of emails) {
    const { error } = await adminClient.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
    });
    if (!error) {
      created.push(email);
    } else if (/already.*registered|already.*exists/i.test(error.message)) {
      alreadyExists.push(email);
    } else {
      errors.push({ email, message: error.message });
    }
  }

  return jsonResponse({ created, alreadyExists, errors, createdCount: created.length });
});
