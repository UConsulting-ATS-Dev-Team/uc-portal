// Tells the admin pages which delivery providers are connected, so Send buttons stay off (and say why) until credentials exist,
// and fetches Slack's channel list for the Slack tab. Never returns a secret, only whether one is set.

import { requireAdmin } from "../_shared/requireAdmin.ts";
import { listSlackChannels, providerStatus, slackConfigured } from "../_shared/comms/providers.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  let withChannels = false;
  try {
    withChannels = Boolean((await req.json())?.slackChannels);
  } catch {
    // no body: just the status
  }
  const status = providerStatus();
  return jsonResponse({ ...status, slackChannels: withChannels && slackConfigured() ? await listSlackChannels() : [] });
});
