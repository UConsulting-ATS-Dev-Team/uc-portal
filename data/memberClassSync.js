import { supabase } from "./supabaseClient.js";

// Graduation year and admit class ("Winter 2026") for signed-up members and alumni, keyed by lowercase email so a directory row can
// be matched to its account. Two different things: the admit class is when they joined UC, the year is when they graduate.
export async function fetchMemberClassInfo() {
  const byEmail = new Map();
  const { data, error } = await supabase.rpc("list_member_class_info");
  if (error || !data) return byEmail;
  for (const row of data) if (row.email) byEmail.set(row.email.toLowerCase(), { classYear: row.class_year, admitClass: row.admit_class });
  return byEmail;
}
