import { useMemo, useState } from "react";
import { submitEventPhoto } from "../data/acceleratorSync.js";
import { addDays, attendanceProgress, attendanceStatus, calendarItems, formatTimeRange, parseYmd, ymd } from "../data/acceleratorLogic.js";
import { useAcceleratorData } from "../data/useAcceleratorData.js";
import AcceleratorEventPhoto from "../components/AcceleratorEventPhoto.jsx";
import AcceleratorTabs from "../components/AcceleratorTabs.jsx";
import "../styles/accelerator.css";

const GROUPS = [
  { key: "gm", title: "General meetings", note: "Required for everyone." },
  { key: "accelerator", title: "Accelerator meetings", note: "Required for everyone." },
  { key: "firm", title: "Firm info sessions", note: "Required for everyone." },
  { key: "social", title: "Socials", note: "Optional, but go to at least one." },
  { key: "other", title: "Other events", note: null },
];

const STATUS = {
  attended: { text: "Attended", className: "accel-tag accel-tag--good" },
  missed: { text: "Missed", className: "accel-tag accel-tag--flag" },
  not_recorded: { text: "Not recorded", className: "accel-tag accel-tag--optional" },
  today: { text: "Today", className: "accel-tag accel-tag--accelerator" },
  upcoming: { text: "Upcoming", className: "accel-tag accel-tag--optional" },
};

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function groupKeyFor(item) {
  return ["gm", "accelerator", "firm", "social"].includes(item.kind) ? item.kind : "other";
}

// Meetings the committee sits in on are marked by the committee. For everything else the intern submits a photo
// from the event: it records them as there, and is how the committee can confirm it when they can't find them.
function PhotoControl({ item, record, started, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setError("That picture is over 10 MB. Choose a smaller one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitEventPhoto(item.id, file);
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const canEdit = !record || record.source === "photo";
  return (
    <div className="accel-event__action">
      {record?.photo_path && <AcceleratorEventPhoto path={record.photo_path} />}
      {started && canEdit && (
        <label className="btn btn-secondary" style={{ cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Uploading…" : record?.photo_path ? "Replace photo" : "Add photo"}
          <input type="file" accept="image/*" onChange={onFile} disabled={busy} style={{ display: "none" }} />
        </label>
      )}
      {error && <span className="meta" style={{ color: "var(--color-danger)" }}>{error}</span>}
    </div>
  );
}

function EventRow({ item, status, record, todayKey, onDone }) {
  const date = parseYmd(item.date);
  const detail = [item.time ? formatTimeRange(item.time, item.endTime) : null, item.location].filter(Boolean).join(" · ");
  const started = item.date <= todayKey;
  return (
    <div className="accel-event">
      <div className={`accel-event__date${item.required ? " is-required" : ""}`}>
        <span className="accel-event__dow">{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <span className="accel-event__day">{date.getDate()}</span>
      </div>
      <div className="accel-event__body">
        <div className="accel-event__title">{item.title}</div>
        <div className="accel-event__meta">
          {date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          {detail && ` · ${detail}`}
        </div>
        <div className="accel-event__meta">
          {item.method === "photo" ? "Add a photo from the event" : "The committee marks attendance"}
          {record?.source === "photo" && " · photo submitted"}
        </div>
      </div>
      {item.method === "photo" && <PhotoControl item={item} record={record} started={started} onDone={onDone} />}
      <span className={status.className}>{status.text}</span>
    </div>
  );
}

export default function AcceleratorAttendance() {
  const { events, attendance, loading, error, reload } = useAcceleratorData();
  const today = useMemo(() => new Date(), []);
  const todayKey = ymd(today);
  const progress = useMemo(() => attendanceProgress(events, attendance, today), [events, attendance, today]);
  const recordByEvent = useMemo(() => new Map(attendance.map((a) => [a.event_id, a])), [attendance]);
  // Lessons are the Assignments page's business; this page is only about events a person goes to.
  const items = useMemo(() => calendarItems(events, []), [events]);
  const [showAll, setShowAll] = useState({});

  // The required events behind "x of y": this week's, plus any earlier one not yet attended, plus what is next if this week has none.
  const required = useMemo(() => {
    const weekStart = ymd(addDays(today, -today.getDay()));
    const weekEnd = ymd(addDays(today, 6 - today.getDay()));
    const req = items.filter((i) => i.required);
    const earlierOpen = req.filter((i) => i.date < weekStart && !progress.attendedIds.has(i.id));
    const thisWeek = req.filter((i) => i.date >= weekStart && i.date <= weekEnd);
    const next = thisWeek.length === 0 ? req.find((i) => i.date > weekEnd) : null;
    return { rows: [...earlierOpen, ...thisWeek], next, empty: thisWeek.length === 0 };
  }, [items, today, progress]);

  return (
    <div>
      <AcceleratorTabs />
      <h1 className="accel-title">Attendance</h1>
      <p className="meta">
        {progress.requiredAttended} of {progress.requiredSoFar} required events attended so far
      </p>
      {!loading && (required.rows.length > 0 || required.next) && (
        <div className="accel-section">
          <h2>Required this week</h2>
          <ul className="accel-required">
            {required.rows.map((item) => {
              const status = STATUS[attendanceStatus({ id: item.id, event_date: item.date }, progress, today)];
              const when = [parseYmd(item.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }), item.time ? formatTimeRange(item.time, item.endTime) : null].filter(Boolean).join(" · ");
              return (
                <li key={item.id}>
                  <span>
                    <strong>{item.title}</strong>
                    <span className="meta"> {when}</span>
                  </span>
                  <span className={status.className}>{status.text}</span>
                </li>
              );
            })}
            {required.empty && required.next && (
              <li>
                <span>
                  <strong>Nothing required this week.</strong>
                  <span className="meta"> Next: {required.next.title}, {parseYmd(required.next.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</span>
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
      {progress.noSocials && (
        <p className="meta" style={{ color: "var(--color-danger)" }}>
          You haven't been to a social yet. They're optional, but you're expected to go to at least one.
        </p>
      )}
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {loading && <p className="meta">Loading…</p>}
      {!loading && items.length === 0 && <p className="meta">No events have been added yet.</p>}

      {GROUPS.map((group) => {
        const groupItems = items.filter((i) => groupKeyFor(i) === group.key);
        if (groupItems.length === 0) return null;
        const attended = groupItems.filter((i) => progress.attendedIds.has(i.id)).length;
        const done = groupItems.filter((i) => i.date <= todayKey);
        const upcoming = groupItems.filter((i) => i.date > todayKey);
        const later = upcoming.slice(1);
        const open = Boolean(showAll[group.key]);
        const visible = [...done, ...upcoming.slice(0, 1), ...(open ? later : [])];
        return (
          <div className="accel-section" key={group.key}>
            <h2>
              {group.title} <span className="meta">{attended} of {groupItems.length}</span>
            </h2>
            {group.note && <p className="meta" style={{ marginTop: 0 }}>{group.note}</p>}
            <div className="accel-weeks" style={{ padding: "0 var(--space-5)" }}>
              {visible.map((item) => (
                <EventRow
                  key={item.id}
                  item={item}
                  status={STATUS[attendanceStatus({ id: item.id, event_date: item.date }, progress, today)]}
                  record={recordByEvent.get(item.id)}
                  todayKey={todayKey}
                  onDone={reload}
                />
              ))}
              {later.length > 0 && (
                <button type="button" className="btn-link accel-more" aria-expanded={open} onClick={() => setShowAll((m) => ({ ...m, [group.key]: !open }))}>
                  {open ? "Hide later events" : `Show ${later.length} more upcoming`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
