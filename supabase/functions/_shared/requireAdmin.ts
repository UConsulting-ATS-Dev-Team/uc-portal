import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// Shared between approve-submission and resolve-duplicate-candidate -- both
// are admin-only actions that must re-derive the caller's role server-side
// rather than trust the client (the client-side admin gate on a button is a
// UX nicety, not the actual security boundary; RLS alone can't cover this
// since both functions need service_role to write tables non-admins have no
// access to at all).
export interface AdminContext {
  user: { id: string; [key: string]: unknown };
  adminClient: SupabaseClient;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
}

// Returns the caller context on success, or a Response to return immediately
// on failure -- callers check `if (result instanceof Response) return result;`.
export async function requireAdmin(req: Request): Promise<AdminContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError("Missing Authorization header", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identifies the caller under their own JWT (respects RLS) -- used only to
  // establish who's calling, never to write anything.
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) return jsonError("Not authenticated", 401);

  // Every actual read/write a caller does after this bypasses RLS by
  // design -- the access decision is this admin check, made explicitly
  // here, not delegated to a policy.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile, error: profileError } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
  if (profileError || profile?.role !== "admin") return jsonError("Admin access required", 403);

  return { user, adminClient };
}
