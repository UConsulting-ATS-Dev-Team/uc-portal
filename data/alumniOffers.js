import { supabase } from "./supabaseClient.js";

// What an alumnus offers to members ("happy to help with", how available they are), in their own words. One row per alumni
// account (alumni_offers), written only by that person; members read it on the person's profile page through
// alumni_offer_for_email(). Nothing is generated: no row means nothing is shown.

export const HELP_TOPICS = [
  "Resume reviews",
  "Mock interviews",
  "Case practice",
  "Career path advice",
  "Recruiting at my firm",
  "Industry advice",
  "Grad school advice",
  "Switching careers",
];

export const AVAILABILITY_OPTIONS = [
  "A few coffee chats a month",
  "About one coffee chat a month",
  "Occasionally, by request",
  "Not available right now",
];

export async function fetchOwnAlumniOffer() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase.from("alumni_offers").select("help_topics, availability").eq("member_id", session.user.id).maybeSingle();
  if (!data) return null;
  return { helpTopics: data.help_topics ?? [], availability: data.availability ?? "" };
}

export async function saveOwnAlumniOffer({ helpTopics, availability }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in again to save this.");
  const { error } = await supabase.from("alumni_offers").upsert({
    member_id: session.user.id,
    help_topics: helpTopics,
    availability: availability || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// The offer shown on someone else's profile page, looked up by the address on their directory row. null when they haven't set one.
export async function fetchAlumniOfferForEmail(email) {
  if (!email) return null;
  const { data, error } = await supabase.rpc("alumni_offer_for_email", { p_email: email });
  if (error || !data || data.length === 0) return null;
  return { helpTopics: data[0].help_topics ?? [], availability: data[0].availability ?? "" };
}
