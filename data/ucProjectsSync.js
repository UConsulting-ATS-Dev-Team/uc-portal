import { supabase } from "./supabaseClient.js";

// Real self-reported UC project history -- see the uc_projects migration's
// own header comment for why this exists (long-term institutional
// tracking, direct ask from the original MVP notes). Same shape as
// data/workHistorySync.js.

export const UC_PROJECT_CATEGORIES = ["Case competition", "Pro-bono consulting", "Client project", "Committee project", "Other"];

export async function fetchOwnProjects() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from("uc_projects")
    .select("*")
    .eq("profile_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addProjectEntry({ title, category, organization, semester, description }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  const { data, error } = await supabase
    .from("uc_projects")
    .insert({
      profile_id: session.user.id,
      title: title.trim(),
      category: category || "Other",
      organization: organization?.trim() || null,
      semester: semester?.trim() || null,
      description: description?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProjectEntry(id, { title, category, organization, semester, description }) {
  const { error } = await supabase
    .from("uc_projects")
    .update({
      title: title.trim(),
      category: category || "Other",
      organization: organization?.trim() || null,
      semester: semester?.trim() || null,
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeProjectEntry(id) {
  const { error } = await supabase.from("uc_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
