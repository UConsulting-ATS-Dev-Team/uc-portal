import { supabase } from "./supabaseClient.js";
import { extractResumeText, parseResumeFields } from "./resumeParser.js";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function extensionFor(file) {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  return "docx";
}

// Uploads to the real, private `resumes` Storage bucket and extracts
// parsed fields from it -- doesn't touch profiles.resume_url/
// resume_file_name itself, same separation avatarSync.js's uploadAvatar()
// uses: the caller feeds the result into updateProfileOverrides() so it
// goes through the same local-state-then-background-sync path every
// other Personal-tab field already uses.
export async function uploadResume(file) {
  const isAllowedType = ALLOWED_TYPES.includes(file.type) || /\.(pdf|docx)$/i.test(file.name);
  if (!isAllowedType) {
    throw new Error("Please choose a PDF or Word (.docx) file.");
  }
  if (file.size > MAX_RESUME_BYTES) {
    throw new Error("Resume must be smaller than 10MB.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  // Best-effort -- a resume in an unusual format/scanned-image PDF with no
  // real text layer shouldn't block the actual upload, just skip parsing.
  let parsed = {};
  try {
    const text = await extractResumeText(file);
    parsed = parseResumeFields(text);
  } catch {
    parsed = {};
  }

  const path = `${session.user.id}/resume.${extensionFor(file)}`;
  const { error } = await supabase.storage.from("resumes").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;

  return { path, fileName: file.name, parsed };
}

export async function removeResume(currentPath) {
  if (!currentPath) return;
  await supabase.storage.from("resumes").remove([currentPath]);
}

// The resumes bucket is private -- no public URL works. A short-lived
// signed URL is generated on demand instead, only when a member actually
// wants to view/download their own resume.
export async function getResumeSignedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 60);
  if (error) return null;
  return data.signedUrl;
}
