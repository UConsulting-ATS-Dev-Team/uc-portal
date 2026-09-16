import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "../data/store.jsx";
import { buildNotifications } from "../data/notificationUtils.js";
import { JOBS as MOCK_JOBS } from "../data/mockJobs.js";
import { useRealJobs } from "../data/useRealJobs.js";
import { currentUser } from "../data/mockUser.js";
import { resolvedClassYear } from "../data/profileUtils.js";
import { deadlineLabel } from "../data/jobUtils.js";
import { supabase } from "../data/supabaseClient.js";
import { fetchFeedPosts } from "../data/feedSync.js";
import { fetchConversations } from "../data/messagesSync.js";
import PullToRefresh from "../components/PullToRefresh.jsx";
import "../styles/jobs.css";
import "../styles/jobDetail.css";
import "../styles/onboarding.css";
import "../styles/notifications.css";

const TABS = ["Needs action", "Deadlines", "Network", "Jobs", "UC announcements", "All"];
const TAB_TO_CATEGORY = { "UC announcements": "Announcements" };

// data/notificationUtils.js's needsAction ids follow "deadline-<jobId>",
// "prep-<jobId>", or "chat-<personId>" -- real ids, not decorative, so
// the action buttons ("Apply", "Prep now", "Follow up", etc.) can route
// somewhere real instead of being dead buttons with no onClick at all.
// Every action on a given notification goes to the same relevant page
// (the tracked job, or the contact) -- an honest "go handle this" link,
// not a simulation of what each specific label (e.g. "Snooze") would do
// on a real backend, which doesn't exist here.
function actionHref(notificationId) {
  if (notificationId.startsWith("deadline-")) return `/jobs/${notificationId.slice("deadline-".length)}`;
  if (notificationId.startsWith("prep-")) return `/jobs/${notificationId.slice("prep-".length)}`;
  if (notificationId.startsWith("chat-")) return `/network/${notificationId.slice("chat-".length)}`;
  return null;
}

const SETTINGS_COPY = [
  { key: "deadlineReminders", label: "Deadline reminders 3 days out" },
  { key: "newMatchedJobs", label: "New matched jobs" },
  { key: "alumniReplies", label: "Alumni replies" },
  { key: "allFeedActivity", label: "All feed activity" },
  { key: "weeklyDigest", label: "Weekly digest" },
];

export default function Notifications() {
  const { trackedJobs, prepLogged, coffeeChatStatus, savedJobIds, notificationSettings, updateNotificationSetting, preferences, profileOverrides } = useAppState();
  const [tab, setTab] = useState("Needs action");

  // Same real-first/mock-fallback lookup as every other trackedJobs
  // consumer -- a real tracked job's deadline/prep notifications used to
  // silently never fire, since buildNotifications() only ever checked
  // data/mockJobs.js internally.
  const classYear = resolvedClassYear(currentUser, profileOverrides);
  const { realJobs } = useRealJobs(preferences, classYear);

  // Real feed posts + real conversations, fetched once on mount -- closes
  // the "Expand general notifications" quick win by replacing the old
  // hardcoded "Earlier this week" array (see data/notificationUtils.js's
  // own comment). Degrades to "nothing new to show" rather than crashing
  // if either fetch fails, same pattern realJobs' own .catch(() => {})
  // already uses.
  const [feedPosts, setFeedPosts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentAccountId, setCurrentAccountId] = useState(null);
  // Shared by the mount fetch and pull-to-refresh. trackedJobs/prepLogged/
  // coffeeChatStatus/savedJobIds are already live from the store, and
  // realJobs has its own fetch-on-mount -- feed posts and conversations
  // are the two sources that genuinely go stale while sitting on this
  // page, since they change from another member's action, not this one.
  function refreshNotificationSources() {
    return Promise.all([fetchFeedPosts().then(setFeedPosts), fetchConversations().then(setConversations)]).catch(() => {});
  }

  useEffect(() => {
    refreshNotificationSources();
    supabase.auth.getUser().then(({ data }) => setCurrentAccountId(data?.user?.id ?? null));
  }, []);

  const { needsAction, earlierThisWeek } = useMemo(
    () => buildNotifications({ trackedJobs, prepLogged, coffeeChatStatus, realJobs, savedJobIds, feedPosts, conversations, currentAccountId }),
    [trackedJobs, prepLogged, coffeeChatStatus, realJobs, savedJobIds, feedPosts, conversations, currentAccountId]
  );

  const category = TAB_TO_CATEGORY[tab] || tab;
  const visibleNeedsAction =
    tab === "All" || tab === "Needs action" ? needsAction : needsAction.filter((n) => n.category === category);
  const visibleEarlier = tab === "Needs action" ? [] : tab === "All" ? earlierThisWeek : earlierThisWeek.filter((n) => n.category === category);

  const upcoming = Object.entries(trackedJobs)
    .map(([jobId, info]) => ({ job: realJobs.find((j) => j.id === jobId) || MOCK_JOBS.find((j) => j.id === jobId), ...info }))
    .filter((e) => e.job && e.stage !== "Closed" && !e.job.rolling)
    .sort((a, b) => new Date(a.job.deadlineDate) - new Date(b.job.deadlineDate))
    .slice(0, 4);

  return (
    <PullToRefresh onRefresh={refreshNotificationSources}>
    <div>
      <h1>Notifications</h1>

      <div className="jobs-tabs" style={{ marginBottom: "var(--space-6)" }}>
        <div className="jobs-tabs__list">
          {TABS.map((t) => (
            <button key={t} className={`jobs-tabs__tab${tab === t ? " is-active" : ""}`} onClick={() => setTab(t)}>
              {t}
              {t === "Needs action" && ` (${needsAction.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          {visibleNeedsAction.length > 0 && (
            <>
              <p style={{ fontWeight: 700 }}>Needs action</p>
              {visibleNeedsAction.map((n) => (
                <div className="notif-needs-action" key={n.id}>
                  <span className="notif-icon">{n.icon}</span>
                  <div className="notif-needs-action__body">
                    <div className="notif-needs-action__headline">{n.headline}</div>
                    <div className="notif-needs-action__detail">{n.detail}</div>
                    <div className="notif-needs-action__actions">
                      {n.actions.map((a) => {
                        const href = actionHref(n.id);
                        return href ? (
                          <Link to={href} className="btn btn-secondary" key={a}>
                            {a}
                          </Link>
                        ) : (
                          // Defensive fallback -- every real needsAction id
                          // (data/notificationUtils.js) currently matches
                          // one of actionHref's three prefixes, so this
                          // shouldn't be reachable today, but stays honest
                          // rather than a silent dead click if that ever
                          // changes.
                          <button className="btn btn-secondary" key={a} disabled title="Not wired up yet">
                            {a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {visibleEarlier.length > 0 && (
            <>
              <p style={{ fontWeight: 700, marginTop: "var(--space-6)" }}>Earlier this week</p>
              {visibleEarlier.map((n) => (
                <div className="notif-earlier-row" key={n.id}>
                  <span className="notif-icon">{n.source[0]}</span>
                  {n.href ? <Link to={n.href}>{n.headline}</Link> : <span>{n.headline}</span>}
                  <span className="notif-earlier-row__source">
                    {n.source} · {n.age}
                  </span>
                </div>
              ))}
            </>
          )}

          {visibleNeedsAction.length === 0 && visibleEarlier.length === 0 && (
            <div className="skeleton-card" style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
              Nothing here right now.
            </div>
          )}
        </div>

        <div className="detail-rail">
          <div className="rail-card">
            <div className="rail-card__title">This week at a glance</div>
            {upcoming.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing due soon.</p>}
            {upcoming.map((e) => (
              <div className="week-glance-row" key={e.job.id}>
                <span>{deadlineLabel(e.job)}</span>
                <span>{e.job.role}</span>
              </div>
            ))}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Notification settings</div>
            {SETTINGS_COPY.map((s) => (
              <div className="checkbox-row" key={s.key}>
                <input
                  type="checkbox"
                  id={s.key}
                  checked={notificationSettings[s.key]}
                  onChange={() => updateNotificationSetting(s.key, !notificationSettings[s.key])}
                />
                <label htmlFor={s.key}>{s.label}</label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}
