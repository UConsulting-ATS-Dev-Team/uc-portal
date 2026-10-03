import { supabase } from "./supabaseClient.js";

// Admin tooling for pre-created accounts: list the ones nobody has claimed
// yet and pre-create accounts for a directory audience. The app never emails
// anyone about these accounts -- people claim one on their own with
// "Forgot your password?", or an admin tells them directly (inviteMessage()).
// See supabase/functions/pre-provision-accounts.

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

export function inviteMessage() {
  return `Hi! UConsulting now has a members-and-alumni portal at ${window.location.origin} -- jobs, an alumni directory, and messaging.\n\nI've already created an account for you. To claim it: go to ${window.location.origin}/sign-in, click "Forgot your password?", enter this email address, and follow the link in the email to set a password.`;
}
