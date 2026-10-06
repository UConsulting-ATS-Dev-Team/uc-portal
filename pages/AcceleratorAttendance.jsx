import { useMemo } from "react";
import { attendanceProgress, attendanceStatus, calendarItems, formatTime, parseYmd } from "../data/acceleratorLogic.js";
import { useAcceleratorData } from "../data/useAcceleratorData.js";
import AcceleratorTabs from "../components/AcceleratorTabs.jsx";
import "../styles/accelerator.css";

const GROUPS = [
  { key: "gm", title: "General meetings", note: "Required for everyone." },
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

function groupKeyFor(event) {
  return ["gm", "firm", "social"].includes(event.kind) ? event.kind : "other";
}

export default function AcceleratorAttendance() {
  const { events, attendance, loading, error } = useAcceleratorData();
  const today = useMemo(() => new Date(), []);
  const progress = useMemo(() => attendanceProgress(events, attendance, today), [events, attendance, today]);
  // Lessons are the Assignments page's business; this page is only about events a person goes to.
  const items = useMemo(() => calendarItems(events, []), [events]);

  return (
    <div>
      <AcceleratorTabs />
      <h1>Attendance</h1>
      <p className="meta">
        {progress.requiredAttended} of {progress.requiredSoFar} required events attended so far. A committee member marks attendance after each event.
      </p>
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
        return (
          <div className="accel-section" key={group.key}>
            <h2>
              {group.title} <span className="meta">{attended} of {groupItems.length}</span>
            </h2>
            {group.note && <p className="meta" style={{ marginTop: 0 }}>{group.note}</p>}
            <div className="accel-weeks" style={{ padding: "0 var(--space-5)" }}>
              {groupItems.map((item) => {
                const status = STATUS[attendanceStatus({ id: item.id, event_date: item.date }, progress, today)];
                const date = parseYmd(item.date);
                const detail = [item.time ? formatTime(item.time) : null, item.location].filter(Boolean).join(" · ");
                return (
                  <div className="accel-event" key={item.id}>
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
                    </div>
                    <span className={status.className}>{status.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
