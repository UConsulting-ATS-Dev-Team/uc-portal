import { supabase } from "./supabaseClient.js";

// Active intern accounts, for other members to find. Interns are not in the alumni/member directory (`people`), so this is the
// only place a member can see one. Shaped like a directory person so the Network cards and the profile page can show it, with the
// account id as the person id (it is a UUID, so the profile route accepts it). No email address is ever exposed.
function internToCardShape(row) {
  return {
    id: row.member_id,
    isReal: true,
    isIntern: true,
    name: row.name,
    status: "Intern",
    classYear: row.class_year,
    admitClass: row.admit_class,
    major: row.majors,
    linkedin: row.linkedin,
    avatarUrl: row.avatar_url,
    email: null,
    openToCoffeeChats: false,
    mutualConnections: 0,
  };
}

export async function fetchInternDirectory() {
  const { data, error } = await supabase.rpc("list_intern_directory");
  if (error || !data) return [];
  return data.map(internToCardShape);
}

export async function fetchInternById(id) {
  const interns = await fetchInternDirectory();
  return interns.find((p) => p.id === id) ?? null;
}
