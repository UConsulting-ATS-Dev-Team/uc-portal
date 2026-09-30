// Shared by every scheduled Edge Function (fetch-greenhouse-companies,
// fetch-deloitte-jobs, check-job-links, fetch-lever-companies,
// snapshot-job-board, weekly-digest) -- closes a real gap found and
// documented 2026-09-28: verify_jwt: true alone only requires *some*
// validly-signed Supabase JWT, and the public anon key (shipped in every
// page load) satisfies that. Nothing previously distinguished the real
// daily pg_cron invocation from anyone who extracted the anon key and
// called the function URL directly, at any frequency -- a real,
// evidenced risk given check-job-links' own documented history of a
// false-positive burst from over-invocation.
//
// Deliberately a dedicated secret, not the service-role key -- putting
// the actual master key in the cron schedule SQL (necessarily committed
// to git, since that's how this project's cron jobs are defined) would
// be strictly worse than the gap this closes. The cron schedule
// references this secret by name via vault.decrypted_secrets, never the
// plaintext value -- see the (deliberately never-committed) migration
// that wrote it into Vault, same one-time-secret convention this
// project already uses for every other real credential.
export function requireCronSecret(req: Request): Response | null {
  const provided = req.headers.get("X-Cron-Secret");
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    // Misconfiguration, not a caller problem -- fail closed rather than
    // silently accepting every caller if the secret was never set.
    return new Response(JSON.stringify({ error: "Server misconfigured: CRON_SECRET not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
