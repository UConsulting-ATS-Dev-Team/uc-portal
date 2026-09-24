// Fronts what used to be a direct client-side `.insert()` into
// access_requests from SignIn.jsx -- the anonymous-insert RLS policy that
// used to allow that is dropped (see this migration's sibling,
// 20260925010000_access_request_rate_limit.sql), so this Edge Function
// (running as the service role) is now the only path in. Real, not
// theoretical: adds IP-based rate limiting the previous direct-insert path
// had no way to enforce at all (Postgres RLS has no reliable access to the
// caller's real IP without a fronting function; PostgREST's own
// request.header.* GUCs aren't configured for this project and wiring them
// up is a bigger, separate change than this gap justifies). Genuinely
// anonymous by design -- this must work for someone who has never signed
// in, so it takes no Authorization header and re-derives nothing about who
// the caller is beyond their IP.
//
// access_requests_one_pending_per_email (20260914030000_rls_gap_fixes.sql)
// still does its own job unchanged -- this only adds the IP axis, not a
// replacement for the email-duplicate guard.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// 5 attempts per 10 minutes per IP -- generous enough that a real person
// retrying a typo'd email a couple of times never hits it, tight enough to
// blunt a scripted burst of fake requests. Every attempt counts toward the
// limit regardless of outcome (including a duplicate-pending rejection),
// since counting only successes would let a bad actor probe the limit for
// free by intentionally colliding with the email-uniqueness guard.
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let email: string;
  let name: string | null;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim() : "";
    name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : null;
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }
  if (!email) return jsonResponse({ error: "Email is required" }, 400);

  // x-forwarded-for can carry a comma-separated chain (client, then any
  // intermediate proxies) -- the first entry is the original client.
  // Supabase's own edge network sets this; falls back to a shared bucket
  // if it's ever absent rather than failing open with no limit at all.
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count, error: countError } = await adminClient
    .from("access_request_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if (countError) return jsonResponse({ error: countError.message }, 500);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    // Still log the attempt that got rejected -- keeps the window sliding
    // forward under sustained abuse instead of resetting to 0.
    await adminClient.from("access_request_attempts").insert({ ip });
    return jsonResponse({ error: "Too many requests -- please try again in a few minutes." }, 429);
  }

  await adminClient.from("access_request_attempts").insert({ ip });

  const { error: insertError } = await adminClient.from("access_requests").insert({ email, name });
  if (insertError) {
    // 23505 = access_requests_one_pending_per_email fired -- same
    // friendly-message translation SignIn.jsx already did when this was a
    // direct client insert.
    if (insertError.code === "23505") {
      return jsonResponse({ error: "You already have a pending request in with Exec -- no need to submit another.", code: "23505" }, 409);
    }
    return jsonResponse({ error: insertError.message }, 500);
  }

  return jsonResponse({ ok: true });
});
