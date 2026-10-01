import { supabase } from "./supabaseClient.js";

// Closes a real gap found while setting up pre-provisioned exec accounts
// for the final presentation: "Forgot your password?" (SignIn.jsx) was
// the ONLY path to ever set a password, for anyone -- no way to change
// one while already signed in. supabase.auth.updateUser() needs no
// re-entry of the current password (the existing session already proves
// identity), same as every other Supabase-managed auth flow in this app.
export async function changePassword(newPassword) {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
