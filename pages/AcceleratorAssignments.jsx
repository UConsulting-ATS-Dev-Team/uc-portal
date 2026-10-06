import { useEffect, useState } from "react";
import { fetchMaterials, materialHref, submitAssignment, uploadSubmissionFile } from "../data/acceleratorSync.js";
import { assignmentProgress, submissionState } from "../data/acceleratorLogic.js";
import { useAcceleratorData } from "../data/useAcceleratorData.js";
import AcceleratorTabs from "../components/AcceleratorTabs.jsx";
import SubmissionCommentThread from "../components/SubmissionCommentThread.jsx";
import "../styles/jobDetail.css";
import "../styles/resources.css";
import "../styles/accelerator.css";

function formatLessonDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const STATE_LABEL = {
  complete: { text: "Complete", className: "accel-tag accel-tag--good" },
  incomplete: { text: "Incomplete", className: "accel-tag accel-tag--flag" },
  awaiting_review: { text: "Awaiting review", className: "accel-tag" },
};

// Weekly assignments. A lesson stays locked until the previous one has a real submission (the submission itself,
// not a timer, is the anti-skip mechanism). The committee marks each one complete or incomplete with comments;
// the intern never sees a numeric grade. Incomplete work is fixed and resubmitted, complete work is final.
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
  const state = submissionState(submission);
  const locked = state === "complete";

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
      await submitAssignment(lesson.id, { body, filePath, fileName });
      setFile(null);
      await onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: "var(--space-4)" }}>
      {state === "complete" && (
        <div className="rail-card is-accent" style={{ marginBottom: "var(--space-4)" }}>
          <div className="rail-card__title">Complete</div>
          {submission.feedback && <p style={{ margin: 0 }}>{submission.feedback}</p>}
        </div>
      )}
      {state === "incomplete" && (
        <div className="rail-card" style={{ marginBottom: "var(--space-4)", borderColor: "var(--color-danger)" }}>
          <div className="rail-card__title">Incomplete: fix it and submit again</div>
          {submission.feedback && <p style={{ margin: 0 }}>{submission.feedback}</p>}
        </div>
      )}
      {state === "awaiting_review" && (
        <p className="meta">Submitted {new Date(submission.submitted_at).toLocaleDateString()}, waiting for review. You can still update it below.</p>
      )}

      <div className="field">
        <label>Your response</label>
        <textarea
          rows={4}
          value={body}
          disabled={locked}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your response to this week's activity…"
        />
      </div>
      {!locked && (
        <div className="field">
          <label>Attach a file (optional)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {submission?.file_name && !file && <p className="meta">Currently attached: {submission.file_name}</p>}
        </div>
      )}
      {locked && submission?.file_name && <p className="meta">Attached: {submission.file_name}</p>}
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {!locked && (
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || (!body.trim() && !file && !submission?.file_path)}>
          {submitting ? "Submitting…" : state === "incomplete" ? "Resubmit" : submission ? "Update submission" : "Submit"}
        </button>
      )}
      {submission && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <SubmissionCommentThread submissionId={submission.id} />
        </div>
      )}
    </div>
  );
}

export default function AcceleratorAssignments() {
  const { lessons, submissions, loading, error, reload } = useAcceleratorData();
  const [expandedId, setExpandedId] = useState(null);

  const submissionByLesson = new Map(submissions.map((s) => [s.lesson_id, s]));
  const progress = assignmentProgress(lessons, submissions);

  // A lesson that is unlocked, not yet submitted and due within a week (or overdue) gets a banner.
  const dueSoon = lessons
    .map((lesson, i) => ({ lesson, i, prevSubmitted: i === 0 || submissionByLesson.has(lessons[i - 1]?.id) }))
    .filter(({ lesson, prevSubmitted }) => prevSubmitted && !submissionByLesson.has(lesson.id))
    .map(({ lesson, i }) => ({ lesson, i, days: Math.ceil((new Date(`${lesson.lesson_date}T00:00:00`) - new Date()) / 86400000) }))
    .filter(({ days }) => days <= 7);

  return (
    <div>
      <AcceleratorTabs />
      <div className="detail-header" style={{ display: "block" }}>
        <h1>Assignments</h1>
        <p>A weekly curriculum to get you up to speed on how UC operates and how real consulting and recruiting work.</p>
        <div className="progress-bar-track" style={{ maxWidth: "300px" }}>
          <div className="progress-bar-fill" style={{ width: lessons.length ? `${(progress.complete / lessons.length) * 100}%` : "0%" }} />
        </div>
        <p className="meta">
          {progress.complete} / {lessons.length} complete
          {progress.incomplete > 0 && ` · ${progress.incomplete} to fix and resubmit`}
          {progress.awaitingReview > 0 && ` · ${progress.awaitingReview} awaiting review`}
        </p>
      </div>

      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      {dueSoon.map(({ lesson, i, days }) => (
        <div key={lesson.id} className="rail-card is-accent" style={{ marginBottom: "var(--space-4)" }}>
          <div className="rail-card__title">
            {days < 0
              ? `Week ${i + 1}: "${lesson.title}" is overdue`
              : days === 0
                ? `Week ${i + 1}: "${lesson.title}" is due today`
                : `Week ${i + 1}: "${lesson.title}" is due in ${days} day${days === 1 ? "" : "s"}`}
          </div>
          <p style={{ margin: 0 }} className="meta">
            Due {formatLessonDate(lesson.lesson_date)}. Scroll down and submit below.
          </p>
        </div>
      ))}

      <div className="detail-section">
        {loading && <p className="meta">Loading…</p>}
        {!loading && lessons.length === 0 && <p className="meta">No lessons have been added yet. Check back soon.</p>}
        {lessons.map((lesson, i) => {
          const submission = submissionByLesson.get(lesson.id);
          const state = submissionState(submission);
          // Locked until the previous lesson has a real submission; the first lesson is always open.
          const prevSubmitted = i === 0 || submissionByLesson.has(lessons[i - 1].id);
          const isExpanded = expandedId === lesson.id;
          const label = STATE_LABEL[state];
          return (
            <div className={`step-row${isExpanded ? " is-current" : ""}`} key={lesson.id} style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span className="step-row__status">{state === "complete" ? "✓" : "○"}</span>
                <span className="step-row__number step-row__number--week">Week {i + 1}</span>
                <div className="step-row__body">
                  <div className="step-row__title">{lesson.title}</div>
                  <div className="step-row__detail meta">Due {formatLessonDate(lesson.lesson_date)}</div>
                  {lesson.topic_overview && <div className="step-row__detail">{lesson.topic_overview}</div>}
                </div>
                {label && <span className={label.className}>{label.text}</span>}
                <div className="step-row__state">
                  {!prevSubmitted && "Locked until the previous lesson is submitted"}
                  {prevSubmitted && (
                    <button className="btn btn-secondary" onClick={() => setExpandedId(isExpanded ? null : lesson.id)}>
                      {isExpanded ? "Close" : state === "not_started" ? "Start" : state === "incomplete" ? "Fix" : "View"}
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && prevSubmitted && (
                <div className="accel-step-panel">
                  <p style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>Prep material</p>
                  <LessonMaterials lessonId={lesson.id} />
                  <SubmissionForm lesson={lesson} submission={submission} onSubmitted={reload} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
