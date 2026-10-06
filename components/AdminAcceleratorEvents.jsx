import { useEffect, useMemo, useState } from "react";
import {
  createEvent,
  createEventSeries,
  deleteEvent,
  deleteEventSeries,
  fetchAttendanceForEvent,
  fetchEvents,
  fetchInterns,
  setAttendance,
  updateEvent,
  updateEventSeries,
} from "../data/acceleratorSync.js";
import { MAX_RECURRING_EVENTS, defaultAttendanceMethod, expandRecurrence, formatTime, parseYmd, ymd } from "../data/acceleratorLogic.js";
import AcceleratorEventPhoto from "./AcceleratorEventPhoto.jsx";
import Modal from "./Modal.jsx";
import "../styles/accelerator.css";

const KINDS = [
  { value: "gm", label: "General meeting", required: true },
  { value: "accelerator", label: "Accelerator meeting", required: true },
  { value: "firm", label: "Firm info session", required: true },
  { value: "uc_event", label: "UC event", required: false },
  { value: "social", label: "Social", required: false },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));
const METHOD_LABEL = { admin: "Committee marks attendance", photo: "Interns submit a photo" };
const EMPTY_FORM = {
  title: "",
  eventDate: "",
  startTime: "",
  kind: "gm",
  required: true,
  attendanceMethod: "admin",
  location: "",
  description: "",
  repeat: "none",
  repeatEnd: "",
  applyToSeries: false,
};

const REPEAT_WEEKS = { weekly: 1, biweekly: 2 };

function dayRange(dates) {
  const fmt = (key) => parseYmd(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return dates.length > 1 ? `${fmt(dates[0])} to ${fmt(dates[dates.length - 1])}` : fmt(dates[0]);
}

// The add/edit form, in a dialog so it is the only thing on screen while it is open.
function EventModal({ editing, seriesCount, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    editing
      ? {
          ...EMPTY_FORM,
          title: editing.title,
          eventDate: editing.event_date,
          startTime: editing.start_time ? editing.start_time.slice(0, 5) : "",
          kind: editing.kind,
          required: editing.required,
          attendanceMethod: editing.attendance_method,
          location: editing.location || "",
          description: editing.description || "",
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const repeating = !editing && form.repeat !== "none";
  const dates = useMemo(
    () => (repeating && form.eventDate && form.repeatEnd ? expandRecurrence(form.eventDate, form.repeatEnd, REPEAT_WEEKS[form.repeat]) : []),
    [repeating, form.eventDate, form.repeatEnd, form.repeat]
  );
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function setKind(kind) {
    // Picking a type sets its usual required flag and how attendance is taken; both can still be changed after.
    set({ kind, required: KINDS.find((k) => k.value === kind).required, attendanceMethod: defaultAttendanceMethod(kind) });
  }

  async function save() {
    setError(null);
    if (!form.title.trim() || !form.eventDate) {
      setError("Title and date are required.");
      return;
    }
    if (repeating) {
      if (!form.repeatEnd) {
        setError("Choose the date the series ends.");
        return;
      }
      if (form.repeatEnd < form.eventDate) {
        setError("The end date can't be before the start date.");
        return;
      }
    }
    setSaving(true);
    try {
      if (editing) {
        if (form.applyToSeries && editing.series_id) await updateEventSeries(editing.series_id, form);
        await updateEvent(editing.id, form);
      } else if (repeating) {
        await createEventSeries(form, dates);
      } else {
        await createEvent(form);
      }
      await onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const label = editing ? "Edit event" : "Add an event";
  return (
    <Modal
      title={label}
      onClose={onClose}
      width={640}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : repeating && dates.length > 1 ? `Add ${dates.length} events` : "Add event"}
          </button>
        </>
      }
    >
      {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
      <div className="field">
        <label htmlFor="ev-title">Title</label>
        <input id="ev-title" type="text" value={form.title} onChange={(e) => set({ title: e.target.value })} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ev-kind">Type</label>
          <select id="ev-kind" value={form.kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ev-date">{repeating ? "First date" : "Date"}</label>
          <input id="ev-date" type="date" value={form.eventDate} onChange={(e) => set({ eventDate: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="ev-time">Time</label>
          <input id="ev-time" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
        </div>
      </div>
      {form.kind === "accelerator" && !form.startTime && (
        <p className="meta" style={{ marginTop: 0 }}>
          Accelerator meetings close each week's coffee chats, so give this one a time. Without one it closes at the end of the day.
        </p>
      )}

      {!editing && (
        <div className="field-row">
          <div className="field">
            <label htmlFor="ev-repeat">Repeats</label>
            <select id="ev-repeat" value={form.repeat} onChange={(e) => set({ repeat: e.target.value })}>
              <option value="none">Doesn't repeat</option>
              <option value="weekly">Every week</option>
              <option value="biweekly">Every 2 weeks</option>
            </select>
          </div>
          {repeating && (
            <div className="field">
              <label htmlFor="ev-end">Ends on</label>
              <input id="ev-end" type="date" value={form.repeatEnd} min={form.eventDate} onChange={(e) => set({ repeatEnd: e.target.value })} />
            </div>
          )}
        </div>
      )}
      {repeating && dates.length > 0 && (
        <p className="meta" style={{ marginTop: 0 }}>
          {dates.length} event{dates.length === 1 ? "" : "s"}, {dayRange(dates)}, on {parseYmd(dates[0]).toLocaleDateString(undefined, { weekday: "long" })}s.
          {dates.length === MAX_RECURRING_EVENTS && ` Capped at ${MAX_RECURRING_EVENTS}; shorten the end date if that's more than you want.`}
        </p>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="ev-method">Attendance</label>
          <select id="ev-method" value={form.attendanceMethod} onChange={(e) => set({ attendanceMethod: e.target.value })}>
            <option value="admin">{METHOD_LABEL.admin}</option>
            <option value="photo">{METHOD_LABEL.photo}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ev-location">Location</label>
          <input id="ev-location" type="text" value={form.location} onChange={(e) => set({ location: e.target.value })} />
        </div>
      </div>
      <div className="checkbox-row">
        <input id="ev-required" type="checkbox" checked={form.required} onChange={() => set({ required: !form.required })} />
        <label htmlFor="ev-required">Required (counts toward each intern's attendance)</label>
      </div>
      {editing?.series_id && (
        <div className="checkbox-row" style={{ marginTop: "var(--space-3)" }}>
          <input id="ev-series" type="checkbox" checked={form.applyToSeries} onChange={() => set({ applyToSeries: !form.applyToSeries })} />
          <label htmlFor="ev-series">
            Apply these changes (not the date) to all {seriesCount} events in this series
          </label>
        </div>
      )}
    </Modal>
  );
}

// Marking who came: "Not recorded" (no row), "Attended" or "Absent". An intern's own tracker reads these, and a
// photo an intern submitted shows beside their name, where the committee can confirm it or change the mark.
function AttendancePanel({ event }) {
  const [interns, setInterns] = useState(null);
  const [records, setRecords] = useState(new Map());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchInterns(), fetchAttendanceForEvent(event.id)])
      .then(([i, a]) => {
        if (cancelled) return;
        setInterns(i);
        setRecords(new Map(a.map((r) => [r.profile_id, r])));
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  async function mark(profileId, value) {
    setError(null);
    try {
      await setAttendance(event.id, profileId, value);
      setRecords((prev) => {
        const next = new Map(prev);
        const existing = prev.get(profileId);
        if (value === null) next.delete(profileId);
        else next.set(profileId, { ...existing, profile_id: profileId, attended: value, source: "admin" });
        return next;
      });
    } catch (e) {
      setError(e.message);
    }
  }

  async function markAllAttended() {
    setBusy(true);
    setError(null);
    try {
      for (const intern of interns) {
        if (!records.has(intern.memberId)) await mark(intern.memberId, true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "var(--space-4) var(--space-5)", background: "var(--color-ground)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, margin: 0 }}>Attendance</p>
          <p className="meta" style={{ margin: 0 }}>{METHOD_LABEL[event.attendance_method]}</p>
        </div>
        {interns && interns.length > 0 && (
          <button type="button" className="btn btn-secondary" onClick={markAllAttended} disabled={busy}>
            Mark everyone not yet recorded as attended
          </button>
        )}
      </div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {interns === null && <p className="meta">Loading…</p>}
      {interns?.length === 0 && <p className="meta">No intern accounts yet.</p>}
      {interns?.map((intern) => {
        const record = records.get(intern.memberId);
        const value = record === undefined ? "" : record.attended ? "yes" : "no";
        return (
          <div key={intern.memberId} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-2) 0" }}>
            {record?.photo_path && <AcceleratorEventPhoto path={record.photo_path} />}
            <span style={{ flex: 1, minWidth: 0 }}>
              {intern.displayName} <span className="meta">({intern.email})</span>
              {record?.source === "photo" && <span className="accel-tag" style={{ marginLeft: "var(--space-3)" }}>Photo submitted</span>}
            </span>
            <select
              aria-label={`Attendance for ${intern.displayName}`}
              value={value}
              onChange={(e) => mark(intern.memberId, e.target.value === "" ? null : e.target.value === "yes")}
            >
              <option value="">Not recorded</option>
              <option value="yes">Attended</option>
              <option value="no">Absent</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAcceleratorEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { editing: event | null }
  const [openId, setOpenId] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setEvents(await fetchEvents());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const todayKey = ymd(new Date());
  const seriesCounts = useMemo(() => {
    const counts = new Map();
    for (const e of events) if (e.series_id) counts.set(e.series_id, (counts.get(e.series_id) ?? 0) + 1);
    return counts;
  }, [events]);
  const visible = showPast ? events : events.filter((e) => e.event_date >= todayKey);
  const pastCount = events.length - events.filter((e) => e.event_date >= todayKey).length;

  async function remove(event) {
    if (!window.confirm(`Delete "${event.title}" on ${parseYmd(event.event_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}? Its attendance records go with it.`)) return;
    try {
      await deleteEvent(event.id);
      if (openId === event.id) setOpenId(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeSeries(event) {
    const n = seriesCounts.get(event.series_id);
    if (!window.confirm(`Delete all ${n} events in the "${event.title}" series, past and future? Their attendance records go with them.`)) return;
    try {
      await deleteEventSeries(event.series_id);
      setOpenId(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="detail-section">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <p style={{ fontWeight: 700, margin: 0, flex: 1 }}>Calendar events and attendance</p>
        <button className="btn btn-primary" onClick={() => setModal({ editing: null })}>
          Add event
        </button>
      </div>
      <p className="meta">
        What appears on the interns' calendar: GMs, accelerator meetings, firm info sessions, UC events and socials. Weekly meetings can repeat
        until an end date. Required events count toward each intern's attendance. Weekly lessons show on the calendar automatically, and
        accelerator meetings are what close each week's coffee chats.
      </p>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div>
        {loading && <p className="meta">Loading…</p>}
        {!loading && events.length === 0 && <p className="meta">No events yet. Add the first one.</p>}
        {!loading && events.length > 0 && visible.length === 0 && <p className="meta">No upcoming events.</p>}
        {visible.map((event) => {
          const date = parseYmd(event.event_date);
          const seriesCount = event.series_id ? seriesCounts.get(event.series_id) : 0;
          return (
            <div key={event.id}>
              <div className="accel-event">
                <div className={`accel-event__date${event.required ? " is-required" : ""}`}>
                  <span className="accel-event__dow">{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <span className="accel-event__day">{date.getDate()}</span>
                </div>
                <div className="accel-event__body">
                  <div className="accel-event__title">{event.title}</div>
                  <div className="accel-event__meta">
                    {[date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }), event.start_time ? formatTime(event.start_time) : null, event.location, KIND_LABEL[event.kind]]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="accel-event__meta">
                    {METHOD_LABEL[event.attendance_method]}
                    {seriesCount > 1 && ` · one of ${seriesCount} in a series`}
                  </div>
                </div>
                <span className={`accel-tag${event.required ? "" : " accel-tag--optional"}`}>{event.required ? "Required" : "Optional"}</span>
                <button className="btn btn-secondary" onClick={() => setOpenId(openId === event.id ? null : event.id)}>
                  {openId === event.id ? "Close" : "Attendance"}
                </button>
                <button className="btn-link" onClick={() => setModal({ editing: event })}>
                  Edit
                </button>
                <button className="btn-link" onClick={() => remove(event)}>
                  Delete
                </button>
                {seriesCount > 1 && (
                  <button className="btn-link" onClick={() => removeSeries(event)}>
                    Delete series
                  </button>
                )}
              </div>
              {openId === event.id && <AttendancePanel event={event} />}
            </div>
          );
        })}
        {pastCount > 0 && (
          <button className="btn-link" style={{ marginTop: "var(--space-3)" }} onClick={() => setShowPast((v) => !v)}>
            {showPast ? "Hide past events" : `Show ${pastCount} past event${pastCount === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {modal && (
        <EventModal
          editing={modal.editing}
          seriesCount={modal.editing?.series_id ? seriesCounts.get(modal.editing.series_id) : 0}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
