import { useEffect, useState } from "react";
import {
  fetchLessons,
  fetchMaterials,
  fetchOwnSubmissions,
  materialHref,
  submitAssignment,
  uploadSubmissionFile,
} from "../data/acceleratorSync.js";
import "../styles/jobDetail.css";
import "../styles/resources.css";

function formatLessonDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Real accelerator program timeline -- see the intern_accelerator
// migration's own header comment. Sequential unlock (a lesson is locked
// until the previous one has a real submission) mirrors the existing
// Career Resources learning-track pattern, but progress here is a real
// graded-or-not submission, not a client-side "mark done" toggle -- the
// required submission itself is the anti-skip mechanism (direct
// decision: no timer, a rushed/empty submission shows up plainly when an
// admin grades it).
function LessonMaterials({ lessonId }) {
  const [materials, setMaterials] = useState([]);
  useEffect(() => {
    fetchMaterials(lessonId).then(setMaterials).catch(() => {});
  }, [lessonId]);
  if (materials.length === 0) return <p className="meta">No prep material added yet.</p>;
  return (
    <ul style={{ margin: 0, paddingLeft: "var(--space-6)" }}>
      {materials.map((m) => (
        <li key={m.id}>
          <a href={materialHref(m)} target="_blank" rel="noreferrer">
            {m.file_name}
          </a>
          {m.link_url && <span className="meta"> (link)</span>}
        </li>
      ))}
    </ul>
  );
}

function SubmissionForm({ lesson, submission, onSubmitted }) {
  const [body, setBody] = useState(submission?.body || "");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const isGraded = submission?.graded_at != null;

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let filePath = submission?.file_path ?? null;
      let fileName = submission?.file_name ?? null;
      if (file) {
        const uploaded = await uploadSubmissionFile(file);
        filePath = uploaded.path;
        fileName = uploaded.fileName;
      }
      const row = await submitAssignment(lesson.id, { body, filePath, fileName });
      onSubmitted(row);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      {isGraded ? (
        <div className="rail-card is-accent" style={{ marginBottom: "var(--space-4)" }}>
          <div className="rail-card__title">Your score: {submission.score ?? "—"}</div>
          {submission.feedback && <p style={{ margin: 0 }}>{submission.feedback}</p>}
        </div>
      ) : submission ? (
        <p className="meta">Submitted {new Date(submission.submitted_at).toLocaleDateString()} — waiting to be graded. You can still update it below.</p>
      ) : null}
      <div className="field">
        <label>Your response</label>
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your response to this week's activity…" />
      </div>
      <div className="field">
        <label>Attach a file (optional)</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {submission?.file_name && !file && <p className="meta">Currently attached: {submission.file_name}</p>}
      </div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || (!body.trim() && !file && !submission?.file_path)}>
        {submitting ? "Submitting…" : submission ? "Update submission" : "Submit"}
      </button>
    </div>
  );
}

export default function Accelerator() {
  const [lessons, setLessons] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([fetchLessons(), fetchOwnSubmissions()])
      .then(([l, s]) => {
        setLessons(l);
        setSubmissions(s);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const submissionByLesson = new Map(submissions.map((s) => [s.lesson_id, s]));
  const submittedCount = lessons.filter((l) => submissionByLesson.has(l.id)).length;

  // Real "due soon" notification -- the one surface an intern has for this,
  // since the dedicated Notifications page is route-guarded away from them
  // (components/RequireNotIntern.jsx). Same unlocked-and-not-yet-submitted
  // gate as the lesson list itself, and the same <=7-day window
  // jobUtils.js's isUrgent() already uses elsewhere in this app.
  const dueSoon = lessons
    .map((lesson, i) => ({ lesson, i, prevSubmitted: i === 0 || submissionByLesson.has(lessons[i - 1]?.id) }))
    .filter(({ lesson, prevSubmitted }) => prevSubmitted && !submissionByLesson.has(lesson.id))
    .map(({ lesson, i }) => ({ lesson, i, days: Math.ceil((new Date(`${lesson.lesson_date}T00:00:00`) - new Date()) / 86400000) }))
    .filter(({ days }) => days <= 7);

  return (
    <div>
      <div className="detail-header" style={{ display: "block" }}>
        <h1>Accelerator</h1>
        <p>A weekly curriculum to get you up to speed on how UC operates and how real consulting/recruiting work.</p>
        <div className="progress-bar-track" style={{ maxWidth: "300px" }}>
          <div className="progress-bar-fill" style={{ width: lessons.length ? `${(submittedCount / lessons.length) * 100}%` : "0%" }} />
        </div>
        <p className="meta">
          {submittedCount} / {lessons.length} lessons submitted
        </p>
      </div>

      {dueSoon.map(({ lesson, i, days }) => (
        <div key={lesson.id} className="rail-card is-accent" style={{ marginBottom: "var(--space-4)" }}>
          <div className="rail-card__title">
            {days < 0
              ? `Week ${i + 1} — "${lesson.title}" is overdue`
              : days === 0
                ? `Week ${i + 1} — "${lesson.title}" is due today`
                : `Week ${i + 1} — "${lesson.title}" is due in ${days} day${days === 1 ? "" : "s"}`}
          </div>
          <p style={{ margin: 0 }} className="meta">
            Due {formatLessonDate(lesson.lesson_date)} — scroll down and submit below.
          </p>
        </div>
      ))}

      <div className="detail-section">
        {loading && <p className="meta">Loading…</p>}
        {!loading && lessons.length === 0 && <p className="meta">No lessons have been added yet — check back soon.</p>}
        {lessons.map((lesson, i) => {
          const submission = submissionByLesson.get(lesson.id);
          const isDone = !!submission;
          // Locked until the previous lesson has a real submission -- the
          // first lesson (i === 0) is always open.
          const prevSubmitted = i === 0 || submissionByLesson.has(lessons[i - 1].id);
          const isExpanded = expandedId === lesson.id;
          return (
            <div className={`step-row${isExpanded ? " is-current" : ""}`} key={lesson.id} style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span>{isDone ? "✓" : "○"}</span>
                <span className="step-row__number">Week {i + 1}</span>
                <div className="step-row__body">
                  <div className="step-row__title">{lesson.title}</div>
                  <div className="step-row__detail meta">Due {formatLessonDate(lesson.lesson_date)}</div>
                  {lesson.topic_overview && <div className="step-row__detail">{lesson.topic_overview}</div>}
                </div>
                <div className="step-row__state">
                  {!prevSubmitted && "Locked until the previous lesson is submitted"}
                  {prevSubmitted && (
                    <button className="btn btn-secondary" onClick={() => setExpandedId(isExpanded ? null : lesson.id)}>
                      {isExpanded ? "Close" : isDone ? "View" : "Start"}
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && prevSubmitted && (
                <div style={{ marginTop: "var(--space-5)", paddingLeft: "calc(var(--space-6) + 60px)" }}>
                  <p style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>Prep material</p>
                  <LessonMaterials lessonId={lesson.id} />
                  <SubmissionForm
                    lesson={lesson}
                    submission={submission}
                    onSubmitted={(row) => setSubmissions((prev) => [...prev.filter((s) => s.lesson_id !== row.lesson_id), row])}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
