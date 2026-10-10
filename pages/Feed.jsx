import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
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
import "../styles/jobDetail.css";
import "../styles/feed.css";

const TABS = ["All", "Announcements", "Saved"];

export default function Feed() {
  const { profileOverrides, accountEmail, isAlumni, realIsAdmin } = useAppState();
  const location = useLocation();
  const [tab, setTab] = useState("All");
  // "Ask the network" from Global search's no-results state hands off a
  // prefilled prompt via router state rather than a URL param, since it's
  // one-time composer seeding, not a shareable/bookmarkable URL.
  const [composerText, setComposerText] = useState(location.state?.prefill || "");
  // Admins' posts here are announcements (labelled, in the Announcements tab); they can also pin one to the top of the feed.
  const [pinPost, setPinPost] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(null);
  const [posting, setPosting] = useState(false);
  const [helpfulPosts, setHelpfulPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
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
        // The database wants a type on every post; ordinary posts carry the neutral one and show no label.
        postType: realIsAdmin ? "Announcement" : "Advice",
        pinned: realIsAdmin && pinPost,
        authorName: displayName(profileOverrides, accountEmail),
        // Not resolvedClassYear() -- that falls back to mockUser.js's fake
        // "2027" the moment a real member has no class year set, which
        // would have permanently written a fabricated fact into the real,
        // shared feed_posts table (unlike a display-only fallback, this
        // one can't self-correct once posted). null when genuinely unset
        // -- Feed.jsx/Home.jsx's post rendering already handles a missing
        // roleLine.
        authorRoleLine: profileOverrides?.classYear ? `Class of ${profileOverrides.classYear}` : null,
        isEvent: false,
        eventLabel: null,
      });
      setPosts((prev) => [feedRowToPost(row), ...prev]);
      setComposerText("");
      setPinPost(false);
    } catch (err) {
      setPostsError(err.message);
    } finally {
      setPosting(false);
    }
  }

  function toggleHelpful(postId) {
    setHelpfulPosts((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
  }

  function toggleSavedPost(postId) {
    setSavedPosts((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
  }

  const filtered = useMemo(() => {
    return posts
      .filter((p) => {
        if (tab === "Announcements") return p.postType === "Announcement";
        if (tab === "Saved") return savedPosts.includes(p.id);
        return true;
      })
      .sort((a, b) => b.pinned - a.pinned); // pinned posts first, the rest already in created_at desc order
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
  return (
    <PullToRefresh onRefresh={refreshFeed}>
    <div className="feed-layout">
      <div className="feed-main">
        <div className="composer">
          <div className="composer__top">
            <div className="composer__avatar">
              <Avatar name={displayName(profileOverrides, accountEmail)} url={profileOverrides.avatarUrl} />
            </div>
            <textarea
              placeholder={realIsAdmin ? "Post an announcement to UC…" : "Share something with UC…"}
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
            />
          </div>
          <div className="composer__bottom">
            <div className="composer__types">
              {realIsAdmin && (
                <button type="button" className={`btn btn-secondary${pinPost ? " is-saved" : ""}`} aria-pressed={pinPost} onClick={() => setPinPost((v) => !v)}>
                  {pinPost ? "Pinned to the top of the feed" : "Pin to the top of the feed"}
                </button>
              )}
            </div>
            <button className="btn btn-primary" onClick={handlePost} disabled={posting || !composerText.trim()}>
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
          {postsError && (
            <p className="meta" style={{ color: "var(--color-danger)", marginTop: "var(--space-4)" }}>
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
              ? "Nothing posted yet. Be the first to share something with UC."
              : "Nothing here yet."}
          </div>
        )}

        {filtered.map((post) => {
          const isHelpful = helpfulPosts.includes(post.id);
          const helpfulCount = post.helpfulCount + (isHelpful ? 1 : 0);
          const isSaved = savedPosts.includes(post.id);

          const isAnnouncement = post.postType === "Announcement";
          return (
            <div
              className="post-card"
              key={post.id}
              style={post.pinned ? { borderLeft: "3px solid var(--color-accent)", background: "var(--color-surface)" } : undefined}
            >
              <div className="post-card__header">
                <div className="post-card__avatar">
                  <Avatar name={post.author} url={avatarsById.get(post.authorId)} />
                </div>
                <span className="post-card__name">{post.author}</span>
                {isAnnouncement && <span className="chip chip-accent">Announcement</span>}
                {post.pinned && <span className="chip">Pinned</span>}
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

              {(
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
        {!hasWorkHistory && (
          <div className="rail-card">
            <div className="rail-card__title">Add your work history</div>
            <p className="meta" style={{ margin: 0 }}>
              Other members can't see where you've worked until you add it. Real referral and insight connections
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
              Members recognize a face faster than a name. Add yours so people you've never met can spot you.
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
              No one's turned this on yet. It's a real setting (My Profile → Recruiting Settings).
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
      </div>
    </div>
    </PullToRefresh>
  );
}
