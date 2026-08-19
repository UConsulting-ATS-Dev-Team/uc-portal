import { useMemo, useState } from "react";
import { FEED_POSTS } from "../data/mockFeed.js";
import { JOBS } from "../data/mockJobs.js";
import { PEOPLE } from "../data/mockPeople.js";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
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

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

export default function Feed() {
  const { savedJobIds, toggleSavedJob, savedConnections, toggleSavedConnection } = useAppState();
  const [tab, setTab] = useState("All");
  const [composerText, setComposerText] = useState("");
  const [selectedType, setSelectedType] = useState("Advice");
  const [posts, setPosts] = useState(FEED_POSTS);
  const [helpfulPosts, setHelpfulPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);

  function handlePost() {
    if (!composerText.trim()) return;
    const newPost = {
      id: `post-${Date.now()}`,
      author: `${currentUser.firstName} ${currentUser.lastName}`,
      roleChip: "Member",
      postType: selectedType,
      roleLine: `Class of ${currentUser.classYear}`,
      timestamp: "Just now",
      body: composerText.trim(),
      isEvent: selectedType === "Event",
      helpfulCount: 0,
      commentCount: 0,
      socialProof: null,
    };
    setPosts((prev) => [newPost, ...prev]);
    setComposerText("");
  }

  function toggleHelpful(postId) {
    setHelpfulPosts((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
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

  const activeAlumni = PEOPLE.filter((p) => p.status !== "Current member" && p.openToCoffeeChats).slice(0, 3);
  const upcoming = posts.filter((p) => p.isEvent);
  const trending = [
    { topic: "Case interviews", count: posts.filter((p) => p.postType === "Interview write-up").length + 6 },
    { topic: "Offers & outcomes", count: posts.filter((p) => p.postType === "UC-posted job").length + 4 },
    { topic: "Recruiting advice", count: posts.filter((p) => p.postType === "Advice").length + 8 },
  ];

  return (
    <div className="feed-layout">
      <div className="feed-main">
        <div className="composer">
          <div className="composer__top">
            <div className="composer__avatar">{currentUser.initials}</div>
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
            <button className="btn btn-primary" onClick={handlePost}>
              Post
            </button>
          </div>
        </div>

        <div className="feed-tabs">
          {TABS.map((t) => (
            <button key={t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="skeleton-card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
            Nothing here yet.
          </div>
        )}

        {filtered.map((post) => {
          const job = post.embeddedJobId ? JOBS.find((j) => j.id === post.embeddedJobId) : null;
          const isHelpful = helpfulPosts.includes(post.id);
          const helpfulCount = post.helpfulCount + (isHelpful ? 1 : 0);
          const isSaved = savedPosts.includes(post.id);

          return (
            <div className="post-card" key={post.id}>
              <div className="post-card__header">
                <div className="post-card__avatar">{initials(post.author)}</div>
                <span className="post-card__name">{post.author}</span>
                <span className="chip">{post.roleChip}</span>
                <span className="chip chip-accent">{post.postType}</span>
              </div>
              <p className="post-card__role-line">
                {post.roleLine} · {post.timestamp}
              </p>
              <p className="post-card__body">{post.body}</p>

              {job && (
                <div className="post-card__embed">
                  <JobCard job={job} saved={savedJobIds.includes(job.id)} onToggleSave={toggleSavedJob} />
                </div>
              )}

              {post.isEvent ? (
                <div className="post-card__engagement">
                  <span>{post.eventLabel}</span>
                  <button className="btn btn-secondary">RSVP</button>
                  <button className="btn-link">Add to calendar</button>
                  <span className="post-card__proof">{post.rsvpCount || 0} attending</span>
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
                  <button>Share</button>
                  {post.socialProof && <span className="post-card__proof">{post.socialProof}</span>}
                </div>
              )}
            </div>
          );
        })}
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

        <div className="rail-card">
          <div className="rail-card__title">Alumni active this week</div>
          {activeAlumni.map((p) => (
            <div className="active-alumni-row" key={p.id}>
              <span>{p.name}</span>
              <button className="btn btn-secondary" onClick={() => toggleSavedConnection(p.id)}>
                {savedConnections.includes(p.id) ? "Following" : "Follow"}
              </button>
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
  );
}
