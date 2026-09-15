import { supabase } from "./supabaseClient.js";

// Real self-reported work history -- see the work_history migration's own
// header comment for why this exists (the legitimate alternative to
// automated LinkedIn lookup, which this app never does).

export async function fetchOwnWorkHistory() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from("work_history")
    .select("*")
    .eq("profile_id", session.user.id)
    .order("end_year", { ascending: false, nullsFirst: true })
    .order("start_year", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addWorkHistoryEntry({ company, role, startYear, endYear }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  const { data, error } = await supabase
    .from("work_history")
    .insert({
      profile_id: session.user.id,
      company: company.trim(),
      role: role?.trim() || null,
      start_year: startYear || null,
      end_year: endYear || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateWorkHistoryEntry(id, { company, role, startYear, endYear }) {
  const { error } = await supabase
    .from("work_history")
    .update({
      company: company.trim(),
      role: role?.trim() || null,
      start_year: startYear || null,
      end_year: endYear || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeWorkHistoryEntry(id) {
  const { error } = await supabase.from("work_history").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// The real incentive payoff shown back to whoever just added an entry --
// "N members are interested in [Company]," computed from real
// member_preferences.followed_companies data via a security-definer RPC
// (never exposes who, just a count).
export async function fetchCompanyInterestCount(company) {
  const { data, error } = await supabase.rpc("company_interest_count", { target_company: company });
  if (error) return 0;
  return data ?? 0;
}

// Real "who's worked here" for Job Detail / Company Page -- resolved
// display names via list_work_history_at_company(), same identity-
// resolution pattern this app already uses everywhere else.
export async function fetchWorkHistoryAtCompany(company) {
  const { data, error } = await supabase.rpc("list_work_history_at_company", { target_company: company });
  if (error) return [];
  return data ?? [];
}
