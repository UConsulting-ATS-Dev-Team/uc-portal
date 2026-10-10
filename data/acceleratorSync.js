import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./fetchAllRows.js";
import { assignmentProgress, attendanceProgress, coffeeChatProgress, programPeriods } from "./acceleratorLogic.js";

// Real accelerator program (freshmen onboarding) -- see the
// intern_accelerator migration's own header comment for the full
// rationale. Sequential unlock mirrors the existing Career Resources
// learning-track pattern (data/store.jsx's advanceTrackStep), but real
// progress here is gated by a real graded-or-not submission, not a
// client-side "mark done" toggle -- see the migration's own comment on
// why a required submission (not a timer) is the anti-skip mechanism.

export async function fetchLessons() {
  const { data, error } = await supabase.from("accelerator_lessons").select("*").order("lesson_date", { ascending: true });
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

// Real href for a material row regardless of kind (uploaded file vs. a
// plain link) -- exactly one of file_path/link_url is ever set (DB check
// constraint), so this is the one place UI code needs to branch on it.
export function materialHref(material) {
  return material.link_url ?? materialUrl(material.file_path);
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

export async function createLesson({ lessonDate, title, topicOverview }) {
  const { data, error } = await supabase
    .from("accelerator_lessons")
    .insert({ lesson_date: lessonDate, title, topic_overview: topicOverview || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLesson(id, { lessonDate, title, topicOverview }) {
  const { error } = await supabase
    .from("accelerator_lessons")
    .update({ lesson_date: lessonDate, title, topic_overview: topicOverview || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLesson(id) {
  // The lesson's material and submission rows cascade with it, but the files
  // they point at live in Storage and don't -- clear them first so deleting a
  // lesson doesn't leave orphaned uploads behind. Best effort: a storage
  // error here (e.g. no admin delete rights on the private submissions
  // bucket) must not block deleting the lesson itself.
  const [{ data: materials }, { data: submissions }] = await Promise.all([
    supabase.from("accelerator_materials").select("file_path").eq("lesson_id", id),
    supabase.from("accelerator_submissions").select("file_path").eq("lesson_id", id),
  ]);
  const materialPaths = (materials ?? []).map((m) => m.file_path).filter(Boolean);
  const submissionPaths = (submissions ?? []).map((s) => s.file_path).filter(Boolean);
  if (materialPaths.length) await supabase.storage.from("accelerator-materials").remove(materialPaths);
  if (submissionPaths.length) await supabase.storage.from("accelerator-submissions").remove(submissionPaths);

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

// Real link attachment (a Slides deck, an article) alongside an uploaded
// file -- not every real piece of prep material is a file to upload.
// file_name doubles as the shared display label for either kind.
export async function addMaterialLink(lessonId, label, url) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("accelerator_materials")
    .insert({ lesson_id: lessonId, link_url: url, file_name: label?.trim() || url, uploaded_by: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMaterial(material) {
  if (material.file_path) {
    await supabase.storage.from("accelerator-materials").remove([material.file_path]);
  }
  const { error } = await supabase.from("accelerator_materials").delete().eq("id", material.id);
  if (error) throw new Error(error.message);
}

// Real "at a glance" roster progress -- closes the gap the per-lesson
// submissions table alone left: no single view of "every intern, how
// far along are they." Joins list_members() (admin-only, already the
// real name/email resolver AdminMembers.jsx uses) against every real
// submission, client-side -- small enough tables that a second query
// per row isn't worth avoiding the join for.
export async function fetchInternProgress() {
  // All real submissions app-wide, not one lesson's worth -- unlikely to
  // ever near PostgREST's 1000-row default at this club's real scale
  // (a cohort's worth of interns x ~8 lessons/year), but real, not
  // hypothetical: fetchAllRows() closes the exact silent-truncation class
  // of bug that already bit the Jobs board, the Companies grid, and
  // feed_posts once each in this project's history -- cheap to apply
  // proactively rather than wait for a fourth real incident.
  const rosterNames = await rosterNamesByEmail();
  const [{ data: members, error: membersError }, lessons, allSubmissions, events, allAttendance, allChats, schedule] = await Promise.all([
    supabase.rpc("list_members"),
    fetchLessons(),
    fetchAllRows("accelerator_submissions", "*"),
    fetchEvents(),
    fetchAllRows("accelerator_attendance", "*", undefined, "event_id"),
    fetchAllRows("accelerator_coffee_chats", "id, profile_id, chat_date, is_uc_member, created_at"),
    fetchMeetingSchedule(),
  ]);
  if (membersError) throw new Error(membersError.message);

  const interns = (members ?? []).filter((m) => m.member_status === "intern");
  // "Accelerator week" is now a computed position in the real,
  // chronologically-ordered curriculum (fetchLessons() already sorts by
  // lesson_date) rather than a stored, hand-entered number -- see the
  // lesson_date migration's own comment for why.
  const lessonByWeek = new Map(lessons.map((l, i) => [l.id, i + 1]));

  return interns.map((intern) => {
    const own = allSubmissions.filter((s) => s.profile_id === intern.member_id);
    const weeksSubmitted = own.map((s) => lessonByWeek.get(s.lesson_id)).filter((w) => w != null);
    const graded = own.filter((s) => s.graded_at != null);
    const assignments = assignmentProgress(lessons, own);
    const attendance = attendanceProgress(
      events,
      allAttendance.filter((a) => a.profile_id === intern.member_id),
      new Date()
    );
    const ownChats = allChats.filter((c) => c.profile_id === intern.member_id);
    const chats = coffeeChatProgress(ownChats, programPeriods(events, { lessons, chats: ownChats, schedule }), new Date());
    return {
      assignmentsComplete: assignments.complete,
      assignmentsIncomplete: assignments.incomplete,
      assignmentsAwaiting: assignments.awaitingReview,
      chatsCounted: chats.counted,
      chatsTarget: chats.target,
      weeksBehindOnChats: chats.behind.length,
      requiredAttended: attendance.requiredAttended,
      requiredSoFar: attendance.requiredSoFar,
      noSocials: attendance.noSocials,
      memberId: intern.member_id,
      displayName: nameFor(intern, rosterNames),
      email: intern.email,
      submittedCount: own.length,
      totalLessons: lessons.length,
      highestWeek: weeksSubmitted.length ? Math.max(...weeksSubmitted) : 0,
      gradedCount: graded.length,
      lastSubmittedAt: own.length ? own.map((s) => s.submitted_at).sort().at(-1) : null,
    };
  });
}

export async function fetchSubmissionsForLesson(lessonId) {
  const { data, error } = await supabase.from("accelerator_submissions").select("*").eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// The committee marks a submission complete or incomplete and leaves comments (the intern sees both). The numeric
// grade is the committee's own and lives in a separate admin-only table, so an intern can't read it.
export async function gradeSubmission(id, { status, score, feedback }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("accelerator_submissions")
    .update({ status, feedback: feedback?.trim() || null, graded_by: user.id, graded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (score === null || score === undefined) {
    const { error: deleteError } = await supabase.from("accelerator_submission_scores").delete().eq("submission_id", id);
    if (deleteError) throw new Error(deleteError.message);
  } else {
    const { error: scoreError } = await supabase
      .from("accelerator_submission_scores")
      .upsert({ submission_id: id, score, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "submission_id" });
    if (scoreError) throw new Error(scoreError.message);
  }
}

export async function fetchScoresForSubmissions(submissionIds) {
  if (submissionIds.length === 0) return new Map();
  const { data, error } = await supabase.from("accelerator_submission_scores").select("submission_id, score").in("submission_id", submissionIds);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r) => [r.submission_id, r.score]));
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

// Real bulk-add for onboarding a whole incoming cohort at once -- one row
// per line, "email" or "email, name". Real friction otherwise: an
// advisor adding 10-30 freshmen one at a time through the single-entry
// form above. Upserts (on_conflict: email) so re-pasting an already-added
// email is harmless, not a duplicate-key error mid-batch.
export async function bulkAddInternRoster(text) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // A line with no "@" is just a name: that intern is cleared to sign up by typing it (the email isn't known yet).
  const names = lines.filter((line) => !line.includes("@"));
  if (names.length) {
    const nameRows = names.map((name) => ({ name: name.replace(/\s+/g, " "), name_key: name.trim().replace(/\s+/g, " ").toLowerCase(), added_by: user.id }));
    const { error } = await supabase.from("intern_name_roster").upsert(nameRows, { onConflict: "name_key", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  const rows = lines
    .filter((line) => line.includes("@"))
    .map((line) => {
      const [email, ...rest] = line.split(",");
      return { email: email.trim().toLowerCase(), name: rest.join(",").trim() || null, added_by: user.id };
    })
    .filter((r) => r.email.includes("@"));
  if (rows.length > 0) {
    const { error } = await supabase.from("intern_roster").upsert(rows, { onConflict: "email" });
    if (error) throw new Error(error.message);
  }
  return rows.length + names.length;
}

// Names cleared to sign up as interns (no email yet). claimed_at is set once someone has signed up with that name.
export async function fetchInternNames() {
  const { data, error } = await supabase.from("intern_name_roster").select("name_key, name, claimed_at").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function removeInternName(nameKey) {
  const { error } = await supabase.from("intern_name_roster").delete().eq("name_key", nameKey);
  if (error) throw new Error(error.message);
}

// Real back-and-forth comment thread per submission -- separate from the
// single official score/feedback fields; see the migration's own comment
// for why. Readable/writable by the submission's own intern or any admin,
// enforced by RLS -- these two functions don't need to know which caller
// they're being called from.
export async function fetchSubmissionComments(submissionId) {
  const { data, error } = await supabase
    .from("accelerator_submission_comments")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addSubmissionComment(submissionId, body) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("accelerator_submission_comments")
    .insert({ submission_id: submissionId, author_id: user.id, body: body.trim() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Real deadline-notification count for an intern -- the one "notification"
// surface they have, since the dedicated Notifications page is route-
// guarded away from them (components/RequireNotIntern.jsx). "Actionable"
// means unlocked (the previous lesson is already submitted, so this one is
// actually workable) and not yet submitted, with its real lesson_date
// within 7 days -- same due-soon window as jobUtils.js's isUrgent().
export async function fetchUpcomingDeadlineCount() {
  const [lessons, submissions] = await Promise.all([fetchLessons(), fetchOwnSubmissions()]);
  const submittedIds = new Set(submissions.map((s) => s.lesson_id));
  let count = 0;
  lessons.forEach((lesson, i) => {
    if (submittedIds.has(lesson.id)) return;
    const prevSubmitted = i === 0 || submittedIds.has(lessons[i - 1].id);
    if (!prevSubmitted) return;
    const days = Math.ceil((new Date(lesson.lesson_date) - new Date()) / 86400000);
    if (days <= 7) count++;
  });
  return count;
}

// Real "graduate to current member" action -- a plain update against
// profiles, same path AdminMembers.jsx's existing role-toggle already
// uses (profiles_update_admin has no column restriction).
export async function graduateIntern(profileId) {
  const { error } = await supabase.from("profiles").update({ member_status: "current_member" }).eq("id", profileId);
  if (error) throw new Error(error.message);
}


// ---- Weekly meeting schedule ------------------------------------------------------------------------------

// { weekday: 0-6 (Sunday first), time: "HH:MM" } or null when the admin hasn't set it. Coffee-chat weeks reset then.
export async function fetchMeetingSchedule() {
  const { data, error } = await supabase.from("accelerator_settings").select("meeting_weekday, meeting_time").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { weekday: data.meeting_weekday, time: data.meeting_time.slice(0, 5) } : null;
}

export async function saveMeetingSchedule({ weekday, time }) {
  const { error } = await supabase
    .from("accelerator_settings")
    .upsert({ id: true, meeting_weekday: weekday, meeting_time: time, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

// ---- Calendar events, attendance and coffee chats (tracker) ----------------------------------------------

export async function fetchEvents() {
  const { data, error } = await supabase
    .from("accelerator_events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOwnAttendance() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("accelerator_attendance").select("*").eq("profile_id", user.id);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOwnCoffeeChats() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("accelerator_coffee_chats")
    .select("*")
    .eq("profile_id", user.id)
    .order("chat_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Private bucket, own-folder RLS: the photo is only readable by the intern and admins.
export async function uploadChatPhoto(file) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("accelerator-chat-photos").upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return path;
}

export async function chatPhotoUrl(path) {
  const { data, error } = await supabase.storage.from("accelerator-chat-photos").createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function addCoffeeChat({ chatDate, contactName, isUcMember, memberYear, memberMajor, summary, photoPath }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("accelerator_coffee_chats")
    .insert({
      profile_id: user.id,
      chat_date: chatDate,
      contact_name: contactName.trim(),
      is_uc_member: isUcMember,
      member_year: memberYear.trim(),
      member_major: memberMajor.trim(),
      summary: summary.trim(),
      photo_path: photoPath ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCoffeeChat(chat) {
  if (chat.photo_path) await supabase.storage.from("accelerator-chat-photos").remove([chat.photo_path]);
  const { error } = await supabase.from("accelerator_coffee_chats").delete().eq("id", chat.id);
  if (error) throw new Error(error.message);
}

// ---- Admin-only (RLS backs every one of these) ----

function eventRow({ title, eventDate, startTime, endTime, kind, required, attendanceMethod, location, description }) {
  return {
    title: title.trim(),
    event_date: eventDate,
    start_time: startTime || null,
    end_time: startTime && endTime ? endTime : null,
    kind,
    required,
    attendance_method: attendanceMethod,
    location: location?.trim() || null,
    description: description?.trim() || null,
  };
}

export async function createEvent(fields) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("accelerator_events")
    .insert({ ...eventRow(fields), created_by: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// A recurring event is one row per date, all sharing a series_id so the series can be edited or removed together.
export async function createEventSeries(fields, dates) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const seriesId = crypto.randomUUID();
  const rows = dates.map((date) => ({ ...eventRow({ ...fields, eventDate: date }), series_id: seriesId, created_by: user.id }));
  const { error } = await supabase.from("accelerator_events").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function updateEvent(id, fields) {
  const { error } = await supabase.from("accelerator_events").update(eventRow(fields)).eq("id", id);
  if (error) throw new Error(error.message);
}

// Everything except each occurrence's own date.
export async function updateEventSeries(seriesId, fields) {
  const { event_date: _date, ...rest } = eventRow(fields);
  const { error } = await supabase.from("accelerator_events").update(rest).eq("series_id", seriesId);
  if (error) throw new Error(error.message);
}

export async function deleteEvent(id) {
  const { error } = await supabase.from("accelerator_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEventSeries(seriesId) {
  const { error } = await supabase.from("accelerator_events").delete().eq("series_id", seriesId);
  if (error) throw new Error(error.message);
}

export async function fetchAttendanceForEvent(eventId) {
  const { data, error } = await supabase.from("accelerator_attendance").select("*").eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// attended: true / false records it; null clears the record (back to "not recorded").
export async function setAttendance(eventId, profileId, attended) {
  if (attended === null) {
    const { error } = await supabase.from("accelerator_attendance").delete().eq("event_id", eventId).eq("profile_id", profileId);
    if (error) throw new Error(error.message);
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("accelerator_attendance")
    .upsert({ event_id: eventId, profile_id: profileId, attended, source: "admin", marked_by: user.id, marked_at: new Date().toISOString() }, { onConflict: "event_id,profile_id" });
  if (error) throw new Error(error.message);
}

export async function fetchChatsForIntern(profileId) {
  const { data, error } = await supabase
    .from("accelerator_coffee_chats")
    .select("*")
    .eq("profile_id", profileId)
    .order("chat_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// An account with no saved name comes back from list_members with its email as the name. The name the admin typed on the
// intern roster is the better label, so it stands in for the email.
async function rosterNamesByEmail() {
  const { data } = await supabase.from("intern_roster").select("email, name");
  return new Map((data ?? []).filter((r) => r.name).map((r) => [r.email.toLowerCase(), r.name]));
}

function nameFor(member, rosterNames) {
  const name = member.display_name;
  return !name || name.includes("@") ? rosterNames.get((member.email ?? "").toLowerCase()) ?? name : name;
}

export async function fetchInterns() {
  const [{ data, error }, rosterNames] = await Promise.all([supabase.rpc("list_members"), rosterNamesByEmail()]);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((m) => m.member_status === "intern")
    .map((m) => ({ memberId: m.member_id, displayName: nameFor(m, rosterNames), email: m.email }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}


// ---- Event photos (the intern's own attendance evidence) ------------------------------------------------

// For events the committee doesn't take attendance at (company visits, fireside chats, socials): the intern submits a
// photo from the event, which records them as attending. The committee can still change it.
export async function submitEventPhoto(eventId, file) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("accelerator-event-photos").upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await supabase
    .from("accelerator_attendance")
    .upsert(
      { event_id: eventId, profile_id: user.id, attended: true, source: "photo", photo_path: path, marked_at: new Date().toISOString() },
      { onConflict: "event_id,profile_id" }
    );
  if (error) {
    await supabase.storage.from("accelerator-event-photos").remove([path]);
    throw new Error(error.message.includes("row-level security") ? "The committee has already recorded your attendance for this event." : error.message);
  }
  return path;
}

export async function eventPhotoUrl(path) {
  const { data, error } = await supabase.storage.from("accelerator-event-photos").createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
