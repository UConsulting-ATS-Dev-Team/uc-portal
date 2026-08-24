import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Same shape as requireAdmin.ts, minus the admin-role gate -- for functions
// any signed-in member may call (score-submission-duplicate), not just
// admins. Ownership/permission checks specific to the resource being acted
// on (e.g. "this submission belongs to this caller") still belong in the
// calling function, same as requireAdmin's own callers re-derive their
// authorization rather than trusting the client.
export interface AuthContext {
  user: { id: string; [key: string]: unknown };
  adminClient: SupabaseClient;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
}

export async function requireAuthenticated(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError("Missing Authorization header", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) return jsonError("Not authenticated", 401);

  // service_role client for everything after this -- the caller is
  // identified, but writes still need to bypass RLS the same way
  // requireAdmin's callers do (e.g. writing duplicate_tier onto a
  // submission row isn't something opportunity_submissions' own RLS grants
  // a non-admin member, even for their own row).
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  return { user, adminClient };
}
