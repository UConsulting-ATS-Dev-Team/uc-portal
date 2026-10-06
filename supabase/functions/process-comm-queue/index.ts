// Runs every minute (pg_cron): releases scheduled messages that are due and delivers whatever is queued. Does nothing for a
// channel whose provider has no credentials yet, so it is safe to leave scheduled before email is connected.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCronSecret } from "../_shared/requireCronSecret.ts";
import { claimRunOrSkip } from "../_shared/dedupeRun.ts";
import { processQueue } from "../_shared/comms/queue.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // pg_net can deliver one cron call twice; claimRunOrSkip suppresses the duplicate within the same minute.
  if (!(await claimRunOrSkip(admin, "comms:queue"))) return jsonResponse({ skipped: true, reason: "duplicate invocation suppressed" });

  return jsonResponse(await processQueue(admin, { budgetMs: 100_000 }));
});
