import { useEffect, useState } from "react";
import { fetchAuditLog } from "../data/adminToolsSync.js";
import "../styles/jobDetail.css";
import "../styles/comms.css";
import "../styles/adminTools.css";

const PAGE = 50;

const ROLE = { admin: "admin", member: "member" };
const MEMBERSHIP = { current_member: "current member", alumni: "alumni", intern: "intern" };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const people = (n) => `${n} ${n === 1 ? "person" : "people"}`;

// One plain sentence per recorded action. Details hold counts and field names, never message text or contact details.
function describe(row) {
  const d = row.details ?? {};
  const who = row.target_label || "someone";
  switch (row.action) {
    case "role_changed":
      return `Changed ${who} from ${ROLE[d.from] ?? d.from} to ${ROLE[d.to] ?? d.to}`;
    case "membership_changed":
      return `Changed ${who} from ${MEMBERSHIP[d.from] ?? d.from} to ${MEMBERSHIP[d.to] ?? d.to}`;
    case "account_edited":
      return `Edited ${who}'s ${(d.fields ?? []).join(", ")}`;
    case "account_created":
      return `Added ${who} as ${MEMBERSHIP[d.membership] ?? d.membership}${d.role === "admin" ? " and admin" : ""}`;
    case "account_deactivated":
      return `Deactivated ${who}`;
    case "account_reactivated":
      return `Reactivated ${who}`;
    case "class_rollover":
      return `Moved ${people(d.moved ?? 0)} from ${who} to alumni`;
    case "message_sent":
      return `Sent ${d.channel === "slack" ? "a Slack message" : "an email"} "${who}" to ${people(d.recipients ?? 0)}${d.audience ? ` (${d.audience})` : ""}`;
    case "message_scheduled":
      return `Scheduled ${d.channel === "slack" ? "a Slack message" : "an email"} "${who}" for ${people(d.recipients ?? 0)}${d.scheduledFor ? ` on ${new Date(d.scheduledFor).toLocaleString()}` : ""}`;
    case "message_cancelled":
      return `Cancelled the scheduled message "${who}"`;
    case "imessage_logged":
      return `Texted ${people(d.recipients ?? 0)} from their own phone${d.audience ? ` (${d.audience})` : ""}`;
    case "sender_added":
      return `Added the sender "${who}"`;
    case "sender_removed":
      return `Removed the sender "${who}"`;
    case "contacts_imported":
      return `Imported ${plural(d.count ?? 0, "contact")} to the mailing list`;
    case "contacts_removed":
      return `Removed ${plural(d.count ?? 0, "contact")} from the mailing list`;
    case "contacts_tagged":
      return `Tagged ${plural(d.count ?? 0, "contact")}${(d.added ?? []).length ? ` with ${d.added.join(", ")}` : ""}${(d.removed ?? []).length ? `, removed ${d.removed.join(", ")}` : ""}`;
    case "suppression_added":
      return `Stopped emailing ${who}`;
    case "suppression_removed":
      return `Allowed emails to ${who} again`;
    case "automatic_email_on":
      return `Turned on the automatic email ${who}`;
    case "automatic_email_off":
      return `Turned off the automatic email ${who}`;
    case "automatic_email_reworded":
      return `Reworded the automatic email ${who}`;
    default:
      return row.action.replace(/_/g, " ");
  }
}

const FILTERS = [
  { key: "", label: "Everything" },
  { key: "accounts", label: "Accounts" },
  { key: "messages", label: "Messages" },
  { key: "mailing", label: "Mailing list" },
  { key: "automatic", label: "Automatic emails" },
];

// What admins have done: role and membership changes, deactivations, sends, imports. Written by the database itself, so it can't
// be skipped from the page, and nothing in it can be edited or deleted.
export default function AdminAuditLog() {
  const [group, setGroup] = useState("");
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    fetchAuditLog({ group, limit: PAGE + 1 })
      .then((data) => {
        if (cancelled) return;
        setRows(data.slice(0, PAGE));
        setMore(data.length > PAGE);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [group]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await fetchAuditLog({ group, offset: rows.length, limit: PAGE + 1 });
      setRows((prev) => [...prev, ...data.slice(0, PAGE)]);
      setMore(data.length > PAGE);
    } catch (e) {
      setError(e.message);
    }
    setLoadingMore(false);
  }

  return (
    <div>
      <div className="jobs-header" style={{ marginBottom: "var(--space-5)" }}>
        <div>
          <h1>Audit Log</h1>
          <p className="meta">What admins have done in the portal, newest first. Entries can't be edited or deleted.</p>
        </div>
      </div>

      <div className="user-filters">
        <select aria-label="Filter the log" value={group} onChange={(e) => setGroup(e.target.value)}>
          {FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {rows === null && !error && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <p className="meta">Nothing recorded yet{group ? " in this category" : ""}. Actions taken from now on appear here.</p>}
      {rows?.length > 0 && (
        <ul className="audit-list">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="audit-list__what">{describe(r)}</div>
              <div className="meta">
                {r.actor_name ?? "An admin"} · {new Date(r.at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
            </li>
          ))}
        </ul>
      )}
      {more && (
        <button className="btn btn-secondary" style={{ marginTop: "var(--space-5)" }} onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Show older"}
        </button>
      )}
    </div>
  );
}
