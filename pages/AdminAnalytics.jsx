import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { countClientErrorsSince, fetchClientErrors, fetchDaily, fetchEmailStats, fetchEngagement, fetchRangeSummary, fetchTopPages } from "../data/analyticsSync.js";
import TabBar from "../components/admin/TabBar.jsx";
import LineChart from "../components/analytics/LineChart.jsx";
import "../styles/jobDetail.css";
import "../styles/admin.css";
import "../styles/comms.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "engagement", label: "Engagement" },
  { key: "errors", label: "Errors" },
  { key: "email", label: "Email" },
];

const TYPES = [
  { key: "admin", label: "Admins", color: "var(--color-primary)" },
  { key: "member", label: "Members", color: "var(--color-accent)" },
  { key: "alumni", label: "Alumni", color: "var(--color-demo-border)" },
  { key: "intern", label: "Interns", color: "var(--color-neutral)" },
];

const pacificDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

// The last `n` Pacific calendar days, oldest first, as YYYY-MM-DD.
function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(pacificDay(new Date(Date.now() - i * 86400000)));
  return out;
}

const PAGE_LABEL = {
  "/": "Home",
  "/jobs": "Jobs",
  "/jobs/:id": "A job",
  "/applications": "Applications",
  "/network": "Network",
  "/network/:id": "A person's profile",
  "/feed": "Feed",
  "/companies": "Companies",
  "/resources": "Career Resources",
  "/messages": "Messages",
  "/profile": "My Profile",
  "/notifications": "Notifications",
  "/accelerator": "Accelerator",
  "/accelerator/coffee-chats": "Accelerator: coffee chats",
  "/accelerator/attendance": "Accelerator: attendance",
  "/accelerator/assignments": "Accelerator: assignments",
  "/search": "Search",
  "/companies/:id": "A company page",
  "/companies/real/:name": "A company page",
  "/resources/:id": "A resource",
  "/resources/tracks/:id": "A learning track",
  "/admin/members": "User Management",
  "/admin/communications": "Master Communications",
  "/admin/automatic-emails": "Automatic Emails",
  "/admin/analytics": "Site Analytics",
  "/admin/content": "Content",
  "/admin/library": "Library",
  "/admin/accelerator": "Accelerator (admin)",
  "/admin/opportunities": "Job Sources",
  "/admin/system": "Pipeline and Queues",
  "/onboarding": "Onboarding",
};
// Rows recorded before the tracker grouped detail pages hold the raw path, so these prefixes cover those too.
const PREFIX_LABEL = [
  ["/companies/", "A company page"],
  ["/resources/tracks/", "A learning track"],
  ["/resources/", "A resource"],
  ["/network/", "A person's profile"],
  ["/jobs/", "A job"],
];
const pageLabel = (path) => PAGE_LABEL[path] ?? PREFIX_LABEL.find(([prefix]) => path.startsWith(prefix))?.[1] ?? path;

function StatCard({ label, value, note }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value ?? "…"}</div>
      {note && <div className="stat-card__note">{note}</div>}
    </div>
  );
}

function Overview({ days, daily, summary, attention, errorsYesterday, emailYesterday }) {
  const dayList = useMemo(() => lastDays(days), [days]);
  const series = useMemo(
    () =>
      TYPES.map((t) => ({
        name: t.label,
        color: t.color,
        values: dayList.map((d) => daily.find((r) => r.day === d && r.user_type === t.key)?.active_users ?? 0),
      })),
    [daily, dayList]
  );
  const totalOn = (d) => daily.filter((r) => r.day === d);
  const sum = (rows, k) => rows.reduce((n, r) => n + r[k], 0);
  const yesterday = dayList[dayList.length - 2];
  const today = dayList[dayList.length - 1];
  const yRows = totalOn(yesterday);
  const tRows = totalOn(today);

  return (
    <div>
      {attention.length > 0 && (
        <div className="analytics-block">
          <h2 className="analytics-block__title">Needs attention</h2>
          {attention.map((a) => (
            <div key={a.text} className={`attention attention--${a.level}`}>
              <span>{a.text}</span>
              {a.to && (
                <Link to={a.to} className="btn-link">
                  Open
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="analytics-block">
        <h2 className="analytics-block__title">Yesterday</h2>
        <p className="meta">The last full day, with today so far underneath. Days are Pacific time.</p>
        <div className="stat-cards">
          <StatCard label="Active users" value={sum(yRows, "active_users")} note={`Today so far: ${sum(tRows, "active_users")}`} />
          <StatCard label="Page views" value={sum(yRows, "page_views")} note={`Today so far: ${sum(tRows, "page_views")}`} />
          <StatCard label="Errors" value={errorsYesterday} note="Reported from members' browsers" />
          <StatCard label="Emails sent" value={emailYesterday} note="Mass and automatic email" />
        </div>
      </div>

      <div className="analytics-block">
        <h2 className="analytics-block__title">By account type</h2>
        <div className="queue-table__scroll">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>People</th>
                <th>Sessions</th>
                <th>Page views</th>
                <th>Active today</th>
              </tr>
            </thead>
            <tbody>
              {TYPES.map((t) => {
                const row = summary.find((r) => r.user_type === t.key);
                return (
                  <tr key={t.key}>
                    <td>{t.label}</td>
                    <td>{row?.users ?? 0}</td>
                    <td>{row?.sessions ?? 0}</td>
                    <td>{row?.page_views ?? 0}</td>
                    <td>{row?.users_today ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="analytics-block">
        <h2 className="analytics-block__title">Active users by type</h2>
        <LineChart days={dayList} series={series} label="Active users per day by account type" />
      </div>
    </div>
  );
}

function EngagementTab({ days }) {
  const [pages, setPages] = useState(null);
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetchTopPages(days).then(setPages).catch((e) => setError(e.message));
    fetchEngagement().then(setPeople).catch((e) => setError(e.message));
  }, [days]);

  return (
    <div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="analytics-block">
        <h2 className="analytics-block__title">Most visited pages</h2>
        <div className="queue-table__scroll">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Views</th>
                <th>People</th>
              </tr>
            </thead>
            <tbody>
              {pages === null && (
                <tr>
                  <td colSpan={3} className="meta">Loading…</td>
                </tr>
              )}
              {pages?.length === 0 && (
                <tr>
                  <td colSpan={3} className="meta">No page views recorded in this range yet.</td>
                </tr>
              )}
              {pages?.map((p) => (
                <tr key={p.path}>
                  <td>{pageLabel(p.path)} <span className="meta">{pageLabel(p.path) === p.path ? "" : p.path}</span></td>
                  <td>{p.views}</td>
                  <td>{p.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="analytics-block">
        <h2 className="analytics-block__title">Least active members</h2>
        <p className="meta">Presence only: when someone last signed in or used the portal, never what they did.</p>
        <div className="queue-table__scroll">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Last active</th>
                <th>Days inactive</th>
              </tr>
            </thead>
            <tbody>
              {people === null && (
                <tr>
                  <td colSpan={3} className="meta">Loading…</td>
                </tr>
              )}
              {people?.slice(0, 25).map((m) => (
                <tr key={m.member_id}>
                  <td>{m.display_name}</td>
                  <td className="meta">{m.last_active_at ? new Date(m.last_active_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Never"}</td>
                  <td>{m.days_inactive ?? "Never active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ErrorsTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetchClientErrors().then(setRows).catch((e) => setError(e.message));
  }, []);
  return (
    <div className="analytics-block">
      <h2 className="analytics-block__title">Errors from members' browsers</h2>
      <p className="meta">The 50 most recent crashes and failures, including ones members reported themselves.</p>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="queue-table__scroll">
        <table className="queue-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Message</th>
              <th>Page</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={4} className="meta">Loading…</td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={4} className="meta">No errors reported.</td>
              </tr>
            )}
            {rows?.map((e) => (
              <tr key={e.id}>
                <td className="meta">{new Date(e.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td style={{ fontWeight: 700 }}>{e.message}</td>
                <td className="meta">{e.page_path ?? "Unknown"}</td>
                <td>
                  <span className="chip">{e.context}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmailTab({ days }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetchEmailStats(days).then(setStats).catch((e) => setError(e.message));
  }, [days]);

  return (
    <div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="analytics-block">
        <h2 className="analytics-block__title">Email, last {days} days</h2>
        <div className="stat-cards">
          <StatCard label="Delivered to the mail provider" value={stats?.sent} />
          <StatCard label="Failed to send" value={stats?.failed} />
          <StatCard label="Unsubscribed addresses" value={stats?.suppressed} />
          <StatCard label="Mailing-list contacts" value={stats?.contacts} />
        </div>
        <p className="meta">Opens and clicks aren't tracked. Delivery here means the email provider accepted the message.</p>
      </div>
      <div className="analytics-block">
        <h2 className="analytics-block__title">Sends</h2>
        <div className="queue-table__scroll">
          <table className="queue-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Subject</th>
                <th>Audience</th>
                <th>Sent</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              {stats === null && (
                <tr>
                  <td colSpan={5} className="meta">Loading…</td>
                </tr>
              )}
              {stats?.messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="meta">No email has been sent in this range.</td>
                </tr>
              )}
              {stats?.messages.map((m) => (
                <tr key={m.id}>
                  <td className="meta">{new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                  <td>{m.subject}</td>
                  <td className="meta">{m.audience_label}</td>
                  <td>{m.sent_count}</td>
                  <td className={m.failed_count > 0 ? "comms-fail" : ""}>{m.failed_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Who is using the portal and what is going wrong, from our own page-view log, the error reports and the send log. Admins only.
export default function AdminAnalytics() {
  const [tab, setTab] = useState("overview");
  const [days, setDays] = useState(30);
  const [daily, setDaily] = useState([]);
  const [summary, setSummary] = useState([]);
  const [errorsYesterday, setErrorsYesterday] = useState(null);
  const [emailYesterday, setEmailYesterday] = useState(null);
  const [attention, setAttention] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([fetchDaily(days), fetchRangeSummary(days)]);
      setDaily(d);
      setSummary(s);
      setError(null);
      const dayAgo = new Date(Date.now() - 86400000).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [errs, errs7, email7] = await Promise.all([countClientErrorsSince(dayAgo), countClientErrorsSince(weekAgo), fetchEmailStats(7)]);
      setErrorsYesterday(errs);
      setEmailYesterday(email7.messages.filter((m) => new Date(m.created_at) > new Date(dayAgo)).reduce((n, m) => n + m.sent_count, 0));
      const items = [];
      if (email7.failed > 0) items.push({ level: "warn", text: `${email7.failed} email${email7.failed === 1 ? "" : "s"} failed to send in the last 7 days.`, to: "/admin/communications" });
      if (errs > 0) items.push({ level: "warn", text: `${errs} error${errs === 1 ? "" : "s"} reported from members' browsers in the last 24 hours.` });
      else if (errs7 > 0) items.push({ level: "info", text: `${errs7} error${errs7 === 1 ? "" : "s"} reported in the last 7 days.` });
      setAttention(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="jobs-header" style={{ marginBottom: "var(--space-5)" }}>
        <div>
          <h1>Site analytics</h1>
          <p className="meta">Who is using the portal, and what is going wrong. Never an individual's application list.</p>
        </div>
        <div className="jobs-header__actions">
          <div className="range-toggle" role="group" aria-label="Date range">
            {[7, 30, 90].map((n) => (
              <button key={n} type="button" className={days === n ? "is-active" : ""} aria-pressed={days === n} onClick={() => setDays(n)}>
                {n} days
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} strokeWidth={1.5} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <TabBar tabs={TABS} active={tab} onChange={setTab} label="Analytics" />

      {tab === "overview" && <Overview days={days} daily={daily} summary={summary} attention={attention} errorsYesterday={errorsYesterday} emailYesterday={emailYesterday} />}
      {tab === "engagement" && <EngagementTab days={days} />}
      {tab === "errors" && <ErrorsTab />}
      {tab === "email" && <EmailTab days={days} />}
    </div>
  );
}
