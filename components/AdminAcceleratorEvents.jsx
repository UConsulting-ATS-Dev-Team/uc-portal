import { useEffect, useState } from "react";
import {
  createEvent,
  deleteEvent,
  fetchAttendanceForEvent,
  fetchEvents,
  fetchInterns,
  setAttendance,
  updateEvent,
} from "../data/acceleratorSync.js";
import { formatTime, parseYmd } from "../data/acceleratorLogic.js";
import "../styles/accelerator.css";

const KINDS = [
  { value: "gm", label: "General meeting", required: true },
  { value: "firm", label: "Firm info session", required: true },
  { value: "accelerator", label: "Accelerator session", required: true },
  { value: "uc_event", label: "UC event", required: false },
  { value: "social", label: "Social", required: false },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));
const EMPTY_FORM = { title: "", eventDate: "", startTime: "", kind: "gm", required: true, location: "", description: "" };

// Marking who came: "Not recorded" (no row), "Attended" or "Absent". An intern's own tracker reads these.
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
        setRecords(new Map(a.map((r) => [r.profile_id, r.attended])));
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
        if (value === null) next.delete(profileId);
        else next.set(profileId, value);
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
        if (records.get(intern.memberId) === undefined) await mark(intern.memberId, true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "var(--space-4) var(--space-5)", background: "var(--color-ground)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-3)" }}>
        <p style={{ fontWeight: 700, margin: 0, flex: 1 }}>Attendance</p>
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
        const value = records.get(intern.memberId);
        return (
          <div key={intern.memberId} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-2) 0" }}>
            <span style={{ flex: 1 }}>
              {intern.displayName} <span className="meta">({intern.email})</span>
            </span>
            <select
              aria-label={`Attendance for ${intern.displayName}`}
              value={value === undefined ? "" : value ? "yes" : "no"}
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
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function load() {
    fetchEvents()
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function setKind(kind) {
    // Picking a kind sets the usual required flag; the checkbox can still be changed after.
    setForm((f) => ({ ...f, kind, required: KINDS.find((k) => k.value === kind).required }));
  }

  function startEdit(event) {
    setEditingId(event.id);
    setForm({
      title: event.title,
      eventDate: event.event_date,
      startTime: event.start_time ? event.start_time.slice(0, 5) : "",
      kind: event.kind,
      required: event.required,
      location: event.location || "",
      description: event.description || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function save() {
    setError(null);
    if (!form.title.trim() || !form.eventDate) {
      setError("Title and date are required.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) await updateEvent(editingId, form);
      else await createEvent(form);
      cancelEdit();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(event) {
    if (!window.confirm(`Delete "${event.title}"? Its attendance records go with it.`)) return;
    try {
      await deleteEvent(event.id);
      if (openId === event.id) setOpenId(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="detail-section">
      <p style={{ fontWeight: 700 }}>Calendar events and attendance</p>
      <p className="meta">
        What appears on the interns' calendar: GMs, firm info sessions, UC events and socials. Required events count toward
        each intern's attendance. Weekly lessons show on the calendar automatically.
      </p>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label>Title</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field" style={{ width: 160 }}>
          <label>Date</label>
          <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
        </div>
        <div className="field" style={{ width: 120 }}>
          <label>Time (optional)</label>
          <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        </div>
        <div className="field" style={{ width: 190 }}>
          <label>Type</label>
          <select value={form.kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label>Location (optional)</label>
          <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="checkbox-row" style={{ alignSelf: "center" }}>
          <input id="event-required" type="checkbox" checked={form.required} onChange={() => setForm({ ...form, required: !form.required })} />
          <label htmlFor="event-required">Required</label>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : editingId ? "Save" : "Add event"}
        </button>
        {editingId && (
          <button className="btn btn-secondary" onClick={cancelEdit}>
            Cancel
          </button>
        )}
      </div>

      <div style={{ marginTop: "var(--space-5)" }}>
        {loading && <p className="meta">Loading…</p>}
        {!loading && events.length === 0 && <p className="meta">No events yet. Add the first one above.</p>}
        {events.map((event) => {
          const date = parseYmd(event.event_date);
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
                </div>
                <span className={`accel-tag${event.required ? "" : " accel-tag--optional"}`}>{event.required ? "Required" : "Optional"}</span>
                <button className="btn btn-secondary" onClick={() => setOpenId(openId === event.id ? null : event.id)}>
                  {openId === event.id ? "Close" : "Attendance"}
                </button>
                <button className="btn-link" onClick={() => startEdit(event)}>
                  Edit
                </button>
                <button className="btn-link" onClick={() => remove(event)}>
                  Delete
                </button>
              </div>
              {openId === event.id && <AttendancePanel event={event} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
