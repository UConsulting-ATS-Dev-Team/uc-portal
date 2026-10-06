// The page behind the "Unsubscribe" link in every bulk email. Public on purpose (it is opened from an inbox, so there is no login),
// so it trusts only a signed token: the address and an HMAC of it, issued when the message was sent. Deploy with --no-verify-jwt.
//
// GET  ?t=<token>   shows a confirmation page and records the unsubscribe.
// POST ?t=<token>   the one-click form mail clients use for the List-Unsubscribe header; same effect, no page needed.

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyUnsubscribeToken } from "../_shared/comms/unsubscribe.ts";
import { escapeHtml } from "../_shared/comms/render.ts";

function page(title: string, message: string, status = 200) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f2f2f3;font-family:Montserrat,Arial,sans-serif;color:#042742"><div style="max-width:480px;margin:64px auto;background:#fff;border:1px solid #d3d3d7;padding:32px">
<div style="font-weight:700;font-size:20px;border-bottom:3px solid #0C74C1;padding-bottom:12px;margin-bottom:20px"><span style="color:#0C74C1">U</span>Consulting</div>
<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="margin:0;line-height:1.6">${message}</p></div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  const secret = (Deno.env.get("COMMS_UNSUBSCRIBE_SECRET") ?? "").trim();
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!secret) return page("Unavailable", "This link can't be used right now.", 503);

  const email = await verifyUnsubscribeToken(token, secret);
  if (!email) return page("This link isn't valid", "It may have been copied incorrectly. Reply to the email you received and we'll take you off the list.", 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("comm_suppressions").upsert({ email, reason: "unsubscribed" }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return page("Something went wrong", "We couldn't record that just now. Please try the link again in a minute.", 500);
  await admin.from("mailing_list_contacts").update({ subscribed: false }).eq("email", email);

  if (req.method === "POST") return new Response("ok", { status: 200 });
  return page("You're unsubscribed", `${escapeHtml(email)} won't get messages like this from UConsulting anymore.`);
});
