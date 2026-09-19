import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { JOBS } from "../data/mockJobs.js";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
import { displayName } from "../data/profileUtils.js";
import { fetchFeedPosts, submitFeedPost, updateFeedPost, deleteFeedPost, feedRowToPost } from "../data/feedSync.js";
import { supabase } from "../data/supabaseClient.js";
import { listOpenToCoffeeChatMembers } from "../data/messagesSync.js";
import { fetchMemberAvatars } from "../data/avatarSync.js";
import { fetchOwnWorkHistory } from "../data/workHistorySync.js";
import { useSwipeTabs } from "../data/useSwipeTabs.js";
import Avatar from "../components/Avatar.jsx";
import PullToRefresh from "../components/PullToRefresh.jsx";
import JobCard from "../components/JobCard.jsx";
import "../styles/jobDetail.css";
import "../styles/feed.css";

const TABS = ["All", "Alumni", "Opportunities", "Advice", "Events", "Saved"];
const POST_TYPES = [
  { label: "Post a job", value: "UC-posted job" },
  { label: "Interview write-up", value: "Interview write-up" },
  { label: "Ask the network", value: "Advice" },
  { label: "Event", value: "Event" },
];

export default function Feed() {
  const { savedJobIds, toggleSavedJob, profileOverrides, isAlumni } = useAppState();
  const location = useLocation();
  const [tab, setTab] = useState("All");
  // "Ask the network" from Global search's no-results state hands off a
  // prefilled prompt via router state rather than a URL param, since it's
  // one-time composer seeding, not a shareable/bookmarkable URL.
  const [composerText, setComposerText] = useState(location.state?.prefill || "");
  const [selectedType, setSelectedType] = useState("Advice");
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(null);
  const [posting, setPosting] = useState(false);
  const [helpfulPosts, setHelpfulPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [rsvpedPosts, setRsvpedPosts] = useState([]);
  const [avatarsById, setAvatarsById] = useState(new Map());
  const [currentAccountId, setCurrentAccountId] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  // Shared by the mount fetch and pull-to-refresh -- same fetch, just
  // triggered two different ways.
  function refreshFeed() {
    return fetchFeedPosts()
      .then((rows) => setPosts(rows.map(feedRowToPost)))
      .catch((err) => setPostsError(err.message))
      .finally(() => setPostsLoading(false));
  }

  function startEditPost(post) {
    setEditingPostId(post.id);
    setEditDraft(post.body);
  }

  function saveEditPost(postId) {
    if (!editDraft.trim()) return;
    updateFeedPost(postId, editDraft.trim()).then(() => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, body: editDraft.trim() } : p)));
      setEditingPostId(null);
    });
  }

  function handleDeletePost(postId) {
    deleteFeedPost(postId).then(() => setPosts((prev) => prev.filter((p) => p.id !== postId)));
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentAccountId(data?.user?.id ?? null));
  }, []);

  useEffect(() => {
    refreshFeed();
    fetchMemberAvatars().then(({ byId }) => setAvatarsById(byId));
  }, []);

  const swipeHandlers = useSwipeTabs(TABS, tab, setTab);

  async function handlePost() {
    if (!composerText.trim() || posting) return;
    setPosting(true);
    setPostsError(null);
    try {
      const row = await submitFeedPost({
        body: composerText.trim(),
        postType: selectedType,
        authorName: displayName(currentUser, profileOverrides),
        // Not resolvedClassYear() -- that falls back to mockUser.js's fake
        // "2027" the moment a real member has no class year set, which
        // would have permanently written a fabricated fact into the real,
        // shared feed_posts table (unlike a display-only fallback, this
        // one can't self-correct once posted). null when genuinely unset
        // -- Feed.jsx/Home.jsx's post rendering already handles a missing
        // roleLine.
        authorRoleLine: profileOverrides?.classYear ? `Class of ${profileOverrides.classYear}` : null,
        isEvent: selectedType === "Event",
        // No real event-date/RSVP picker in the composer yet -- same
        // scope line the feed_posts migration draws (posts themselves
        // were the complaint, not a new event-scheduling UI).
        eventLabel: null,
      });
      setPosts((prev) => [feedRowToPost(row), ...prev]);
      setComposerText("");
    } catch (err) {
      setPostsError(err.message);
    } finally {
      setPosting(false);
    }
  }

  function toggleHelpful(postId) {
    setHelpfulPosts((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
  }

  // Was a dead click ("RSVP" had no onClick at all) -- same base-count +
  // local-toggle pattern as toggleHelpful/helpfulCount above, not new
  // machinery. "Add to calendar" stays inert (no calendar integration
  // anywhere in this prototype -- same reasoning as Applications
  // tracker's "Sync deadlines to calendar").
  function toggleRsvp(postId) {
    setRsvpedPosts((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
  }

  function toggleSavedPost(postId) {
    setSavedPosts((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
  }

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (tab === "Alumni") return p.roleChip === "Alumna" || p.roleChip === "Alumnus";
      if (tab === "Opportunities") return p.postType === "UC-posted job";
      if (tab === "Advice") return p.postType === "Advice";
      if (tab === "Events") return p.postType === "Event";
      if (tab === "Saved") return savedPosts.includes(p.id);
      return true;
    });
  }, [posts, tab, savedPosts]);

  // Real members who've opted in via MyProfile.jsx's "Open to coffee
  // chat requests from members" setting -- was mockPeople.js's 13
  // fictional people, filtered by a flag real people always default
  // false for (no real consent signal existed for the real directory).
  const [openToCoffeeChat, setOpenToCoffeeChat] = useState([]);
  useEffect(() => {
    listOpenToCoffeeChatMembers()
      .then(setOpenToCoffeeChat)
      .catch(() => {});
  }, []);
  // The real "incentivize submissions" piece of Work History: a nudge
  // shown on Feed specifically (not just buried in a My Profile tab)
  // since Feed is every real member's -- and every real alumnus's, whose
  // landing route is Feed, not Home -- most-visited real page. Only
  // shown while genuinely empty; stops nagging the moment someone adds
  // even one entry.
  const [hasWorkHistory, setHasWorkHistory] = useState(true);
  useEffect(() => {
    fetchOwnWorkHistory()
      .then((rows) => setHasWorkHistory(rows.length > 0))
      .catch(() => {});
  }, []);
  const upcoming = posts.filter((p) => p.isEvent);
  // Real counts now that posts are real -- used to add a flat "+6/+4/+8"
  // baseline to make an 8-post mock feed look busier than it was; a real,
  // possibly-zero count is the honest number now.
  const trending = [
    { topic: "Case interviews", count: posts.filter((p) => p.postType === "Interview write-up").length },
    { topic: "Offers & outcomes", count: posts.filter((p) => p.postType === "UC-posted job").length },
    { topic: "Recruiting advice", count: posts.filter((p) => p.postType === "Advice").length },
  ];

  return (
    <PullToRefresh onRefresh={refreshFeed}>
    <div className="feed-layout">
      <div className="feed-main">
        <div className="composer">
          <div className="composer__top">
            <div className="composer__avatar">
              <Avatar name={displayName(currentUser, profileOverrides)} url={profileOverrides.avatarUrl} />
            </div>
            <textarea
              placeholder="Share something with UC…"
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
            />
          </div>
          <div className="composer__bottom">
            <div className="composer__types">
              {POST_TYPES.map((t) => (
                <button
                  key={t.value}
                  className={`chip-toggle${selectedType === t.value ? " is-selected" : ""}`}
                  onClick={() => setSelectedType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handlePost} disabled={posting || !composerText.trim()}>
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
          {postsError && (
            <p className="meta" style={{ color: "#B3261E", marginTop: "var(--space-4)" }}>
              {postsError}
            </p>
          )}
        </div>

        <div className="feed-tabs">
          {TABS.map((t) => (
            <button key={t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        <div {...swipeHandlers}>
        {postsLoading && (
          <div className="skeleton-card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
            Loading the feed…
          </div>
        )}

        {!postsLoading && filtered.length === 0 && (
          <div className="skeleton-card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
            {posts.length === 0
              ? "Nothing posted yet — be the first to share something with UC."
              : "Nothing here yet."}
          </div>
        )}

        {filtered.map((post) => {
          const job = post.embeddedJobId ? JOBS.find((j) => j.id === post.embeddedJobId) : null;
          const isHelpful = helpfulPosts.includes(post.id);
          const helpfulCount = post.helpfulCount + (isHelpful ? 1 : 0);
          const isSaved = savedPosts.includes(post.id);
          const isRsvped = rsvpedPosts.includes(post.id);
          const rsvpCount = (post.rsvpCount || 0) + (isRsvped ? 1 : 0);

          return (
            <div className="post-card" key={post.id}>
              <div className="post-card__header">
                <div className="post-card__avatar">
                  <Avatar name={post.author} url={avatarsById.get(post.authorId)} />
                </div>
                <span className="post-card__name">{post.author}</span>
                <span className="chip">{post.roleChip}</span>
                <span className="chip chip-accent">{post.postType}</span>
              </div>
              <p className="post-card__role-line">
                {post.roleLine ? `${post.roleLine} · ` : ""}
                {post.timestamp}
              </p>
              {editingPostId === post.id ? (
                <div style={{ marginBottom: "var(--space-3)" }}>
                  <textarea
                    rows={3}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    style={{ width: "100%" }}
                  />
                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                    <button className="btn btn-secondary" onClick={() => saveEditPost(post.id)} disabled={!editDraft.trim()}>
                      Save
                    </button>
                    <button className="btn-link" onClick={() => setEditingPostId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="post-card__body">{post.body}</p>
              )}

              {job && (
                <div className="post-card__embed">
                  <JobCard job={job} saved={savedJobIds.includes(job.id)} onToggleSave={toggleSavedJob} />
                </div>
              )}

              {post.isEvent ? (
                <div className="post-card__engagement">
                  <span>{post.eventLabel}</span>
                  <button className={`btn btn-secondary${isRsvped ? " is-saved" : ""}`} onClick={() => toggleRsvp(post.id)}>
                    {isRsvped ? "✓ Going" : "RSVP"}
                  </button>
                  <button
                    className="btn-link"
                    disabled
                    title="Not built yet -- no calendar integration exists in this prototype"
                  >
                    Add to calendar
                  </button>
                  <span className="post-card__proof">{rsvpCount} attending</span>
                  {post.authorId === currentAccountId && (
                    <>
                      <button className="btn-link" onClick={() => startEditPost(post)}>
                        Edit
                      </button>
                      <button className="btn-link" onClick={() => handleDeletePost(post.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="post-card__engagement">
                  <button className={isHelpful ? "is-active" : ""} onClick={() => toggleHelpful(post.id)}>
                    ↑ {helpfulCount} helpful
                  </button>
                  <span>{post.commentCount} comments</span>
                  <button className={isSaved ? "is-active" : ""} onClick={() => toggleSavedPost(post.id)}>
                    {isSaved ? "Saved" : "Save"}
                  </button>
                  <button disabled title="Not built yet -- no share/copy-link flow exists in this prototype">
                    Share
                  </button>
                  {post.socialProof && <span className="post-card__proof">{post.socialProof}</span>}
                  {post.authorId === currentAccountId && (
                    <>
                      <button className="btn-link" onClick={() => startEditPost(post)}>
                        Edit
                      </button>
                      <button className="btn-link" onClick={() => handleDeletePost(post.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      <div className="feed-rail">
        <div className="rail-card is-accent">
          <div className="rail-card__title">Why this feed is different</div>
          <p style={{ margin: 0 }}>
            Every post here comes from a UC member or alumnus — the referrals, write-ups, and advice below
            don't exist anywhere on the open internet.
          </p>
        </div>

        <div className="rail-card">
          <div className="rail-card__title">Trending in UC</div>
          {trending.map((t) => (
            <div className="trending-row" key={t.topic}>
              <span>{t.topic}</span>
              <span className="meta">{t.count} posts</span>
            </div>
          ))}
        </div>

        {!hasWorkHistory && (
          <div className="rail-card">
            <div className="rail-card__title">Add your work history</div>
            <p className="meta" style={{ margin: 0 }}>
              Other members can't see where you've worked until you add it — real referral/insight connections
              start there.
            </p>
            <Link to="/profile" className="btn btn-secondary" style={{ marginTop: "var(--space-3)" }}>
              Add on My Profile
            </Link>
          </div>
        )}

        {/* Alumni-only: the team-page import already covers every current
            member's photo, so this would wrongly nag someone who already
            has a real one showing everywhere else. Alumni have no
            equivalent source at all -- self-upload is genuinely the only
            way they get a real photo, so the nudge matters more here. */}
        {isAlumni && !profileOverrides.avatarUrl && (
          <div className="rail-card">
            <div className="rail-card__title">Add your photo</div>
            <p className="meta" style={{ margin: 0 }}>
              Members recognize a face faster than a name — add yours so people you've never met can spot you.
            </p>
            <Link to="/profile" className="btn btn-secondary" style={{ marginTop: "var(--space-3)" }}>
              Add on My Profile
            </Link>
          </div>
        )}

        <div className="rail-card">
          <div className="rail-card__title">Open to a coffee chat</div>
          {openToCoffeeChat.length === 0 && (
            <p className="meta" style={{ margin: 0 }}>
              No one's turned this on yet — a real setting (My Profile → Recruiting Settings).
            </p>
          )}
          {openToCoffeeChat.slice(0, 3).map((p) => (
            <div className="active-alumni-row" key={p.member_id}>
              <span>{p.display_name}</span>
              <Link
                to={`/messages?accountId=${p.member_id}&accountName=${encodeURIComponent(p.display_name)}`}
                className="btn btn-secondary"
              >
                Chat
              </Link>
            </div>
          ))}
        </div>

        <div className="rail-card">
          <div className="rail-card__title">Upcoming</div>
          {upcoming.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing scheduled.</p>}
          {upcoming.map((e) => (
            <div className="upcoming-row" key={e.id}>
              <span>{e.eventLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}
