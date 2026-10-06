import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
import { isManualJobId, jobForManualEntry } from "../data/manualApplications.js";
import { fetchFeedPosts, feedRowToPost } from "../data/feedSync.js";
import { listOpenToCoffeeChatMembers } from "../data/messagesSync.js";
import { computeProfileStrength, displayName, resolvedClassYear, resolvedGradMonth } from "../data/profileUtils.js";
import Avatar from "../components/Avatar.jsx";
import { deadlineLabel, isUrgent } from "../data/jobUtils.js";
import { nextActionForStage } from "../data/trackerUtils.js";
import { useRealJobs } from "../data/useRealJobs.js";
import { isNewSince, useJobsVisitBaseline } from "../data/jobVisit.js";
import JobCard from "../components/JobCard.jsx";
import Skeleton from "../components/Skeleton.jsx";
import "../styles/jobs.css";
import "../styles/jobDetail.css";
import "../styles/feed.css";
import "../styles/resources.css";
import "../styles/myProfile.css";
import "../styles/home.css";

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

export default function Home() {
  const {
    preferences,
    profileOverrides,
    accountEmail,
    savedJobIds,
    toggleSavedJob,
    trackedJobs,
    prepLogged,
    memberDataLoading,
    accountId,
  } = useAppState();
  const visitBaseline = useJobsVisitBaseline(accountId);

  // "Recommended for you" and the tracked-job lookup below both used to
  // read data/mockJobs.js's 8 demo jobs, unchanged since before the real
  // Jobs board (Stage 2) existed -- meaning Home showed fictional
  // "recommended" jobs no matter what was actually live, and saving one
  // wrote a mock id into savedJobIds that could never match anything in
  // the real Jobs board's Saved tab (reported directly: "only happens
  // when I save a job from home page... from the jobs page it's fine").
  // Real jobs fetched here the same way pages/Jobs.jsx does (same
  // fetchAllRows + matchJob + realJobToCardShape pipeline) so the two
  // pages agree on what a "real job" and its match score even are.
  const classYear = resolvedClassYear(currentUser, profileOverrides);
  const gradMonth = resolvedGradMonth(currentUser, profileOverrides);
  // The shared hook (data/useRealJobs.js) runs the same active-jobs fetch this
  // page used to inline. realJobs (active only) feeds Recommended; allKnownJobs
  // also includes tracked jobs that have since closed, so those still resolve
  // (shown as closed) instead of dropping out of the member's own progress.
  const { realJobs, allKnownJobs, jobsLoading } = useRealJobs(preferences, classYear, gradMonth, true, Object.keys(trackedJobs));

  // Real feed posts (same pipeline pages/Feed.jsx itself uses) -- this
  // preview used to always show the same 2 mock FEED_POSTS regardless of
  // what anyone had actually posted, even after Feed.jsx itself went real.
  const [recentPosts, setRecentPosts] = useState([]);
  useEffect(() => {
    fetchFeedPosts()
      .then((rows) => setRecentPosts(rows.slice(0, 2).map(feedRowToPost)))
      .catch(() => {}); // Preview degrades to "nothing recent" rather than crashing Home
  }, []);

  // Real members who've opted in via MyProfile.jsx's "Open to coffee chat
  // requests from members" setting -- was mockPeople.js's 13 fictional
  // people, filtered by an openToCoffeeChats flag real people always
  // default false for (no real consent signal existed for the real 207-
  // person directory import). This is that real signal, finally surfaced.
  const [openToCoffeeChat, setOpenToCoffeeChat] = useState([]);
  useEffect(() => {
    listOpenToCoffeeChatMembers()
      .then(setOpenToCoffeeChat)
      .catch(() => {});
  }, []);

  // Tracked jobs can be either a real one (a real UUID, once a real
  // "add to tracker" entry point exists) or one of the seeded demo
  // entries in data/store.jsx's SEED_TRACKED_JOBS (legitimately mock
  // ids, meant to keep the tracker non-empty on first load) -- checks
  // real jobs first, falls back to mock, so either kind resolves.
  const trackedEntries = Object.entries(trackedJobs)
    .map(([jobId, info]) => ({
      jobId,
      job:
        allKnownJobs.find((j) => j.id === jobId) ||
        (isManualJobId(jobId) ? jobForManualEntry(jobId, info) : null),
      ...info,
    }))
    .filter((e) => e.job);

  // A member's tracked jobs, preferences and profile load after sign-in. Until they have, "nothing tracked
  // yet" would be a false statement (a returning member on a new device saw the first-login screen flash up),
  // so show a loading frame instead of the empty state.
  // Two things must both have arrived: the member's own data, and the jobs list their tracked ids resolve against.
  if ((memberDataLoading || jobsLoading) && trackedEntries.length === 0) {
    return (
      <div>
        <h1>Home</h1>
        <Skeleton lines={4} />
      </div>
    );
  }

  // First login / nothing tracked yet -- empty state per wireframe 3e.
  if (trackedEntries.length === 0) {
    const { pct } = computeProfileStrength(preferences, profileOverrides.linkedIn, profileOverrides.resumePath);
    return (
      <div className="empty-state">
        <h1>Welcome to UC Portal, {displayName(profileOverrides, accountEmail).split(" ")[0]}</h1>
        {/* profileOverrides?.classYear directly, not resolvedClassYear() --
            that falls back to mockUser.js's fake "2027," which used to
            show on every real member's own welcome message as if it were
            their own confirmed class year the moment they had no override
            set yet. */}
        <p className="meta">
          {profileOverrides?.classYear ? `Class of ${profileOverrides.classYear} · ` : ""}
          new member · nothing tracked yet
        </p>
        <p>You don't need to be recruiting yet to use this. Browse jobs, meet alumni, or start a learning track whenever you're ready.</p>
        <p className="meta">Profile strength: {pct}%</p>
        <div className="empty-state__tiles">
          <div className="empty-state__tile">
            <p style={{ fontWeight: 700 }}>Complete the interest flow</p>
            <p className="meta">Takes 90 seconds and unlocks real recommendations.</p>
            <Link to="/onboarding" className="btn btn-primary">Start</Link>
          </div>
          <div className="empty-state__tile">
            <p style={{ fontWeight: 700 }}>Browse where UC alumni work</p>
            <p className="meta">See which companies have the strongest UC presence.</p>
            <Link to="/companies" className="btn btn-secondary">Browse</Link>
          </div>
          <div className="empty-state__tile">
            <p style={{ fontWeight: 700 }}>Start a learning track</p>
            <p className="meta">Structured prep, start to finish.</p>
            <Link to="/resources" className="btn btn-secondary">Explore</Link>
          </div>
        </div>
      </div>
    );
  }

  const { pct: strengthPct } = computeProfileStrength(preferences, profileOverrides.linkedIn, profileOverrides.resumePath);

  const recommended = [...realJobs].sort((a, b) => b.matchScore - a.matchScore).slice(0, 2);
  // Roles the board listed since the member's last visit that clear the Recommended bar (data/jobVisit.js).
  const newMatchCount = realJobs.filter((j) => j.matchEligible && j.matchScore >= 70 && isNewSince(j, visitBaseline)).length;

  const activeApps = trackedEntries.filter((e) => e.stage !== "Closed");
  const interviewingApps = trackedEntries.filter((e) => ["First round", "Final round"].includes(e.stage));
  // A posting that has closed has no deadline to act on, so it is never "urgent".
  const urgent = (e) => !e.job.closed && isUrgent(e.job);
  const urgentApps = trackedEntries.filter(urgent);
  const attentionNeeded = [...trackedEntries]
    .filter((e) => e.stage !== "Closed")
    .sort((a, b) => (urgent(b) ? 1 : 0) - (urgent(a) ? 1 : 0))
    .slice(0, 3);

  // Recommended actions: computed nudges, not static copy.
  const actions = [];
  const interviewApp = interviewingApps[0];
  if (interviewApp) {
    const hours = prepLogged[interviewApp.jobId] || 0;
    actions.push({
      title: `Prep for your ${interviewApp.job.company} ${interviewApp.stage.toLowerCase()}`,
      detail: `${hours} hrs logged so far`,
      to: `/jobs/${interviewApp.jobId}`,
    });
  }
  if (strengthPct < 100) {
    actions.push({ title: "Finish your profile", detail: `${strengthPct}% complete`, to: "/profile" });
  }
  // Was a "Meet X at [followed company]" nudge matched against
  // mockPeople.js -- real accounts (member_preferences/profiles) carry no
  // company field at all (that lives on the separate, unlinked `people`
  // directory), so there's no real equivalent to match on; dropped rather
  // than faked. The rail below covers the real "who's open to meet"
  // signal instead, just without a company tie-in.
  actions.push({ title: "Update your interests", detail: "Last confirmed this spring. Takes 90 seconds", to: "/onboarding" });

  const suggestedPeople = openToCoffeeChat.slice(0, 3);

  const upcomingDeadlines = [...trackedEntries]
    .filter((e) => e.stage !== "Closed" && !e.job.rolling && !e.job.closed)
    .sort((a, b) => new Date(a.job.deadlineDate) - new Date(b.job.deadlineDate))
    .slice(0, 4);

  return (
    <div>
      <div className="welcome-card">
        <div>
          <div className="welcome-card__greeting">
            <div className="avatar-card__avatar" style={{ margin: 0 }}>
              <Avatar name={displayName(profileOverrides, accountEmail)} url={profileOverrides.avatarUrl} />
            </div>
            <div>
              <h1>Welcome back, {displayName(profileOverrides, accountEmail).split(" ")[0]}</h1>
              {/* Built from profileOverrides directly (not resolvedClassYear/
                  resolvedMajors) and only the facts actually on file --
                  those two fall back to mockUser.js's fake "Class of 2027" /
                  "Business Economics, Data Science," which used to show on
                  every real member's own welcome card as if confirmed. */}
              <p className="welcome-card__subtitle">
                {[
                  profileOverrides?.classYear ? `Class of ${profileOverrides.classYear}` : null,
                  profileOverrides?.majors || null,
                  `Recruiting focus: ${preferences.recruitingCycle || "Not set"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          {preferences.industries.length > 0 && (
            <div className="pref-summary-row">
              <span className="pref-summary-row__label">Industries</span>
              <div className="chip-row" style={{ marginBottom: 0 }}>
                {preferences.industries.map((i) => (
                  <span className="chip" key={i}>{i}</span>
                ))}
              </div>
            </div>
          )}
          {preferences.locations.length > 0 && (
            <div className="pref-summary-row">
              <span className="pref-summary-row__label">Locations</span>
              <div className="chip-row" style={{ marginBottom: 0 }}>
                {preferences.locations.map((l) => (
                  <span className="chip chip-location" key={l}>
                    <MapPin size={11} strokeWidth={1.5} aria-hidden="true" />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="chip-row" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
            <Link to="/profile" className="chip chip-accent" style={{ textDecoration: "none" }}>
              Edit preferences
            </Link>
          </div>
        </div>
        <div className="welcome-card__strength">
          <div className="strength-percent">{strengthPct}%</div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${strengthPct}%` }} />
          </div>
          <p className="meta" style={{ marginBottom: 0 }}>Profile strength</p>
        </div>
      </div>

      <div className="home-layout">
        <div className="home-main">
          <div className="section-header">
            <h2>Recommended for you</h2>
            <Link to="/jobs">Based on your interests · View all {realJobs.length}</Link>
          </div>
          {!jobsLoading && newMatchCount > 0 && (
            <p className="meta" style={{ marginTop: 0 }}>
              <Link to="/jobs?tab=new">
                {newMatchCount} new role{newMatchCount === 1 ? "" : "s"} matched your profile since your last visit
              </Link>
            </p>
          )}
          <div className="recommended-grid">
            {jobsLoading ? (
              <p className="meta">Loading…</p>
            ) : (
              recommended.map((job) => (
                <JobCard key={job.id} job={job} saved={savedJobIds.includes(job.id)} onToggleSave={toggleSavedJob} />
              ))
            )}
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Recruiting progress</h2>
            <div className="stat-strip">
              <div className="stat-strip__cell">
                <div className="stat-strip__number">{activeApps.length}</div>
                <div className="stat-strip__label">Applications in progress</div>
              </div>
              <div className="stat-strip__cell">
                <div className="stat-strip__number">{interviewingApps.length}</div>
                <div className="stat-strip__label">Upcoming interviews</div>
              </div>
              <div className="stat-strip__cell">
                <div className="stat-strip__number">{urgentApps.length}</div>
                <div className="stat-strip__label">Need action this week</div>
              </div>
              <div className="stat-strip__cell">
                <div className="stat-strip__number">{savedJobIds.length}</div>
                <div className="stat-strip__label">Saved jobs</div>
              </div>
            </div>
            {attentionNeeded.map((e) => (
              <div className="progress-app-row" key={e.jobId}>
                <span className="status-dot" />
                <div className="progress-app-row__body">
                  <strong>{e.job.company}</strong> · {e.job.role}
                  <div className="progress-app-row__timing">{deadlineLabel(e.job)}</div>
                </div>
                <span className="chip">{e.stage}</span>
                <Link to={`/jobs/${e.jobId}`} className="btn btn-secondary">
                  {nextActionForStage(e.stage)}
                </Link>
              </div>
            ))}
          </div>

          <div className="section-header">
            <h2>From the UC feed</h2>
            <Link to="/feed">View feed</Link>
          </div>
          {recentPosts.length === 0 && (
            <p className="meta" style={{ margin: 0 }}>
              Nothing posted yet. Be the first to share something with UC.
            </p>
          )}
          {recentPosts.map((post) => (
            <div className="feed-preview-card" key={post.id}>
              <div className="post-card__header">
                <div className="post-card__avatar">{initials(post.author)}</div>
                <span className="post-card__name">{post.author}</span>
                <span className="chip">{post.roleChip}</span>
              </div>
              <p className="post-card__role-line">
                {post.roleLine ? `${post.roleLine} · ` : ""}
                {post.timestamp}
              </p>
              <p style={{ margin: 0 }}>{post.body}</p>
            </div>
          ))}
        </div>

        <div className="home-rail">
          <div className="rail-card is-accent">
            <div className="rail-card__title">Recommended actions</div>
            {actions.slice(0, 4).map((a) => (
              <Link to={a.to} className="recommended-action-row" key={a.title} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
                <div className="recommended-action-row__title">{a.title}</div>
                <div className="recommended-action-row__detail">{a.detail}</div>
              </Link>
            ))}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Open to a coffee chat</div>
            {suggestedPeople.length === 0 && (
              <p className="meta" style={{ margin: 0 }}>
                No one's turned this on yet. It's a real setting (My Profile → Recruiting Settings) once someone
                does.
              </p>
            )}
            {suggestedPeople.map((p) => (
              <div className="meet-person-row" key={p.member_id}>
                <div style={{ fontWeight: 700 }}>{p.display_name}</div>
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
            <div className="rail-card__title">Deadlines this week</div>
            {upcomingDeadlines.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing due soon.</p>}
            {upcomingDeadlines.map((e) => (
              <div className="deadline-row" key={e.jobId}>
                <span>{deadlineLabel(e.job)}</span>
                <span>{e.job.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
