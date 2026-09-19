import { useEffect, useState } from "react";
import { supabase } from "../data/supabaseClient.js";
import {
  fetchLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  fetchMaterials,
  materialUrl,
  uploadMaterial,
  deleteMaterial,
  fetchSubmissionsForLesson,
  getSubmissionFileSignedUrl,
  gradeSubmission,
  fetchInternRoster,
  addInternRosterEntry,
  removeInternRosterEntry,
} from "../data/acceleratorSync.js";
import "../styles/jobDetail.css";
import "../styles/admin.css";

const EMPTY_FORM = { weekNumber: "", title: "", topicOverview: "" };

function InternRoster() {
  const [entries, setEntries] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  function load() {
    fetchInternRoster().then(setEntries).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addInternRosterEntry(email, name);
      setEmail("");
      setName("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function remove(entryEmail) {
    await removeInternRosterEntry(entryEmail);
    load();
  }

  return (
    <div className="detail-section">
      <p style={{ fontWeight: 700 }}>Who can sign up as an intern</p>
      <p className="meta">
        Incoming freshmen aren't on the roster or in the Directory yet -- add their email here before they try to
        sign up.
      </p>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ucla.edu" />
        </div>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label>Name (optional)</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={add} disabled={adding || !email.trim()}>
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="meta" style={{ color: "#B3261E" }}>{error}</p>}
      <ul style={{ marginTop: "var(--space-4)" }}>
        {entries.map((e) => (
          <li key={e.email}>
            {e.name ? `${e.name} — ` : ""}
            {e.email}{" "}
            <button className="btn-link" onClick={() => remove(e.email)}>
              Remove
            </button>
          </li>
        ))}
        {entries.length === 0 && <li className="meta">No one on this list yet.</li>}
      </ul>
    </div>
  );
}

function GradeRow({ submission, displayName, onGraded }) {
  const [score, setScore] = useState(submission.score ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);

  useEffect(() => {
    if (submission.file_path) {
      getSubmissionFileSignedUrl(submission.file_path).then(setFileUrl).catch(() => {});
    }
  }, [submission.file_path]);

  async function save() {
    setSaving(true);
    try {
      await gradeSubmission(submission.id, { score: score === "" ? null : Number(score), feedback });
      onGraded();
    } finally {
      setSaving(false);
    }
  }

  return (
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
        <input type="number" style={{ width: 64 }} value={score} onChange={(e) => setScore(e.target.value)} placeholder="—" />
      </td>
      <td>
        <input type="text" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback (optional)" />
      </td>
      <td>
        <button className="btn btn-secondary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : submission.graded_at ? "Update" : "Grade"}
        </button>
      </td>
    </tr>
  );
}

function LessonManager({ lesson, onChanged }) {
  const [materials, setMaterials] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [namesById, setNamesById] = useState(new Map());
  const [error, setError] = useState(null);

  function loadMaterials() {
    fetchMaterials(lesson.id).then(setMaterials).catch((e) => setError(e.message));
  }
  function loadSubmissions() {
    fetchSubmissionsForLesson(lesson.id).then(setSubmissions).catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadMaterials();
    loadSubmissions();
    supabase.rpc("list_members").then(({ data }) => {
      setNamesById(new Map((data ?? []).map((m) => [m.member_id, `${m.display_name} (${m.email})`])));
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

  return (
    <div className="detail-section" style={{ marginTop: "var(--space-6)" }}>
      <h2>{lesson.title}</h2>
      {error && <p className="meta" style={{ color: "#B3261E" }}>{error}</p>}

      <p style={{ fontWeight: 700 }}>Prep material</p>
      <ul>
        {materials.map((m) => (
          <li key={m.id}>
            <a href={materialUrl(m.file_path)} target="_blank" rel="noreferrer">
              {m.file_name}
            </a>{" "}
            <button className="btn-link" onClick={() => handleDeleteMaterial(m)}>
              Remove
            </button>
          </li>
        ))}
        {materials.length === 0 && <li className="meta">Nothing uploaded yet.</li>}
      </ul>
      <input type="file" onChange={handleUpload} disabled={uploading} accept=".pdf,.ppt,.pptx,.xls,.xlsx" />

      <p style={{ fontWeight: 700, marginTop: "var(--space-6)" }}>Submissions ({submissions.length})</p>
      <div className="queue-table__scroll">
        <table className="queue-table">
          <thead>
            <tr>
              <th>Intern</th>
              <th>Submitted</th>
              <th>Response</th>
              <th>File</th>
              <th>Score</th>
              <th>Feedback</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <GradeRow key={s.id} submission={s} displayName={namesById.get(s.profile_id) ?? s.profile_id} onGraded={loadSubmissions} />
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

export default function AdminAccelerator() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    fetchLessons()
      .then(setLessons)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(lesson) {
    setEditingId(lesson.id);
    setForm({ weekNumber: lesson.week_number, title: lesson.title, topicOverview: lesson.topic_overview || "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function saveLesson() {
    setError(null);
    try {
      if (!form.weekNumber || !form.title.trim()) {
        setError("Week number and title are required.");
        return;
      }
      if (editingId) {
        await updateLesson(editingId, { weekNumber: Number(form.weekNumber), title: form.title.trim(), topicOverview: form.topicOverview.trim() });
      } else {
        await createLesson({ weekNumber: Number(form.weekNumber), title: form.title.trim(), topicOverview: form.topicOverview.trim() });
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeLesson(id) {
    await deleteLesson(id);
    if (selectedId === id) setSelectedId(null);
    load();
  }

  const selectedLesson = lessons.find((l) => l.id === selectedId);

  return (
    <div>
      <h1>Accelerator</h1>
      <p className="meta">
        Manage the accelerator curriculum -- one evergreen sequence of weekly lessons, editable any time so it can
        change slightly year to year without a code change.
      </p>

      {error && <p className="meta" style={{ color: "#B3261E" }}>{error}</p>}

      <InternRoster />

      <div className="detail-section">
        <p style={{ fontWeight: 700 }}>{editingId ? "Edit lesson" : "Add a lesson"}</p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ width: 100 }}>
            <label>Week #</label>
            <input type="number" value={form.weekNumber} onChange={(e) => setForm({ ...form, weekNumber: e.target.value })} />
          </div>
          <div className="field" style={{ flex: "1 1 240px" }}>
            <label>Title</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field" style={{ flex: "1 1 320px" }}>
            <label>Topic overview</label>
            <input type="text" value={form.topicOverview} onChange={(e) => setForm({ ...form, topicOverview: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={saveLesson}>
            {editingId ? "Save" : "Add"}
          </button>
          {editingId && (
            <button className="btn btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="detail-section">
        {loading && <p className="meta">Loading…</p>}
        {!loading && lessons.length === 0 && <p className="meta">No lessons yet — add the first one above.</p>}
        {lessons.map((lesson) => (
          <div className="step-row" key={lesson.id}>
            <span className="step-row__number">Week {lesson.week_number}</span>
            <div className="step-row__body">
              <div className="step-row__title">{lesson.title}</div>
              {lesson.topic_overview && <div className="step-row__detail">{lesson.topic_overview}</div>}
            </div>
            <div className="step-row__state" style={{ display: "flex", gap: "var(--space-2)" }}>
              <button className="btn btn-secondary" onClick={() => setSelectedId(selectedId === lesson.id ? null : lesson.id)}>
                {selectedId === lesson.id ? "Close" : "Manage"}
              </button>
              <button className="btn-link" onClick={() => startEdit(lesson)}>
                Edit
              </button>
              <button className="btn-link" onClick={() => removeLesson(lesson.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedLesson && <LessonManager lesson={selectedLesson} onChanged={load} />}
    </div>
  );
}
