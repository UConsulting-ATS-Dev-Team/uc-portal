// Tiny deterministic string hash, used wherever we need to derive
// consistent-but-varied mock data from an id (odds model seeds, people
// profile generators) without hand-authoring every entry.
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
