// Account actions that need the service role: adding a person, and deactivating or reactivating an account. Everything else about
// a person (name, class year, phone, role, membership) is an ordinary profile update an admin's own session is allowed to make.
//
//   create       Adds the person to the right allowlist (roster / intern roster / alumni directory) and creates their account with
//                no email sent. They claim it with "Forgot your password?", like every pre-created account.
//   deactivate   Marks the profile deactivated AND disables the sign-in (a long ban), so the account can't get a new session.
//   reactivate   Reverses both.
//
// Same rules as the other admin functions: re-checks the caller is an admin here, never trusting the page. An admin can't
// deactivate themselves, and the last active admin can't be deactivated.

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

const BAN_FOREVER = "876000h"; // about 100 years: GoTrue has no "ban until reactivated", only a duration

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;
  const { adminClient, user } = ctx;

  let input: { action?: string; memberId?: string; email?: string; name?: string; classYear?: number | null; memberStatus?: string; role?: string };
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "Send a JSON body." }, 400);
  }

  if (input.action === "create") {
    const email = (input.email ?? "").trim().toLowerCase();
    const name = (input.name ?? "").trim();
    const status = input.memberStatus ?? "current_member";
    const role = input.role === "admin" ? "admin" : "member";
    if (!email.includes("@")) return jsonResponse({ error: "Enter a valid email address." }, 400);
    if (!["current_member", "alumni", "intern"].includes(status)) return jsonResponse({ error: "Choose current member, alumni or intern." }, 400);
    if (role === "admin" && status !== "current_member") return jsonResponse({ error: "Only a current member can be made an admin." }, 400);
    const classYear = input.classYear ? Number(input.classYear) : null;

    // The allowlist row has to exist first: the sign-up trigger checks it, and decides the membership type from it.
    if (status === "current_member") {
      const { error } = await adminClient.from("roster").upsert({ email, name: name || null, class_year: classYear, added_by: user.id }, { onConflict: "email" });
      if (error) return jsonResponse({ error: error.message }, 500);
    } else if (status === "intern") {
      const { error } = await adminClient.from("intern_roster").upsert({ email, name: name || null, added_by: user.id }, { onConflict: "email" });
      if (error) return jsonResponse({ error: error.message }, 500);
    } else {
      const { data: existing } = await adminClient.from("people").select("id").eq("status", "Alumni").ilike("email", email).maybeSingle();
      if (!existing) {
        const slug = `${(name || email.split("@")[0]).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 6)}`;
        const { error } = await adminClient.from("people").insert({ slug, name: name || email.split("@")[0], status: "Alumni", class_year: classYear, email });
        if (error) return jsonResponse({ error: error.message }, 500);
      }
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password: randomPassword(), email_confirm: true });
    if (createError) {
      const exists = /already.*registered|already.*exists/i.test(createError.message);
      return jsonResponse({ error: exists ? "That email already has an account." : createError.message }, exists ? 409 : 500);
    }
    const id = created.user!.id;
    const update: Record<string, unknown> = {};
    if (name) update.full_name = name;
    if (classYear) update.class_year = classYear;
    if (role === "admin") update.role = "admin";
    if (Object.keys(update).length > 0) await adminClient.from("profiles").update(update).eq("id", id);
    return jsonResponse({ memberId: id });
  }

  if (input.action === "deactivate" || input.action === "reactivate") {
    const memberId = input.memberId ?? "";
    if (!memberId) return jsonResponse({ error: "Say which account." }, 400);
    if (input.action === "deactivate") {
      if (memberId === user.id) return jsonResponse({ error: "You can't deactivate your own account." }, 400);
      const { data: target } = await adminClient.from("profiles").select("role, deactivated_at").eq("id", memberId).single();
      if (target?.role === "admin") {
        const { count } = await adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").is("deactivated_at", null);
        if ((count ?? 0) <= 1) return jsonResponse({ error: "That's the last active admin." }, 400);
      }
    }
    const deactivating = input.action === "deactivate";
    const { error: banError } = await adminClient.auth.admin.updateUserById(memberId, { ban_duration: deactivating ? BAN_FOREVER : "none" });
    if (banError) return jsonResponse({ error: banError.message }, 500);
    const { error } = await adminClient
      .from("profiles")
      .update({ deactivated_at: deactivating ? new Date().toISOString() : null, deactivated_by: deactivating ? user.id : null })
      .eq("id", memberId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Unknown action." }, 400);
});
