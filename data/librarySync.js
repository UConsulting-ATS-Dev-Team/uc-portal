import { supabase } from "./supabaseClient.js";

// Real Career Resources library + learning tracks (library_resources /
// learning_tracks, admin-written, member-readable). Rows are mapped into the
// same flat shape the old static mockResources.js objects had, so the pages
// reading them changed as little as possible.
function resourceFromRow(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    format: r.format,
    description: r.description,
    sections: r.sections ?? [],
    linkUrl: r.link_url,
    notes: r.notes,
    author: r.author_name,
    updated: (r.updated_at ?? r.created_at ?? "").slice(0, 10),
  };
}

function trackFromRow(t) {
  const steps = Array.isArray(t.steps) ? t.steps : [];
  return {
    id: t.id,
    title: t.title,
    category: t.category,
    summary: t.summary,
    steps,
    totalHours: steps.reduce((sum, s) => sum + (Number(s.hours) || 0), 0),
  };
}

export async function fetchLibraryResources() {
  const { data, error } = await supabase.from("library_resources").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(resourceFromRow);
}

export async function fetchLearningTracks() {
  const { data, error } = await supabase.from("learning_tracks").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(trackFromRow);
}

async function currentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function resourceToRow(input) {
  return {
    title: input.title.trim(),
    category: input.category,
    format: input.format,
    description: input.description.trim(),
    sections: input.sections,
    link_url: input.linkUrl?.trim() || null,
    notes: input.notes?.trim() || null,
    author_name: input.author?.trim() || null,
  };
}

export async function createLibraryResource(input) {
  const { error } = await supabase.from("library_resources").insert({ ...resourceToRow(input), created_by: await currentUserId() });
  if (error) throw error;
}

export async function updateLibraryResource(id, input) {
  const { error } = await supabase
    .from("library_resources")
    .update({ ...resourceToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLibraryResource(id) {
  const { error } = await supabase.from("library_resources").delete().eq("id", id);
  if (error) throw error;
}

function trackToRow(input) {
  return {
    title: input.title.trim(),
    category: input.category,
    summary: input.summary.trim(),
    steps: input.steps.map((s) => ({
      title: s.title.trim(),
      type: s.type,
      detail: (s.detail ?? "").trim(),
      url: s.url?.trim() || null,
      hours: s.hours === "" || s.hours == null ? null : Number(s.hours),
    })),
  };
}

export async function createLearningTrack(input) {
  const { error } = await supabase.from("learning_tracks").insert({ ...trackToRow(input), created_by: await currentUserId() });
  if (error) throw error;
}

export async function updateLearningTrack(id, input) {
  const { error } = await supabase.from("learning_tracks").update(trackToRow(input)).eq("id", id);
  if (error) throw error;
}

export async function deleteLearningTrack(id) {
  const { error } = await supabase.from("learning_tracks").delete().eq("id", id);
  if (error) throw error;
}
