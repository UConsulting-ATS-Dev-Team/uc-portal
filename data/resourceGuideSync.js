import { supabase } from "./supabaseClient.js";

// Real content behind Career Resources' "Open guide"/"Download PDF" --
// see the resource_guide_files migration's own header for the full
// rationale. Falls back to the shared '*' default row/file when a
// specific resource has no admin-uploaded guide of its own yet.
export async function fetchGuideFileFor(resourceId) {
  const { data } = await supabase
    .from("resource_guide_files")
    .select("*")
    .in("resource_id", [resourceId, "*"])
    .order("resource_id", { ascending: false }) // exact match sorts before '*'
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { data: urlData } = supabase.storage.from("resource-guides").getPublicUrl(data.file_path);
  return { url: urlData.publicUrl, fileName: data.file_name, isSpecific: data.resource_id === resourceId };
}

export async function uploadGuideFile(resourceId, file) {
  const path = `${resourceId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("resource-guides").upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { error } = await supabase.from("resource_guide_files").upsert(
    { resource_id: resourceId, file_path: path, file_name: file.name, uploaded_by: session?.user?.id ?? null, uploaded_at: new Date().toISOString() },
    { onConflict: "resource_id" }
  );
  if (error) throw error;
}
