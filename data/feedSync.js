import { supabase } from "./supabaseClient.js";

// Maps a feed_posts row into the same flat shape the old mock FEED_POSTS
// objects had, so pages/Feed.jsx and pages/Home.jsx's feed preview can
// render real posts with no changes to their own JSX. embeddedJobId/
// socialProof/helpfulCount/commentCount have no real source yet (see the
// feed_posts migration's own scope note) -- always empty for a real post,
// never fabricated.
export function feedRowToPost(row) {
  return {
    id: row.id,
    author: row.author_name,
    roleChip: "Member",
    postType: row.post_type,
    roleLine: row.author_role_line,
    timestamp: relativeTime(row.created_at),
    body: row.body,
    isEvent: row.is_event,
    eventLabel: row.event_label,
    helpfulCount: 0,
    commentCount: 0,
    socialProof: null,
  };
}

export function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Real feed posts (see the feed_posts migration for the full rationale).
// Newest first -- same convention as every other real-content list in
// this app (interview write-ups, feature requests).
export async function fetchFeedPosts() {
  const { data, error } = await supabase.from("feed_posts").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`Fetching feed_posts failed: ${error.message}`);
  return data ?? [];
}

// Same client-side filter pattern as data/realPeople.js's searchRealPeople/
// data/realCompanies.js's searchRealCompanies -- fine at this data scale,
// replaces data/searchUtils.js's searchAll() reading the mock FEED_POSTS
// for the "Feed posts" tab, same as those two already replaced it for
// People/Companies.
export async function searchFeedPosts(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rows = await fetchFeedPosts();
  return rows.filter((r) => r.body.toLowerCase().includes(q) || r.author_name.toLowerCase().includes(q)).map(feedRowToPost);
}

export async function submitFeedPost({ body, postType, authorName, authorRoleLine, isEvent, eventLabel }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("feed_posts")
    .insert({
      author_id: user.id,
      author_name: authorName,
      author_role_line: authorRoleLine,
      post_type: postType,
      body,
      is_event: isEvent,
      event_label: isEvent ? eventLabel : null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
