import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./fetchAllRows.js";

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
    authorId: row.author_id,
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
// this app (interview write-ups, feature requests). fetchAllRows(), not a
// bare .select() -- feed_posts has no natural cap (every post, for the
// life of the club) and every caller (Feed.jsx, Home.jsx's preview,
// Notifications, Global Search) reads the whole table, the exact same
// unbounded-board-wide-read shape that silently truncated the Jobs board
// and the Companies grid at PostgREST's 1000-row default before each was
// caught and fixed -- fixed here proactively, before real post volume
// ever reaches that mark, rather than after.
export async function fetchFeedPosts() {
  return fetchAllRows("feed_posts", "*", (q) => q.order("created_at", { ascending: false }));
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

// Real own-row update/delete -- feed_posts_update_own/delete_own (RLS)
// already scoped these to author_id = auth.uid(); this closes the
// missing UI, not a new backend capability.
export async function updateFeedPost(id, body) {
  const { data, error } = await supabase.from("feed_posts").update({ body }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFeedPost(id) {
  const { error } = await supabase.from("feed_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
