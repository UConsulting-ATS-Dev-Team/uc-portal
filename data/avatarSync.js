import { supabase } from "./supabaseClient.js";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function extensionFor(file) {
  const fromType = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type];
  return fromType || (file.name.split(".").pop() || "jpg").toLowerCase();
}

// Uploads to the real `avatars` Storage bucket and returns the new public
// URL -- deliberately doesn't touch profiles.avatar_url itself. The caller
// feeds the URL into updateProfileOverrides(), so it goes through the same
// local-state-then-background-sync path every other Personal-tab field
// already uses (data/store.jsx + data/profileOverridesSync.js), rather than
// this file doing a second, parallel direct write to the same table.
export async function uploadAvatar(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPEG, PNG, WEBP, or GIF image.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Image must be smaller than 5MB.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  // Fixed filename per member (not per-upload) so re-uploading overwrites
  // in place via upsert, rather than accumulating orphaned old files in
  // Storage every time someone changes their photo.
  const path = `${session.user.id}/avatar.${extensionFor(file)}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust: the path is stable across re-uploads, so without this a
  // browser/CDN cache would keep showing the old image at the same URL.
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removeAvatar(currentUrl) {
  const path = currentUrl?.split("/avatars/")[1]?.split("?")[0];
  if (path) await supabase.storage.from("avatars").remove([path]);
}

// Bulk lookup for showing OTHER members' avatars (Network, RealMemberProfile,
// Messages) -- one round trip per page rather than a per-person fetch.
// Real accounts only ever get an avatar via their own upload above, so this
// naturally stays empty for the many real Directory people who haven't
// signed up (or haven't uploaded a photo) yet -- the same "no photo without
// consent" default CLAUDE.md's People avatars note already established.
export async function fetchMemberAvatars() {
  const { data, error } = await supabase.rpc("list_member_avatars");
  if (error || !data) return { byId: new Map(), byEmail: new Map() };
  const byId = new Map();
  const byEmail = new Map();
  for (const row of data) {
    if (!row.avatar_url) continue;
    byId.set(row.member_id, row.avatar_url);
    if (row.email) byEmail.set(row.email.toLowerCase(), row.avatar_url);
  }
  return { byId, byEmail };
}
