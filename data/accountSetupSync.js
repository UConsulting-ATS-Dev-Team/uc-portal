import { supabase } from "./supabaseClient.js";

// Admin tooling for pre-created accounts: list the ones nobody has claimed
// yet, pre-create accounts for a directory audience, and send claim emails.
// See supabase/functions/pre-provision-accounts and send-claim-emails.

export async function listUnclaimedAccounts() {
  const { data, error } = await supabase.rpc("list_unclaimed_accounts");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// audience: "roster" (current members) | "alumni" | "all"
export async function preProvisionAccounts(audience) {
  const { data, error } = await supabase.functions.invoke("pre-provision-accounts", { method: "POST", body: { audience } });
  if (error) throw new Error(error.message);
  return data;
}

// Sends in batches the function accepts (40 max), stopping as soon as the
// email service rate-limits. Returns combined totals so the UI can say
// exactly what happened.
export async function sendClaimEmails(emails, onProgress) {
  const BATCH = 25;
  const totals = { sent: 0, skipped: 0, notSent: 0, errors: [], rateLimited: false };
  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    const { data, error } = await supabase.functions.invoke("send-claim-emails", {
      method: "POST",
      body: { emails: batch, redirectTo: `${window.location.origin}/reset-password` },
    });
    if (error) throw new Error(error.message);
    totals.sent += data.sent.length;
    totals.skipped += data.skipped.length;
    totals.notSent += data.notSent.length;
    totals.errors.push(...data.errors);
    if (onProgress) onProgress({ ...totals, done: Math.min(i + BATCH, emails.length), total: emails.length });
    if (data.rateLimited) {
      totals.rateLimited = true;
      totals.notSent += Math.max(0, emails.length - (i + BATCH)); // everything not yet attempted
      break;
    }
  }
  return totals;
}

export function inviteMessage() {
  return `Hi! UConsulting now has a members-and-alumni portal at ${window.location.origin} -- jobs, an alumni directory, and messaging.\n\nI've already created an account for you. To claim it: go to ${window.location.origin}/sign-in, click "Forgot your password?", enter this email address, and follow the link in the email to set a password.`;
}
