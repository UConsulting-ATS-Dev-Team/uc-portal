import { supabase } from "./supabaseClient.js";

// Real accelerator program (freshmen onboarding) -- see the
// intern_accelerator migration's own header comment for the full
// rationale. Sequential unlock mirrors the existing Career Resources
// learning-track pattern (data/store.jsx's advanceTrackStep), but real
// progress here is gated by a real graded-or-not submission, not a
// client-side "mark done" toggle -- see the migration's own comment on
// why a required submission (not a timer) is the anti-skip mechanism.

export async function fetchLessons() {
  const { data, error } = await supabase.from("accelerator_lessons").select("*").order("week_number", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchMaterials(lessonId) {
  const { data, error } = await supabase
    .from("accelerator_materials")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Every material's storage path lives in a real public bucket -- not
// sensitive prep content, same reasoning as avatars, so a plain public
// URL is enough (no signed-URL machinery needed).
export function materialUrl(filePath) {
  return supabase.storage.from("accelerator-materials").getPublicUrl(filePath).data.publicUrl;
}

export async function fetchOwnSubmissions() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("accelerator_submissions").select("*").eq("profile_id", user.id);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Own real submission file -- private bucket, own-folder RLS (same
// shape as resumes), so real assignment work isn't readable by other
// interns.
export async function uploadSubmissionFile(file) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const ext = file.name.split(".").pop();
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("accelerator-submissions").upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  return { path, fileName: file.name };
}

// One real row per (lesson, intern) -- upsert so resubmitting before
// grading just replaces it, rather than growing a history no one reads.
export async function submitAssignment(lessonId, { body, filePath, fileName }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("accelerator_submissions")
    .upsert(
      { lesson_id: lessonId, profile_id: user.id, body: body?.trim() || null, file_path: filePath ?? null, file_name: fileName ?? null, submitted_at: new Date().toISOString() },
      { onConflict: "lesson_id,profile_id" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getSubmissionFileSignedUrl(path) {
  const { data, error } = await supabase.storage.from("accelerator-submissions").createSignedUrl(path, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// ---- Admin-only below (RLS backs every one of these regardless of what
// the UI shows) ----

export async function createLesson({ weekNumber, title, topicOverview }) {
  const { data, error } = await supabase
    .from("accelerator_lessons")
    .insert({ week_number: weekNumber, title, topic_overview: topicOverview || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLesson(id, { weekNumber, title, topicOverview }) {
  const { error } = await supabase
    .from("accelerator_lessons")
    .update({ week_number: weekNumber, title, topic_overview: topicOverview || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLesson(id) {
  const { error } = await supabase.from("accelerator_lessons").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadMaterial(lessonId, file) {
  const path = `${lessonId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("accelerator-materials").upload(path, file);
  if (uploadError) throw new Error(uploadError.message);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("accelerator_materials")
    .insert({ lesson_id: lessonId, file_path: path, file_name: file.name, uploaded_by: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMaterial(material) {
  await supabase.storage.from("accelerator-materials").remove([material.file_path]);
  const { error } = await supabase.from("accelerator_materials").delete().eq("id", material.id);
  if (error) throw new Error(error.message);
}

export async function fetchSubmissionsForLesson(lessonId) {
  const { data, error } = await supabase.from("accelerator_submissions").select("*").eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function gradeSubmission(id, { score, feedback }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("accelerator_submissions")
    .update({ score, feedback: feedback?.trim() || null, graded_by: user.id, graded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchInternRoster() {
  const { data, error } = await supabase.from("intern_roster").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addInternRosterEntry(email, name) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("intern_roster").insert({ email: email.trim().toLowerCase(), name: name?.trim() || null, added_by: user.id });
  if (error) throw new Error(error.message);
}

export async function removeInternRosterEntry(email) {
  const { error } = await supabase.from("intern_roster").delete().eq("email", email);
  if (error) throw new Error(error.message);
}

// Real "graduate to current member" action -- a plain update against
// profiles, same path AdminMembers.jsx's existing role-toggle already
// uses (profiles_update_admin has no column restriction).
export async function graduateIntern(profileId) {
  const { error } = await supabase.from("profiles").update({ member_status: "current_member" }).eq("id", profileId);
  if (error) throw new Error(error.message);
}
