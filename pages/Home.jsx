import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
import { JOBS as MOCK_JOBS } from "../data/mockJobs.js";
import { FEED_POSTS } from "../data/mockFeed.js";
import { PEOPLE } from "../data/mockPeople.js";
import { computeProfileStrength, displayName, initialsFromName, resolvedClassYear, resolvedMajors } from "../data/profileUtils.js";
import { deadlineLabel, isUrgent } from "../data/jobUtils.js";
import { nextActionForStage } from "../data/trackerUtils.js";
import { fetchAllRows } from "../data/fetchAllRows.js";
import { matchJob } from "../data/jobMatch.js";
import { realJobToCardShape, JOB_LIST_COLUMNS } from "../data/realJobAdapter.js";
import JobCard from "../components/JobCard.jsx";
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
    savedJobIds,
    toggleSavedJob,
    trackedJobs,
    savedConnections,
    prepLogged,
  } = useAppState();

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
  const [rawJobs, setRawJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  useEffect(() => {
    // JOB_LIST_COLUMNS, not "*" -- same ~58% payload cut as pages/Jobs.jsx's
    // identical fetch (see data/realJobAdapter.js's own comment); this page
    // reads the exact same fields via the same realJobToCardShape/matchJob
    // pipeline, so the trim is safe here for the same reason.
    fetchAllRows("jobs", JOB_LIST_COLUMNS, (q) => q.eq("active", true))
      .then(setRawJobs)
      .catch(() => {}) // Recommended/counts below degrade to "0 real jobs" rather than crashing Home
      .finally(() => setJobsLoading(false));
  }, []);
  const realJobs = useMemo(
    () => rawJobs.map((job) => realJobToCardShape(job, matchJob(job, preferences, classYear))),
    [rawJobs, preferences, classYear]
  );

  // Tracked jobs can be either a real one (a real UUID, once a real
  // "add to tracker" entry point exists) or one of the seeded demo
  // entries in data/store.jsx's SEED_TRACKED_JOBS (legitimately mock
  // ids, meant to keep the tracker non-empty on first load) -- checks
  // real jobs first, falls back to mock, so either kind resolves.
  const trackedEntries = Object.entries(trackedJobs)
    .map(([jobId, info]) => ({ jobId, job: realJobs.find((j) => j.id === jobId) || MOCK_JOBS.find((j) => j.id === jobId), ...info }))
    .filter((e) => e.job);

  // First login / nothing tracked yet -- empty state per wireframe 3e.
  if (trackedEntries.length === 0) {
    const { pct } = computeProfileStrength(preferences, profileOverrides.linkedIn);
    return (
      <div className="empty-state">
        <h1>Welcome to UC Portal, {displayName(currentUser, profileOverrides).split(" ")[0]}</h1>
        <p className="meta">Class of {resolvedClassYear(currentUser, profileOverrides)} · new member · nothing tracked yet</p>
        <p>You don't need to be recruiting yet to use this — browse jobs, meet alumni, or start a learning track whenever you're ready.</p>
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

  const { pct: strengthPct } = computeProfileStrength(preferences, profileOverrides.linkedIn);

  const recommended = [...realJobs].sort((a, b) => b.matchScore - a.matchScore).slice(0, 2);

  const activeApps = trackedEntries.filter((e) => e.stage !== "Closed");
  const interviewingApps = trackedEntries.filter((e) => ["First round", "Final round"].includes(e.stage));
  const urgentApps = trackedEntries.filter((e) => isUrgent(e.job));
  const attentionNeeded = [...trackedEntries]
    .filter((e) => e.stage !== "Closed")
    .sort((a, b) => (isUrgent(b.job) ? 1 : 0) - (isUrgent(a.job) ? 1 : 0))
    .slice(0, 3);

  const recentPosts = FEED_POSTS.slice(0, 2);

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
  const followedWithPeople = preferences.followedCompanies
    .map((c) => ({ company: c, people: PEOPLE.filter((p) => p.company === c) }))
    .find((c) => c.people.length > 0);
  if (followedWithPeople) {
    const person = followedWithPeople.people[0];
    actions.push({ title: `Meet ${person.name} at ${followedWithPeople.company}`, detail: person.role, to: `/network/${person.id}` });
  }
  actions.push({ title: "Update your interests", detail: "Last confirmed this spring — takes 90 seconds", to: "/onboarding" });

  const suggestedPeople = PEOPLE.filter(
    (p) => !savedConnections.includes(p.id) && p.openToCoffeeChats && (p.status === "Alumna" || p.status === "Alumnus")
  ).slice(0, 3);

  const upcomingDeadlines = [...trackedEntries]
    .filter((e) => e.stage !== "Closed" && !e.job.rolling)
    .sort((a, b) => new Date(a.job.deadlineDate) - new Date(b.job.deadlineDate))
    .slice(0, 4);

  return (
    <div>
      <div className="welcome-card">
        <div>
          <div className="welcome-card__greeting">
            <div className="avatar-card__avatar" style={{ margin: 0 }}>{initialsFromName(displayName(currentUser, profileOverrides))}</div>
            <div>
              <h1>Welcome back, {displayName(currentUser, profileOverrides).split(" ")[0]}</h1>
              <p className="welcome-card__subtitle">
                Class of {resolvedClassYear(currentUser, profileOverrides)} · {resolvedMajors(currentUser, profileOverrides)} · Recruiting focus:{" "}
                {preferences.recruitingCycle || "Not set"}
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
                  <strong>{e.job.company}</strong> — {e.job.role}
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
          {recentPosts.map((post) => (
            <div className="feed-preview-card" key={post.id}>
              <div className="post-card__header">
                <div className="post-card__avatar">{initials(post.author)}</div>
                <span className="post-card__name">{post.author}</span>
                <span className="chip">{post.roleChip}</span>
              </div>
              <p className="post-card__role-line">
                {post.roleLine} · {post.timestamp}
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
            <div className="rail-card__title">UC alumni you should meet</div>
            {suggestedPeople.map((p) => (
              <div className="meet-person-row" key={p.id}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div className="meta">{p.role}</div>
                </div>
                <Link to={`/network/${p.id}`} className="btn btn-secondary">Chat</Link>
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
