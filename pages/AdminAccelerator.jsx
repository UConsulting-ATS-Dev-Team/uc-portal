import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../data/supabaseClient.js";
import {
  fetchLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  fetchMaterials,
  materialHref,
  uploadMaterial,
  addMaterialLink,
  deleteMaterial,
  fetchSubmissionsForLesson,
  fetchInterns,
  fetchInternRoster,
  addInternRosterEntry,
  removeInternRosterEntry,
  bulkAddInternRoster,
  fetchInternProgress,
  fetchInternNames,
  removeInternName,
  fetchMeetingSchedule,
  saveMeetingSchedule,
  fetchEvents,
  createEventSeries,
} from "../data/acceleratorSync.js";
import AdminSubmissions, { ReviewModal } from "../components/AdminSubmissions.jsx";
import AdminAcceleratorEvents from "../components/AdminAcceleratorEvents.jsx";
import Modal from "../components/Modal.jsx";
import CollapsibleSection from "../components/CollapsibleSection.jsx";
import AdminAcceleratorChats from "../components/AdminAcceleratorChats.jsx";
import { MAX_RECURRING_EVENTS, defaultAttendanceMethod, expandRecurrence, formatDue, formatTimeShort, lessonDue, lessonStart, parseYmd, ymd } from "../data/acceleratorLogic.js";
import "../styles/jobDetail.css";
import "../styles/admin.css";

const EMPTY_FORM = { lessonDate: "", title: "", topicOverview: "", dueDate: "", dueTime: "" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// When the accelerator meets each week. Interns' coffee-chat count (3 a week) resets at this day and time.
const plusOneHour = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(h + 1 > 23 ? 59 : m).padStart(2, "0")}`;
};

// The next date on or after today that falls on the given weekday (0 = Sunday), as YYYY-MM-DD.
function nextWeekday(weekday) {
  const d = new Date();
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return ymd(d);
}

// Puts the weekly meeting on the calendar for every week up to an end date, using the day and time saved above. Dates that already
// have an accelerator meeting are left alone, so running it twice doesn't double anything up.
function CreateWeeklyMeetings({ weekday, time, ready, onCreated }) {
  const [endTime, setEndTime] = useState("");
  const [firstDate, setFirstDate] = useState("");
  const [until, setUntil] = useState("");
  const [location, setLocation] = useState("");
  const [existing, setExisting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const loadExisting = () =>
    fetchEvents()
      .then(setExisting)
      .catch((e) => setMessage({ error: true, text: e.message }));
  useEffect(() => {
    loadExisting();
  }, []);

  const end = endTime || plusOneHour(time);
  const first = firstDate || nextWeekday(weekday);
  const dates = until && first <= until ? expandRecurrence(first, until, 1) : [];
  const have = new Set(existing.filter((e) => e.kind === "accelerator").map((e) => e.event_date));
  const toCreate = dates.filter((d) => !have.has(d));
  const skipped = dates.length - toCreate.length;
  const weekdayMismatch = first && parseYmd(first).getDay() !== weekday;
  const fmt = (key) => parseYmd(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  async function create() {
    setMessage(null);
    if (end <= time) return setMessage({ error: true, text: "The end time has to be after the start time." });
    if (!until || until < first) return setMessage({ error: true, text: "Choose a last date on or after the first meeting." });
    if (toCreate.length === 0) return setMessage({ error: true, text: "Every one of those dates already has an accelerator meeting." });
    setBusy(true);
    try {
      await createEventSeries(
        { title: "Accelerator Meeting", eventDate: first, startTime: time, endTime: end, kind: "accelerator", required: true, attendanceMethod: defaultAttendanceMethod("accelerator"), location },
        toCreate
      );
      setMessage({ error: false, text: `Added ${toCreate.length} accelerator meeting${toCreate.length === 1 ? "" : "s"} to the calendar.` });
      setUntil("");
      await loadExisting();
      onCreated?.();
    } catch (e) {
      setMessage({ error: true, text: e.message });
    }
    setBusy(false);
  }

  return (
    <div style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-5)", borderTop: "var(--border-hairline)" }}>
      <p style={{ fontWeight: 700, margin: 0 }}>Add the Weekly Meetings to the Calendar</p>
      <p className="meta">
        Creates an accelerator meeting every {WEEKDAYS[weekday]} at {formatTimeShort(time, end)} until the date you choose. They count as required events.
      </p>
      {!ready && <p className="meta">Save the day and time above first.</p>}
      <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="wk-first">First meeting</label>
          <input id="wk-first" type="date" value={first} onChange={(e) => setFirstDate(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="wk-end-time">Ends at</label>
          <input id="wk-end-time" type="time" value={end} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="wk-until">Repeat until</label>
          <input id="wk-until" type="date" value={until} min={first} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="wk-location">Location (optional)</label>
          <input id="wk-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={create} disabled={busy || !ready || !until || !time}>
          {busy ? "Creating…" : toCreate.length > 0 ? `Create ${toCreate.length} meeting${toCreate.length === 1 ? "" : "s"}` : "Create meetings"}
        </button>
      </div>
      {weekdayMismatch && (
        <p className="meta" style={{ color: "var(--color-danger)" }}>
          {fmt(first)} isn't a {WEEKDAYS[weekday]}, so every meeting would land on a {parseYmd(first).toLocaleDateString(undefined, { weekday: "long" })}. Pick a {WEEKDAYS[weekday]} for the first date.
        </p>
      )}
      {dates.length > 0 && (
        <p className="meta">
          {toCreate.length > 0 ? `${fmt(toCreate[0])} to ${fmt(toCreate[toCreate.length - 1])}` : "Nothing new to add"}
          {skipped > 0 && `. ${skipped} date${skipped === 1 ? " already has" : "s already have"} an accelerator meeting and ${skipped === 1 ? "is" : "are"} skipped`}
          {dates.length >= MAX_RECURRING_EVENTS && `. That's the most that can be added at once (${MAX_RECURRING_EVENTS}), so run it again for later dates`}.
        </p>
      )}
      {message && <p className="meta" style={message.error ? { color: "var(--color-danger)" } : undefined}>{message.text}</p>}
    </div>
  );
}

function MeetingSchedule({ onEventsCreated }) {
  const [weekday, setWeekday] = useState(3);
  const [time, setTime] = useState("18:00");
  const [saved, setSaved] = useState(false);
  const [savedValues, setSavedValues] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchMeetingSchedule()
      .then((s) => {
        if (s) {
          setWeekday(s.weekday);
          setTime(s.time);
          setSaved(true);
          setSavedValues({ weekday: s.weekday, time: s.time });
        }
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await saveMeetingSchedule({ weekday, time });
      setSaved(true);
      setSavedValues({ weekday, time });
      setMessage("Saved.");
    } catch (e) {
      setMessage(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="detail-section">
      <p style={{ fontWeight: 700, margin: 0 }}>Weekly Accelerator Meeting</p>
      <p className="meta">
        Interns owe 3 coffee chats a week, and the count starts over at this day and time. {loaded && !saved && "Not set yet, so weeks run Sunday to Saturday."}
      </p>
      <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="meeting-day">Day</label>
          <select id="meeting-day" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="meeting-time">Time</label>
          <input id="meeting-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving || !time}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {message && <p className="meta">{message}</p>}
      <CreateWeeklyMeetings weekday={weekday} time={time} ready={Boolean(savedValues) && savedValues.weekday === weekday && savedValues.time === time} onCreated={onEventsCreated} />
    </div>
  );
}

function InternRoster() {
  const [entries, setEntries] = useState([]);
  const [names, setNames] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [result, setResult] = useState(null);

  function load() {
    fetchInternRoster().then(setEntries).catch((e) => setError(e.message));
    fetchInternNames().then(setNames).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  function close() {
    setOpen(false);
    setError(null);
    setResult(null);
  }

  // One person from the fields above the divider, and/or a whole cohort pasted below it.
  async function add() {
    if (!email.trim() && !bulkText.trim()) {
      setError("Enter an email, or paste a list.");
      return;
    }
    setAdding(true);
    setError(null);
    setResult(null);
    try {
      let count = 0;
      if (email.trim()) {
        await addInternRosterEntry(email, name);
        count += 1;
      }
      if (bulkText.trim()) count += await bulkAddInternRoster(bulkText);
      setEmail("");
      setName("");
      setBulkText("");
      setResult(`Added or updated ${count} ${count === 1 ? "intern" : "interns"}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function removeName(nameKey) {
    await removeInternName(nameKey);
    load();
  }

  async function remove(entryEmail) {
    await removeInternRosterEntry(entryEmail);
    load();
  }

  // A person listed by email AND by name (the name was added first) is one person: show the email entry only.
  const key = (n) => (n ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const emailNames = new Set(entries.map((e) => key(e.name)).filter(Boolean));
  const nameOnly = names.filter((n) => !emailNames.has(key(n.name)));

  return (
    <>
    <CollapsibleSection
      title="Approved Accounts"
      summary={`${entries.length + nameOnly.length} listed${nameOnly.some((n) => !n.claimed_at) ? `, ${nameOnly.filter((n) => !n.claimed_at).length} by name only and not signed up yet` : ""}`}
    
      action={
        <button className="btn btn-primary btn-add" onClick={() => setOpen(true)}>
          Add interns
        </button>
      }
    >
      <p className="meta">Add an email, or just a name if you don't have one yet. Each entry works for one sign-up.</p>
      {error && !open && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <ul>
        {entries.map((e) => (
          <li key={e.email}>
            {e.name ? `${e.name}, ` : ""}
            {e.email}{" "}
            <button className="btn-link" onClick={() => remove(e.email)}>
              Remove
            </button>
          </li>
        ))}
        {nameOnly.map((n) => (
          <li key={n.name_key}>
            {n.name} <span className="meta">{n.claimed_at ? (n.claimed_as && n.claimed_as.trim().toLowerCase() !== n.name.trim().toLowerCase() ? `signed up as "${n.claimed_as}"` : "signed up") : "listed by name, not signed up yet"}</span>{" "}
            <button className="btn-link" onClick={() => removeName(n.name_key)}>
              Remove
            </button>
          </li>
        ))}
        {entries.length === 0 && nameOnly.length === 0 && <li className="meta">No one on this list yet.</li>}
      </ul>

    </CollapsibleSection>
      {open && (
        <Modal
          title="Add interns"
          onClose={close}
          footer={
            <>
              <button className="btn btn-secondary" onClick={close} disabled={adding}>
                Done
              </button>
              <button className="btn btn-primary" onClick={add} disabled={adding}>
                {adding ? "Adding…" : "Add"}
              </button>
            </>
          }
        >
          {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
          {result && <p className="meta" style={{ marginTop: 0 }}>{result}</p>}
          <div className="field-row">
            <div className="field">
              <label htmlFor="intern-email">Email</label>
              <input id="intern-email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ucla.edu" />
            </div>
            <div className="field">
              <label htmlFor="intern-name">Name (optional)</label>
              <input id="intern-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="intern-bulk">Or paste a whole cohort, one per line: "email", "email, name", or just "name"</label>
            <textarea
              id="intern-bulk"
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"freshman1@ucla.edu, Jane Doe\nfreshman2@ucla.edu\nJane Doe"}
            />
          </div>
        </Modal>
      )}
    </>
  );
}

// A link that opens one intern's work on one lesson (the Accelerator page reads these two query values).
const workLink = (lessonId, memberId) => `/admin/accelerator?lesson=${lessonId}&intern=${memberId}`;

const needsAttention = (p) => p.assignmentsIncomplete > 0 || p.assignmentsMissing > 0 || p.weeksBehindOnChats > 0 || p.noSocials;

function InternProgress() {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [reviewing, setReviewing] = useState(null); // { memberId, name } while the review pop-up is open

  const reload = () => fetchInternProgress().then(setProgress).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="detail-section">
      <p style={{ fontWeight: 700, margin: 0 }}>Intern Progress</p>
      <p className="meta">
        {progress === null
          ? "Loading…"
          : `${progress.length} intern${progress.length === 1 ? "" : "s"}${progress.filter(needsAttention).length ? `, ${progress.filter(needsAttention).length} need attention` : ""}`}
      </p>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="queue-table__scroll">
        <table className="queue-table">
          <thead>
            <tr>
              <th>Intern</th>
              <th>Assignments complete</th>
              <th>Coffee chats</th>
              <th>Required events</th>
              <th>Socials</th>
              <th>Furthest week</th>
              <th>Last submission</th>
            </tr>
          </thead>
          <tbody>
            {progress === null && (
              <tr>
                <td colSpan={7} className="meta">
                  Loading…
                </td>
              </tr>
            )}
            {progress?.length === 0 && (
              <tr>
                <td colSpan={7} className="meta">
                  No real intern accounts have signed up yet.
                </td>
              </tr>
            )}
            {progress?.map((p) => (
              <tr key={p.memberId}>
                <td>
                  {p.displayName} <span className="meta">({p.email})</span>
                </td>
                <td>
                  {p.assignmentsComplete} / {p.totalLessons}
                  {p.assignmentsIncomplete > 0 && <span className="meta" style={{ color: "var(--color-danger)" }}> · {p.assignmentsIncomplete} incomplete</span>}
                  {p.assignmentsAwaiting > 0 && (
                    <span className="meta">
                      {" · "}
                      <button type="button" className="btn-link" onClick={() => setReviewing({ memberId: p.memberId, name: p.displayName })}>
                        {p.assignmentsAwaiting} to review
                      </button>
                    </span>
                  )}
                  {p.assignmentsMissing > 0 && (
                    <span className="meta" style={{ color: "var(--color-danger)" }}>
                      {" · "}
                      <Link to={workLink(p.missingLessonId, p.memberId)} style={{ color: "inherit" }}>{p.assignmentsMissing} missing</Link>
                    </span>
                  )}
                  {p.assignmentsLate > 0 && (
                    <span className="meta">
                      {" · "}
                      <Link to={workLink(p.lateLessonId, p.memberId)}>{p.assignmentsLate} late</Link>
                    </span>
                  )}
                </td>
                <td>
                  {p.chatsCounted} / {p.chatsTarget}
                  {p.weeksBehindOnChats > 0 && <span className="meta" style={{ color: "var(--color-danger)" }}> · {p.weeksBehindOnChats} wk behind</span>}
                </td>
                <td>
                  {p.requiredAttended} / {p.requiredSoFar}
                </td>
                <td>{p.noSocials ? <span style={{ color: "var(--color-danger)" }}>None attended</span> : "OK"}</td>
                <td>{p.highestWeek || "—"}</td>
                <td className="meta">{p.lastSubmittedAt ? new Date(p.lastSubmittedAt).toLocaleDateString() : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reviewing && <ReviewModal memberId={reviewing.memberId} name={reviewing.name} onClose={() => setReviewing(null)} onChanged={reload} />}
    </div>
  );
}

function LessonManager({ lesson, schedule, focusIntern, onChanged }) {
  const [materials, setMaterials] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [namesById, setNamesById] = useState(new Map());
  const [interns, setInterns] = useState([]);
  const [error, setError] = useState(null);

  function loadMaterials() {
    fetchMaterials(lesson.id).then(setMaterials).catch((e) => setError(e.message));
  }
  function loadSubmissions() {
    fetchSubmissionsForLesson(lesson.id)
      .then(setSubmissions)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadMaterials();
    loadSubmissions();
    fetchInterns().then(setInterns).catch(() => {});
    supabase.rpc("list_members").then(({ data }) => {
      setNamesById(new Map((data ?? []).map((m) => [m.member_id, m.display_name === m.email ? m.email : `${m.display_name} (${m.email})`])));
    });
  }, [lesson.id]);

  async function handleUpload(e) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setUploading(true);
    setError(null);
    const failures = [];
    try {
      // One at a time so a bad file doesn't stop the rest; any that failed are named afterwards.
      for (const file of picked) {
        try {
          await uploadMaterial(lesson.id, file);
        } catch (err) {
          failures.push(`${file.name}: ${err.message}`);
        }
      }
      loadMaterials();
      if (failures.length) setError(`Some files didn't upload: ${failures.join("; ")}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteMaterial(m) {
    await deleteMaterial(m);
    loadMaterials();
  }

  async function handleAddLink() {
    if (!linkUrl.trim()) return;
    setAddingLink(true);
    setError(null);
    try {
      await addMaterialLink(lesson.id, linkLabel, linkUrl.trim());
      setLinkLabel("");
      setLinkUrl("");
      loadMaterials();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingLink(false);
    }
  }

  return (
    <div className="detail-section" style={{ marginTop: "var(--space-6)" }}>
      <h2>{lesson.title}</h2>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      <p style={{ fontWeight: 700 }}>Prep material (slideshows, PDFs, links)</p>
      <ul>
        {materials.map((m) => (
          <li key={m.id}>
            <a href={materialHref(m)} target="_blank" rel="noreferrer">
              {m.file_name}
            </a>{" "}
            {m.link_url && <span className="meta">(link)</span>}{" "}
            <button className="btn-link" onClick={() => handleDeleteMaterial(m)}>
              Remove
            </button>
          </li>
        ))}
        {materials.length === 0 && <li className="meta">Nothing added yet.</li>}
      </ul>
      <input type="file" multiple onChange={handleUpload} disabled={uploading} accept=".pdf,.ppt,.pptx,.xls,.xlsx" />

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end", marginTop: "var(--space-4)" }}>
        <div className="field" style={{ flex: "1 1 180px", marginBottom: 0 }}>
          <label>Link label (optional)</label>
          <input type="text" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="e.g. Slide deck" />
        </div>
        <div className="field" style={{ flex: "1 1 260px", marginBottom: 0 }}>
          <label>Link URL</label>
          <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
        </div>
        <button className="btn btn-secondary" onClick={handleAddLink} disabled={addingLink || !linkUrl.trim()}>
          {addingLink ? "Adding…" : "Add link"}
        </button>
      </div>

      <AdminSubmissions lesson={lesson} schedule={schedule} submissions={submissions} interns={interns} namesById={namesById} focusIntern={focusIntern} onGraded={loadSubmissions} />
    </div>
  );
}

// Adding or editing a lesson happens in a dialog so it is the only thing on screen. A new lesson can have its prep
// material queued here: files and links are attached the moment the lesson is created, so adding a lesson and its
// slides is one step instead of a separate hunt for the Manage panel.
function LessonModal({ editing, onClose, onSaved }) {
  const [form, setForm] = useState(
    editing ? { lessonDate: editing.lesson_date, title: editing.title, topicOverview: editing.topic_overview || "", dueDate: editing.due_date || "", dueTime: editing.due_time ? editing.due_time.slice(0, 5) : "" } : EMPTY_FORM
  );
  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingLinks, setPendingLinks] = useState([]);
  const [draftLinkLabel, setDraftLinkLabel] = useState("");
  const [draftLinkUrl, setDraftLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function queueLink() {
    if (!draftLinkUrl.trim()) return;
    setPendingLinks([...pendingLinks, { label: draftLinkLabel, url: draftLinkUrl.trim() }]);
    setDraftLinkLabel("");
    setDraftLinkUrl("");
  }

  async function save() {
    setError(null);
    if (!form.lessonDate || !form.title.trim()) {
      setError("Date and title are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateLesson(editing.id, { lessonDate: form.lessonDate, title: form.title.trim(), topicOverview: form.topicOverview.trim(), dueDate: form.dueDate, dueTime: form.dueTime });
        await onSaved(null, null);
        onClose();
        return;
      }
      const created = await createLesson({ lessonDate: form.lessonDate, title: form.title.trim(), topicOverview: form.topicOverview.trim(), dueDate: form.dueDate, dueTime: form.dueTime });
      // A failed attachment shouldn't lose the lesson that was just created: collect failures and surface them
      // while still opening Manage so the admin can retry from there.
      const failures = [];
      for (const file of pendingFiles) {
        try {
          await uploadMaterial(created.id, file);
        } catch (err) {
          failures.push(`${file.name}: ${err.message}`);
        }
      }
      for (const link of pendingLinks) {
        try {
          await addMaterialLink(created.id, link.label, link.url);
        } catch (err) {
          failures.push(`${link.url}: ${err.message}`);
        }
      }
      await onSaved(created.id, failures.length ? `Lesson added, but some material failed to attach: ${failures.join("; ")}` : null);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit lesson" : "Add a lesson"}
      onClose={onClose}
      width={680}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Add lesson"}
          </button>
        </>
      }
    >
      {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
      <div className="field-row">
        <div className="field">
          <label htmlFor="lesson-date">Week of</label>
          <input id="lesson-date" type="date" value={form.lessonDate} onChange={(e) => setForm({ ...form, lessonDate: e.target.value })} />
          <p className="meta" style={{ margin: "var(--space-2) 0 0" }}>
            The week starts at the accelerator meeting on or after this date and runs until the next one, when the assignment is due.
          </p>
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="lesson-title">Title</label>
          <input id="lesson-title" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="lesson-due-date">Due date (optional)</label>
          <input id="lesson-due-date" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="lesson-due-time">Due time (optional)</label>
          <input id="lesson-due-time" type="time" value={form.dueTime} disabled={!form.dueDate} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} />
        </div>
      </div>
      <p className="meta" style={{ marginTop: 0 }}>
        Leave the due date blank and the assignment is due at that week's accelerator (the weekly meeting day and time set above). Set one to
        make it due earlier, for example to leave time for grading. Either way, the next assignment opens once that accelerator has passed.
      </p>
      <div className="field">
        <label htmlFor="lesson-topic">Instructions</label>
        <textarea id="lesson-topic" rows={6} value={form.topicOverview} onChange={(e) => setForm({ ...form, topicOverview: e.target.value })} placeholder="What the intern should do this week. Shown to them in full; web links become clickable." />
      </div>

      {!editing && (
        <div style={{ marginTop: "var(--space-5)" }}>
          <p style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>Prep material (optional)</p>
          <p className="meta" style={{ marginTop: 0 }}>
            Attach slideshows, PDFs, or spreadsheets, or link to a deck. They're added when you click Add lesson; you can also add or remove
            more later from the lesson's Manage panel.
          </p>
          <input
            type="file"
            multiple
            accept=".pdf,.ppt,.pptx,.xls,.xlsx"
            onChange={(e) => {
              setPendingFiles([...pendingFiles, ...Array.from(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <div className="field-row" style={{ marginTop: "var(--space-4)", alignItems: "flex-end" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="lesson-link-label">Link label (optional)</label>
              <input id="lesson-link-label" type="text" value={draftLinkLabel} onChange={(e) => setDraftLinkLabel(e.target.value)} placeholder="e.g. Slide deck" />
            </div>
            <div className="field" style={{ flex: 2, marginBottom: 0 }}>
              <label htmlFor="lesson-link-url">Link URL</label>
              <input id="lesson-link-url" type="url" value={draftLinkUrl} onChange={(e) => setDraftLinkUrl(e.target.value)} placeholder="https://…" />
            </div>
            <button type="button" className="btn btn-secondary" onClick={queueLink} disabled={!draftLinkUrl.trim()}>
              Add link
            </button>
          </div>
          {(pendingFiles.length > 0 || pendingLinks.length > 0) && (
            <ul style={{ marginTop: "var(--space-2)" }}>
              {pendingFiles.map((f, i) => (
                <li key={`f${i}`}>
                  {f.name}{" "}
                  <button type="button" className="btn-link" onClick={() => setPendingFiles(pendingFiles.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </li>
              ))}
              {pendingLinks.map((l, i) => (
                <li key={`l${i}`}>
                  {l.label || l.url} <span className="meta">(link)</span>{" "}
                  <button type="button" className="btn-link" onClick={() => setPendingLinks(pendingLinks.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function AdminAccelerator() {
  const [eventsVersion, setEventsVersion] = useState(0);
  const [schedule, setSchedule] = useState(null);
  useEffect(() => {
    fetchMeetingSchedule().then(setSchedule).catch(() => {});
  }, [eventsVersion]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lessonModal, setLessonModal] = useState(null); // null | { editing: lesson | null }
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(null);
  // Which intern's work to highlight, only for the visit that came from a link in the progress table.
  const [focus, setFocus] = useState(null); // { lessonId, internId }
  const [error, setError] = useState(null);

  // A link from the progress table (?lesson=<id>&intern=<id>) opens that lesson's panel on that intern's work. The values are
  // used once and then removed from the address, so opening a lesson later by hand doesn't highlight the same person again.
  const linkedLesson = searchParams.get("lesson");
  const linkedIntern = searchParams.get("intern");
  useEffect(() => {
    if (!linkedLesson) return;
    setSelectedId(linkedLesson);
    setFocus({ lessonId: linkedLesson, internId: linkedIntern });
    setSearchParams({}, { replace: true });
  }, [linkedLesson, linkedIntern]);

  function load() {
    setLoading(true);
    return fetchLessons()
      .then(setLessons)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Jump straight into a new lesson's own Manage panel once it is created, so attaching files and links feels like
  // one continuous flow.
  async function lessonSaved(createdId, warning) {
    setError(warning);
    await load();
    if (createdId) setSelectedId(createdId);
  }

  async function removeLesson(lesson) {
    if (!window.confirm(`Delete "${lesson.title}"? This also removes its prep material and every submission for it, and can't be undone.`)) return;
    const id = lesson.id;
    await deleteLesson(id);
    if (selectedId === id) setSelectedId(null);
    load();
  }

  return (
    <div>
      <h1>Accelerator</h1>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      <InternProgress />

      <CollapsibleSection
        title="Lessons"
        summary={loading ? "Loading…" : `${lessons.length} week${lessons.length === 1 ? "" : "s"}`}
        action={
          <button className="btn btn-primary btn-add" onClick={() => setLessonModal({ editing: null })}>
            Add lesson
          </button>
        }
      >
        <p className="meta">Each lesson is due at that week's accelerator.</p>
        {loading && <p className="meta">Loading…</p>}
        {!loading && lessons.length === 0 && <p className="meta">No lessons yet. Add the first one.</p>}
        {lessons.map((lesson, i) => (
          <div key={lesson.id} className={`lesson-card${selectedId === lesson.id ? " is-open" : ""}`}>
            <div className="lesson-card__head">
              <span className="lesson-card__num">{i + 1}</span>
              <div className="lesson-card__main">
                <div className="lesson-card__title">{lesson.title}</div>
                <div className="lesson-card__meta">
                  {schedule
                    ? `Week of ${formatDue(lessonStart(lesson, schedule), true)} · due ${formatDue(lessonDue(lesson, schedule).date, true)}`
                    : `Week of ${new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}
                </div>
              </div>
              {(() => {
                const days = Math.round((new Date(`${lesson.lesson_date}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);
                return days < -6 ? (
                  <span className="accel-tag">Past</span>
                ) : days <= 6 ? (
                  <span className="accel-tag accel-tag--accelerator">This week</span>
                ) : (
                  <span className="accel-tag accel-tag--optional">Upcoming</span>
                );
              })()}
              <div className="lesson-card__actions">
                <button className="btn btn-secondary" onClick={() => {
                  setFocus(null);
                  setSelectedId(selectedId === lesson.id ? null : lesson.id);
                }}>
                  {selectedId === lesson.id ? "Hide Submissions" : "View Submissions"}
                </button>
                <button className="btn btn-secondary" onClick={() => setLessonModal({ editing: lesson })}>
                  Edit
                </button>
                <button className="btn btn-secondary" onClick={() => removeLesson(lesson)}>
                  Delete
                </button>
              </div>
            </div>
            {lesson.topic_overview && (
              <div className="lesson-card__instructions">
                <div className="lesson-card__instructions-title">Instructions:</div>
                <p>{lesson.topic_overview}</p>
              </div>
            )}
            {selectedId === lesson.id && <LessonManager lesson={lesson} schedule={schedule} focusIntern={focus?.lessonId === lesson.id ? focus.internId : null} onChanged={load} />}
          </div>
        ))}
      </CollapsibleSection>

      <AdminAcceleratorEvents key={`events-${eventsVersion}`} />

      <AdminAcceleratorChats key={`chats-${eventsVersion}`} />

      <InternRoster />

      <MeetingSchedule onEventsCreated={() => setEventsVersion((v) => v + 1)} />


      {lessonModal && <LessonModal editing={lessonModal.editing} onClose={() => setLessonModal(null)} onSaved={lessonSaved} />}
    </div>
  );
}
