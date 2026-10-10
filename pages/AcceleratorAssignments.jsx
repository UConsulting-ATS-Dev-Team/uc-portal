import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchMaterials, materialHref, submitAssignment, uploadSubmissionFile } from "../data/acceleratorSync.js";
import { assignmentProgress, daysUntil, dueWording, formatDue, lessonDue, lessonOpensAt, submissionState, ymd } from "../data/acceleratorLogic.js";
import { useAcceleratorData } from "../data/useAcceleratorData.js";
import AcceleratorTabs from "../components/AcceleratorTabs.jsx";
import SubmissionCommentThread from "../components/SubmissionCommentThread.jsx";
import "../styles/jobDetail.css";
import "../styles/resources.css";
import "../styles/accelerator.css";

// Instructions are plain text an admin typed; keep their line breaks and turn web addresses into links.
function Instructions({ text }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <div className="accel-instructions">
      <div className="accel-instructions__kicker">Instructions</div>
      <div className="accel-instructions__body">
        {parts.map((part, i) =>
          /^https?:\/\//.test(part) ? (
            <a key={i} href={part} target="_blank" rel="noreferrer">
              {part}
            </a>
          ) : (
            part
          )
        )}
      </div>
    </div>
  );
}

const STATE_LABEL = {
  complete: { text: "Complete", className: "accel-tag accel-tag--good" },
  incomplete: { text: "Incomplete", className: "accel-tag accel-tag--flag" },
  awaiting_review: { text: "Submitted, awaiting review", className: "accel-tag" },
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
  const [linkUrl, setLinkUrl] = useState(submission?.link_url || "");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const state = submissionState(submission);
  const locked = state === "complete";

  const linkLooksValid = !linkUrl.trim() || /^https?:\/\/\S+$/i.test(linkUrl.trim());

  async function handleSubmit() {
    if (submitting) return;
    if (!linkLooksValid) {
      setError("The link has to start with https://");
      return;
    }
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
      await submitAssignment(lesson.id, { body, linkUrl, filePath, fileName });
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

      <div className="accel-submit">
        <div className="field">
          <label htmlFor={`link-${lesson.id}`}>Link to your work</label>
          <input
            id={`link-${lesson.id}`}
            type="url"
            value={linkUrl}
            disabled={locked}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Google Doc, Sheet or Slides link"
          />
        </div>
        {!locked && (
          <div className="field">
            <label htmlFor={`file-${lesson.id}`}>Or upload a file</label>
            <input id={`file-${lesson.id}`} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        )}
        {!locked && (
          <p className="meta accel-submit__hint">
            Set a linked doc to "anyone with the link can view" so the committee can open it. Files can be Word, Excel, PowerPoint or PDF.
            {submission?.file_name && !file && ` Currently attached: ${submission.file_name}.`}
          </p>
        )}
        <div className="field accel-submit__notes">
          <label htmlFor={`notes-${lesson.id}`}>Notes for the committee (optional)</label>
          <textarea id={`notes-${lesson.id}`} rows={2} value={body} disabled={locked} onChange={(e) => setBody(e.target.value)} />
        </div>
      </div>
      {locked && submission?.file_name && <p className="meta">Attached: {submission.file_name}</p>}
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {!locked && (
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || (!linkUrl.trim() && !body.trim() && !file && !submission?.file_path)}>
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
  const { lessons, submissions, schedule, loading, error, reload } = useAcceleratorData();
  const now = new Date();
  const [searchParams] = useSearchParams();
  // Arriving from the calendar or a notice (?lesson=<id>) opens that assignment.
  const [expandedId, setExpandedId] = useState(searchParams.get("lesson"));
  useEffect(() => {
    const id = searchParams.get("lesson");
    if (!id || loading) return;
    setExpandedId(id);
    document.getElementById(`lesson-${id}`)?.scrollIntoView();
  }, [searchParams, loading]);

  const submissionByLesson = new Map(submissions.map((s) => [s.lesson_id, s]));
  const progress = assignmentProgress(lessons, submissions);

  // A lesson that is open, not yet submitted and due within a week (or overdue) gets a banner.
  const dueSoon = lessons
    .map((lesson, i) => ({ lesson, i, due: lessonDue(lesson, schedule), opens: lessonOpensAt(i, lessons, submissionByLesson, schedule, now) }))
    .filter(({ lesson, opens }) => opens.open && !submissionByLesson.has(lesson.id))
    .map((row) => ({ ...row, days: daysUntil(ymd(row.due.date), now), overdue: row.due.date < now }))
    .filter(({ days }) => days <= 7);

  return (
    <div>
      <AcceleratorTabs />
      <div className="detail-header" style={{ display: "block" }}>
        <h1 className="accel-title">Assignments</h1>
        <div className="progress-bar-track" style={{ maxWidth: "300px" }}>
          <div className="progress-bar-fill" style={{ width: lessons.length ? `${(progress.submitted / lessons.length) * 100}%` : "0%" }} />
        </div>
        <p className="meta">
          {progress.complete} / {lessons.length} complete
          {progress.incomplete > 0 && ` · ${progress.incomplete} to fix and resubmit`}
          {progress.awaitingReview > 0 && ` · ${progress.awaitingReview} awaiting review`}
        </p>
      </div>

      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      {dueSoon.map(({ lesson, i, due, days, overdue }) => (
        <div key={lesson.id} className="rail-card is-accent" style={{ marginBottom: "var(--space-4)" }}>
          <div className="rail-card__title">
            {overdue ? `Week ${i + 1}: "${lesson.title}" is overdue` : `Week ${i + 1}: "${lesson.title}" is due ${dueWording(days)}`}
          </div>
          <p style={{ margin: 0 }} className="meta">
            Due {formatDue(due.date, due.hasTime)}. Scroll down and submit below.
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
          const opens = lessonOpensAt(i, lessons, submissionByLesson, schedule, now);
          const prevSubmitted = opens.open;
          const isExpanded = expandedId === lesson.id;
          const label = STATE_LABEL[state];
          return (
            <div id={`lesson-${lesson.id}`} className={`lesson-card${isExpanded ? " is-open" : ""}${!prevSubmitted ? " is-locked" : ""}`} key={lesson.id}>
              <div className="lesson-card__head">
                <span className={`lesson-card__num${state === "complete" ? " is-done" : ""}`}>{state === "complete" ? "\u2713" : i + 1}</span>
                <div className="lesson-card__main">
                  <div className="lesson-card__title">{lesson.title}</div>
                  <div className="lesson-card__meta">
                    Due {formatDue(lessonDue(lesson, schedule).date, lessonDue(lesson, schedule).hasTime)}
                    {!prevSubmitted && (opens.waitingForMeeting ? ` \u00b7 Opens after the accelerator, ${formatDue(opens.waitingForMeeting, true)}` : " \u00b7 Locked until the previous week is submitted")}
                  </div>
                </div>
                {label ? <span className={label.className}>{label.text}</span> : <span className={`accel-tag${prevSubmitted ? " accel-tag--accelerator" : " accel-tag--optional"}`}>{prevSubmitted ? "To do" : "Locked"}</span>}
                {prevSubmitted && (
                  <button className="btn btn-secondary" onClick={() => setExpandedId(isExpanded ? null : lesson.id)}>
                    {isExpanded ? "Close" : state === "not_started" ? "Start" : state === "incomplete" ? "Fix" : "View"}
                  </button>
                )}
              </div>
              {isExpanded && prevSubmitted && (
                <div className="accel-step-panel">
                  {lesson.topic_overview && <Instructions text={lesson.topic_overview} />}
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
