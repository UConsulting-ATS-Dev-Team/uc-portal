import { supabase } from "./supabaseClient.js";

// Account management for admins (the Members page). Reads come from one admin-only database function that joins everything a
// card needs; ordinary edits are profile updates an admin's own session may make (profiles_update_admin); anything that needs the
// service role (creating an account, deactivating or reactivating one) goes through the admin-user-management Edge Function,
// which re-checks that the caller is an admin.

export async function fetchAccounts() {
  const { data, error } = await supabase.rpc("admin_list_accounts");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// name, classYear, phone, memberStatus and role are all plain profile columns.
export async function updateAccount(memberId, { name, classYear, phone, memberStatus, role }) {
  const patch = {};
  if (name !== undefined) patch.full_name = name?.trim() || null;
  if (classYear !== undefined) patch.class_year = classYear ? Number(classYear) : null;
  if (phone !== undefined) patch.phone = phone?.trim() || null;
  if (memberStatus !== undefined) patch.member_status = memberStatus;
  if (role !== undefined) patch.role = role;
  const { error } = await supabase.from("profiles").update(patch).eq("id", memberId);
  if (error) throw new Error(error.message);
}

async function manage(body) {
  const { data, error } = await supabase.functions.invoke("admin-user-management", { body });
  if (error) {
    // supabase-js hides the function's own message behind a generic one; the real reason is in the response body.
    let message = error.message;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const createAccount = ({ email, name, classYear, memberStatus, role }) => manage({ action: "create", email, name, classYear, memberStatus, role });
export const deactivateAccount = (memberId) => manage({ action: "deactivate", memberId });
export const reactivateAccount = (memberId) => manage({ action: "reactivate", memberId });
