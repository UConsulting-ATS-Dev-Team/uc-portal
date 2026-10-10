import { supabase } from "./supabaseClient.js";

// Extra sign-in emails for the signed-in account (its main email is the one it was created with). See the
// account_emails migration: the database refuses an email another account uses or a directory person is waiting to use.
export async function fetchAccountEmails() {
  const { data, error } = await supabase.from("account_emails").select("email, created_at").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addAccountEmail(email) {
  const { error } = await supabase.rpc("add_account_email", { p_email: email });
  if (error) throw new Error(error.message);
}

export async function removeAccountEmail(email) {
  const { error } = await supabase.rpc("remove_account_email", { p_email: email });
  if (error) throw new Error(error.message);
}

// The account's main email when `email` is one of its extra emails, else null. Used before signing in or resetting a password.
export async function resolveLoginEmail(email) {
  const { data } = await supabase.rpc("resolve_login_email", { p_email: email });
  return data ?? null;
}
