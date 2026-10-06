import { useEffect, useState } from "react";
import { cancelScheduled, fetchMessages, fetchRecipients } from "../../data/commsSync.js";
import { previewLine } from "../../supabase/functions/_shared/comms/render.ts";
import "../../styles/comms.css";

const CHANNEL_LABEL = { email: "Email", slack: "Slack", imessage: "iMessage" };
const STATUS = {
  scheduled: { text: "Scheduled", cls: "accel-tag" },
  queued: { text: "Queued", cls: "accel-tag accel-tag--optional" },
  sending: { text: "Sending", cls: "accel-tag accel-tag--accelerator" },
  sent: { text: "Sent", cls: "accel-tag accel-tag--good" },
  partial: { text: "Partly sent", cls: "accel-tag accel-tag--flag" },
  failed: { text: "Failed", cls: "accel-tag accel-tag--flag" },
  cancelled: { text: "Cancelled", cls: "accel-tag accel-tag--optional" },
};
const RECIPIENT_STATUS = { queued: "Waiting", sending: "Sending", sent: "Sent", failed: "Failed", skipped: "Skipped", handed_off: "Opened in Messages" };
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

function Recipients({ messageId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetchRecipients(messageId)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [messageId]);
  if (error) return <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>;
  if (rows === null) return <p className="meta">Loading…</p>;
  return (
    <ul className="recipient-list recipient-list--compact">
      {rows.slice(0, 500).map((r) => (
        <li key={r.id}>
          <span>
            {r.name || r.email} <span className="meta">{r.email ?? r.phone ?? ""}</span>
          </span>
          <span className={r.status === "failed" ? "meta comms-fail" : "meta"}>
            {RECIPIENT_STATUS[r.status]}
            {r.error ? `: ${r.error}` : ""}
          </span>
        </li>
      ))}
      {rows.length > 500 && <li className="meta">Showing the first 500.</li>}
    </ul>
  );
}

// Everything that has been sent, is sending, or was handed off, newest first, with the outcome for each recipient.
export function LogsTab({ refreshKey }) {
  const [messages, setMessages] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMessages({ statuses: ["queued", "sending", "sent", "partial", "failed", "cancelled"] })
      .then(setMessages)
      .catch((e) => setError(e.message));
  }, [refreshKey]);

  return (
    <div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {messages === null && <p className="meta">Loading…</p>}
      {messages?.length === 0 && <p className="meta">Nothing has been sent yet.</p>}
      <ul className="comms-list">
        {messages?.map((m) => {
          const status = STATUS[m.status];
          return (
            <li key={m.id} className="comms-list__block">
              <div className="comms-list__row">
                <div className="comms-list__main">
                  <strong>{m.subject || previewLine(m.body, 70)}</strong>
                  <span className="chip">{CHANNEL_LABEL[m.channel]}</span>
                  {m.is_test && <span className="chip">Test</span>}
                  <span className={status.cls}>{status.text}</span>
                  <div className="meta">
                    {when(m.created_at)} · {m.audience_label} · {m.sent_count} of {m.recipient_count} {m.channel === "imessage" ? "opened" : "sent"}
                    {m.failed_count > 0 ? ` · ${m.failed_count} failed` : ""}
                  </div>
                </div>
                <div className="comms-list__actions">
                  <button className="btn-link" onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                    {openId === m.id ? "Hide recipients" : "Recipients"}
                  </button>
                </div>
              </div>
              {openId === m.id && <Recipients messageId={m.id} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Messages waiting for their time. Cancelling one means nobody receives it.
export function ScheduledTab({ refreshKey, onChanged }) {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const load = () =>
    fetchMessages({ statuses: ["scheduled"] })
      .then((rows) => setMessages([...rows].sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [refreshKey]);

  async function cancel(m) {
    if (!window.confirm(`Cancel this message to ${m.recipient_count} ${m.recipient_count === 1 ? "person" : "people"}? Nobody will receive it.`)) return;
    try {
      await cancelScheduled(m.id);
      load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {messages === null && <p className="meta">Loading…</p>}
      {messages?.length === 0 && <p className="meta">Nothing is scheduled.</p>}
      <ul className="comms-list">
        {messages?.map((m) => (
          <li key={m.id}>
            <div className="comms-list__main">
              <strong>{m.subject || previewLine(m.body, 70)}</strong>
              <span className="chip">{CHANNEL_LABEL[m.channel]}</span>
              <div className="meta">
                Goes out {when(m.scheduled_for)} · {m.audience_label} · {m.recipient_count} {m.recipient_count === 1 ? "person" : "people"}
              </div>
            </div>
            <div className="comms-list__actions">
              <button className="btn btn-secondary" onClick={() => cancel(m)}>
                Cancel
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
