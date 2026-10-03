// Admin-triggered "claim your account" emails for pre-created accounts
// (see pre-provision-accounts). Sends the same password-setup email a member
// would get from "Forgot your password?", so claiming an account and
// resetting a password are one flow -- no new token system.
//
// Safeguards:
//   * Admin only (requireAdmin, re-derived server-side).
//   * Only ever sends to an account that exists AND has never signed in
//     (unclaimed_account_emails(), service-role-only) -- so this can't be
//     used to mail active members, or arbitrary addresses.
//   * At most 40 addresses per call.
//   * Stops at the first rate-limit error and reports the remainder as
//     `notSent`: until custom SMTP is configured in Supabase, the built-in
//     mailer only allows a handful of emails per hour, so a big batch is
//     expected to be cut short, and the admin can run it again later.
//   * Records each successful send in claim_invites so the admin UI can show
//     who was already invited and when.

import { requireAdmin } from "../_shared/requireAdmin.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PER_CALL = 40;
const DELAY_MS = 1100;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;
  const { adminClient, user } = ctx;

  let body: { emails?: unknown; redirectTo?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Expected a JSON body" }, 400);
  }
  if (!Array.isArray(body.emails) || body.emails.length === 0) return jsonResponse({ error: "emails is required" }, 400);
  if (typeof body.redirectTo !== "string" || !body.redirectTo.startsWith("http")) return jsonResponse({ error: "redirectTo is required" }, 400);

  const requested = [...new Set((body.emails as unknown[]).map((e) => String(e ?? "").trim().toLowerCase()).filter(Boolean))].slice(0, MAX_PER_CALL);

  const { data: eligibleRows, error: eligibleError } = await adminClient.rpc("unclaimed_account_emails", { p_emails: requested });
  if (eligibleError) return jsonResponse({ error: eligibleError.message }, 500);
  const eligible = new Set((eligibleRows ?? []).map((r: { email: string }) => r.email.toLowerCase()));

  const sent: string[] = [];
  const skipped: string[] = [];
  const notSent: string[] = [];
  const errors: { email: string; message: string }[] = [];
  let rateLimited = false;

  for (const email of requested) {
    if (!eligible.has(email)) {
      skipped.push(email); // no account, or already claimed
      continue;
    }
    if (rateLimited) {
      notSent.push(email);
      continue;
    }

    const { error } = await adminClient.auth.resetPasswordForEmail(email, { redirectTo: body.redirectTo });
    if (error) {
      if (/rate limit|too many|over_email_send_rate_limit/i.test(`${error.message} ${(error as { code?: string }).code ?? ""}`)) {
        rateLimited = true;
        notSent.push(email);
      } else {
        errors.push({ email, message: error.message });
      }
      continue;
    }

    sent.push(email);
    const { data: existing } = await adminClient.from("claim_invites").select("send_count").eq("email", email).maybeSingle();
    await adminClient.from("claim_invites").upsert({
      email,
      last_sent_at: new Date().toISOString(),
      send_count: (existing?.send_count ?? 0) + 1,
      last_sent_by: user.id,
    });
    await sleep(DELAY_MS);
  }

  return jsonResponse({ sent, skipped, notSent, errors, rateLimited, capped: Array.isArray(body.emails) && body.emails.length > MAX_PER_CALL });
});
