import { useEffect, useState } from "react";
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
  getSubmissionFileSignedUrl,
  gradeSubmission,
  fetchInternRoster,
  addInternRosterEntry,
  removeInternRosterEntry,
  bulkAddInternRoster,
  fetchInternProgress,
  fetchInternNames,
  removeInternName,
  fetchMeetingSchedule,
  saveMeetingSchedule,
} from "../data/acceleratorSync.js";
import SubmissionCommentThread from "../components/SubmissionCommentThread.jsx";
import AdminAcceleratorEvents from "../components/AdminAcceleratorEvents.jsx";
import Modal from "../components/Modal.jsx";
import CollapsibleSection from "../components/CollapsibleSection.jsx";
import AdminAcceleratorChats from "../components/AdminAcceleratorChats.jsx";
import "../styles/jobDetail.css";
import "../styles/admin.css";

const EMPTY_FORM = { lessonDate: "", title: "", topicOverview: "" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// When the accelerator meets each week. Interns' coffee-chat count (3 a week) resets at this day and time.
function MeetingSchedule() {
  const [weekday, setWeekday] = useState(3);
  const [time, setTime] = useState("18:00");
  const [saved, setSaved] = useState(false);
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
      setMessage("Saved.");
    } catch (e) {
      setMessage(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="detail-section">
      <p style={{ fontWeight: 700, margin: 0 }}>Weekly accelerator meeting</p>
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

  return (
    <CollapsibleSection
      title="Who can sign up as an intern"
      summary={`${entries.length + names.length} listed${names.some((n) => !n.claimed_at) ? `, ${names.filter((n) => !n.claimed_at).length} by name only and not signed up yet` : ""}`}
    >
      <div className="collapsible__actions">
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          Add interns
        </button>
      </div>
      <p className="meta">
        Incoming freshmen aren't on the roster or in the Directory yet. Add their email here before they try to
        sign up, or just their name if you don't have an email: they type that full name when creating their account
        and it works once.
      </p>
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
        {names.map((n) => (
          <li key={n.name_key}>
            {n.name} <span className="meta">{n.claimed_at ? (n.claimed_as && n.claimed_as.trim().toLowerCase() !== n.name.trim().toLowerCase() ? `signed up as "${n.claimed_as}"` : "signed up") : "listed by name, not signed up yet"}</span>{" "}
            <button className="btn-link" onClick={() => removeName(n.name_key)}>
              Remove
            </button>
          </li>
        ))}
        {entries.length === 0 && names.length === 0 && <li className="meta">No one on this list yet.</li>}
      </ul>

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
    </CollapsibleSection>
  );
}

// Marked complete (looks decent, real effort) or incomplete (unfinished or poor), with comments the intern sees. No number.
function GradeRow({ submission, displayName, namesById, onGraded }) {
  const [status, setStatus] = useState(submission.status ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);

  useEffect(() => {
    if (submission.file_path) {
      getSubmissionFileSignedUrl(submission.file_path).then(setFileUrl).catch(() => {});
    }
  }, [submission.file_path]);

  async function save() {
    if (!status) {
      setError("Choose complete or incomplete.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await gradeSubmission(submission.id, { status, feedback });
      onGraded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr>
        <td>{displayName}</td>
        <td className="meta">{new Date(submission.submitted_at).toLocaleDateString()}</td>
        <td style={{ maxWidth: 280, whiteSpace: "pre-wrap" }}>{submission.body || <span className="meta">No written response.</span>}</td>
        <td>
          {fileUrl ? (
            <a href={fileUrl} target="_blank" rel="noreferrer">
              {submission.file_name}
            </a>
          ) : submission.file_path ? (
            "Loading…"
          ) : (
            <span className="meta">None</span>
          )}
        </td>
        <td>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Not reviewed</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </td>
        <td>
          <input type="text" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Comments for the intern" />
          {error && <div className="meta" style={{ color: "var(--color-danger)" }}>{error}</div>}
        </td>
        <td>
          <button className="btn btn-secondary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : submission.graded_at ? "Update" : "Save"}
          </button>
        </td>
      </tr>
      <tr>
        <td colSpan={7} style={{ background: "var(--color-ground)" }}>
          <SubmissionCommentThread submissionId={submission.id} resolveAuthorName={(id) => namesById.get(id) ?? id} />
        </td>
      </tr>
    </>
  );
}

function InternProgress() {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInternProgress().then(setProgress).catch((e) => setError(e.message));
  }, []);

  return (
    <CollapsibleSection
      title="Intern progress"
      summary={
        progress === null
          ? "Loading…"
          : `${progress.length} intern${progress.length === 1 ? "" : "s"}${progress.filter((p) => p.assignmentsIncomplete > 0 || p.weeksBehindOnChats > 0 || p.noSocials).length ? `, ${progress.filter((p) => p.assignmentsIncomplete > 0 || p.weeksBehindOnChats > 0 || p.noSocials).length} need attention` : ""}`
      }
    >
      <p className="meta">Every real intern account, at a glance: who's on track and who's stalled.</p>
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
                  {p.assignmentsAwaiting > 0 && <span className="meta"> · {p.assignmentsAwaiting} to review</span>}
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
    </CollapsibleSection>
  );
}

function LessonManager({ lesson, onChanged }) {
  const [materials, setMaterials] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [namesById, setNamesById] = useState(new Map());
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
    supabase.rpc("list_members").then(({ data }) => {
      setNamesById(new Map((data ?? []).map((m) => [m.member_id, m.display_name === m.email ? m.email : `${m.display_name} (${m.email})`])));
    });
  }, [lesson.id]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadMaterial(lesson.id, file);
      loadMaterials();
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
      <input type="file" onChange={handleUpload} disabled={uploading} accept=".pdf,.ppt,.pptx,.xls,.xlsx" />

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

      <p style={{ fontWeight: 700, marginTop: "var(--space-6)" }}>Submissions ({submissions.length})</p>
      <div className="queue-table__scroll">
        <table className="queue-table">
          <thead>
            <tr>
              <th>Intern</th>
              <th>Submitted</th>
              <th>Notes</th>
              <th>Work</th>
              <th>Status</th>
              <th>Comments</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <GradeRow key={`${s.id}-${s.graded_at ?? ""}-${s.submitted_at}`} submission={s} displayName={namesById.get(s.profile_id) ?? s.profile_id} namesById={namesById} onGraded={loadSubmissions} />
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={7} className="meta">
                  No one has submitted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Adding or editing a lesson happens in a dialog so it is the only thing on screen. A new lesson can have its prep
// material queued here: files and links are attached the moment the lesson is created, so adding a lesson and its
// slides is one step instead of a separate hunt for the Manage panel.
function LessonModal({ editing, onClose, onSaved }) {
  const [form, setForm] = useState(
    editing ? { lessonDate: editing.lesson_date, title: editing.title, topicOverview: editing.topic_overview || "" } : EMPTY_FORM
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
        await updateLesson(editing.id, { lessonDate: form.lessonDate, title: form.title.trim(), topicOverview: form.topicOverview.trim() });
        await onSaved(null, null);
        onClose();
        return;
      }
      const created = await createLesson({ lessonDate: form.lessonDate, title: form.title.trim(), topicOverview: form.topicOverview.trim() });
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
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="lesson-title">Title</label>
          <input id="lesson-title" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
      </div>
      <p className="meta" style={{ marginTop: 0 }}>
        The assignment is due at that week's accelerator (the weekly meeting day and time set above), and the next assignment opens once that accelerator has passed.
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
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lessonModal, setLessonModal] = useState(null); // null | { editing: lesson | null }
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);

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

  async function removeLesson(id) {
    await deleteLesson(id);
    if (selectedId === id) setSelectedId(null);
    load();
  }

  return (
    <div>
      <h1>Accelerator</h1>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      <InternRoster />

      <MeetingSchedule />

      <InternProgress />

      <AdminAcceleratorEvents />

      <AdminAcceleratorChats />

      <CollapsibleSection title="Lessons" summary={loading ? "Loading…" : `${lessons.length} week${lessons.length === 1 ? "" : "s"}`}>
        <div className="collapsible__actions">
          <button className="btn btn-primary" onClick={() => setLessonModal({ editing: null })}>
            Add lesson
          </button>
        </div>
        {loading && <p className="meta">Loading…</p>}
        {!loading && lessons.length === 0 && <p className="meta">No lessons yet. Add the first one.</p>}
        {lessons.map((lesson, i) => (
          <div key={lesson.id} className={`lesson-card${selectedId === lesson.id ? " is-open" : ""}`}>
            <div className="lesson-card__head">
              <span className="lesson-card__num">{i + 1}</span>
              <div className="lesson-card__main">
                <div className="lesson-card__title">{lesson.title}</div>
                <div className="lesson-card__meta">
                  Week of {new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
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
                <button className="btn btn-secondary" onClick={() => setSelectedId(selectedId === lesson.id ? null : lesson.id)}>
                  {selectedId === lesson.id ? "Close" : "Manage"}
                </button>
                <button className="btn-link" onClick={() => setLessonModal({ editing: lesson })}>
                  Edit
                </button>
                <button className="btn-link" onClick={() => removeLesson(lesson.id)}>
                  Delete
                </button>
              </div>
            </div>
            {lesson.topic_overview && <p className="lesson-card__desc">{lesson.topic_overview}</p>}
            {selectedId === lesson.id && <LessonManager lesson={lesson} onChanged={load} />}
          </div>
        ))}
      </CollapsibleSection>

      {lessonModal && <LessonModal editing={lessonModal.editing} onClose={() => setLessonModal(null)} onSaved={lessonSaved} />}
    </div>
  );
}
