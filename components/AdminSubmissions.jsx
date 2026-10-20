import { useEffect, useRef, useState } from "react";
import { fetchLessons, fetchSubmissionsForIntern, getSubmissionFileSignedUrl, gradeSubmission, submissionFiles } from "../data/acceleratorSync.js";
import { lessonDue, submissionTiming } from "../data/acceleratorLogic.js";
import SubmissionCommentThread from "./SubmissionCommentThread.jsx";
import Modal from "./Modal.jsx";

// Files sit in a private bucket, so a link is made when it is clicked (a signed link made earlier would expire while the page is open).
function FileLink({ file }) {
  const [busy, setBusy] = useState(false);
  async function open(e) {
    e.preventDefault();
    const win = window.open("", "_blank");
    setBusy(true);
    try {
      const url = await getSubmissionFileSignedUrl(file.path);
      if (win) win.location.href = url;
    } catch {
      win?.close();
    } finally {
      setBusy(false);
    }
  }
  return (
    <a href="#open" onClick={open}>
      {busy ? "Opening…" : file.name}
    </a>
  );
}

const TIMING_TAG = {
  missing: { text: "Missing", className: "accel-tag accel-tag--flag" },
  late: { text: "Late", className: "accel-tag accel-tag--flag" },
  pending: { text: "Not submitted yet", className: "accel-tag accel-tag--optional" },
};

function statusTag(submission) {
  if (submission.status === "complete") return { text: "Complete", className: "accel-tag accel-tag--good" };
  if (submission.status === "incomplete") return { text: "Incomplete", className: "accel-tag accel-tag--flag" };
  return { text: "To review", className: "accel-tag accel-tag--accelerator" };
}

// The work itself: notes, link, files, the status and comments boxes and the comment thread. Shared by the lesson's list and the
// review pop-up.
export function SubmissionDetail({ name, submission, resolveAuthorName, onGraded }) {
  const [status, setStatus] = useState(submission.status ?? "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!status) {
      setError("Choose complete or incomplete.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await gradeSubmission(submission.id, { status });
      onGraded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const files = submissionFiles(submission);
  return (
    <>
      <dl className="sub-item__work">
        <div>
          <dt>Notes</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>{submission.body || <span className="meta">No written response.</span>}</dd>
        </div>
        <div>
          <dt>Link</dt>
          <dd>
            {submission.link_url ? (
              <a href={submission.link_url} target="_blank" rel="noreferrer">
                {submission.link_url}
              </a>
            ) : (
              <span className="meta">None</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Files</dt>
          <dd>
            {files.length === 0 ? (
              <span className="meta">None</span>
            ) : (
              <ul className="sub-item__files">
                {files.map((f) => (
                  <li key={f.path}>
                    <FileLink file={f} />
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      <div className="sub-item__grade">
        <select aria-label={`Status for ${name}`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Not reviewed</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
        </select>
        <button className="btn btn-secondary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : submission.graded_at ? "Update" : "Save"}
        </button>
      </div>
      {error && <div className="meta" style={{ color: "var(--color-danger)" }}>{error}</div>}

      <SubmissionCommentThread submissionId={submission.id} resolveAuthorName={resolveAuthorName} />
    </>
  );
}

// One intern's work for one lesson. Collapsed to a single line; opening it shows the work, the status and the comments.
function SubmissionItem({ name, submission, timing, linked, active, onActivate, resolveAuthorName, onGraded }) {
  const [open, setOpen] = useState(linked);
  const ref = useRef(null);

  // Arriving from the progress table opens this intern's work and brings it into view.
  useEffect(() => {
    if (!linked) return;
    setOpen(true);
    ref.current?.scrollIntoView({ block: "center" });
  }, [linked]);

  function toggle() {
    if (!submission) return;
    if (!open) onActivate();
    setOpen(!open);
  }

  const tag = submission ? statusTag(submission) : null;
  const timingTag = TIMING_TAG[timing];

  return (
    <div ref={ref} className={`sub-item${open ? " is-open" : ""}${active ? " is-focused" : ""}`}>
      <button type="button" className="sub-item__head" onClick={toggle} aria-expanded={submission ? open : undefined} disabled={!submission}>
        <span className="sub-item__name">{name}</span>
        <span className="sub-item__tags">
          {tag && <span className={tag.className}>{tag.text}</span>}
          {timingTag && (timing === "late" || !submission) && <span className={timingTag.className}>{timingTag.text}</span>}
        </span>
        <span className="meta sub-item__when">{submission ? `Submitted ${new Date(submission.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</span>
        {submission && <span className="sub-item__chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>}
      </button>

      {open && submission && (
        <div className="sub-item__body">
          <SubmissionDetail name={name} submission={submission} resolveAuthorName={resolveAuthorName} onGraded={onGraded} />
        </div>
      )}
    </div>
  );
}

// Every intern for one lesson, in first-name order, whether or not they have handed it in: submitted work to open and grade,
// and a Missing tag on anyone who hasn't once it is past due.
export default function AdminSubmissions({ lesson, schedule, submissions, interns, namesById, focusIntern, onGraded }) {
  const now = new Date();
  // The outlined line is whichever one was opened most recently (or the one a link from the progress table pointed at).
  const [activeId, setActiveId] = useState(focusIntern ?? null);
  const byProfile = new Map(submissions.map((s) => [s.profile_id, s]));
  const people = interns.map((i) => ({ id: i.memberId, name: i.displayName }));
  // Someone who submitted but isn't in the intern list (an account since changed) still appears.
  for (const s of submissions) if (!people.some((p) => p.id === s.profile_id)) people.push({ id: s.profile_id, name: namesById.get(s.profile_id) ?? s.profile_id });
  people.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const rows = people.map((p) => ({ ...p, submission: byProfile.get(p.id) ?? null }));
  const toReview = rows.filter((r) => r.submission && !r.submission.status).length;
  const missing = rows.filter((r) => !r.submission && now > lessonDue(lesson, schedule).date).length;
  const late = rows.filter((r) => r.submission && submissionTiming(lesson, r.submission, schedule, now) === "late").length;

  return (
    <>
      <p style={{ fontWeight: 700, marginTop: "var(--space-6)", marginBottom: "var(--space-1)" }}>Submissions</p>
      <p className="meta" style={{ marginTop: 0 }}>
        {submissions.length} of {rows.length} handed in
        {toReview > 0 && ` · ${toReview} to review`}
        {missing > 0 && ` · ${missing} missing`}
        {late > 0 && ` · ${late} late`}
      </p>
      <div className="sub-list">
        {rows.map((r) => (
          <SubmissionItem
            key={`${r.id}-${r.submission?.id ?? "none"}-${r.submission?.graded_at ?? ""}-${r.submission?.submitted_at ?? ""}`}
            name={r.name}
            submission={r.submission}
            timing={submissionTiming(lesson, r.submission, schedule, now)}
            linked={focusIntern === r.id}
            active={activeId === r.id}
            onActivate={() => setActiveId(r.id)}
            resolveAuthorName={(id) => namesById.get(id) ?? id}
            onGraded={onGraded}
          />
        ))}
        {rows.length === 0 && <p className="meta">No interns have signed up yet.</p>}
      </div>
    </>
  );
}

// The pop-up behind "N to review": one intern's work waiting for review, each piece with the lesson it is for, the links and files
// they attached, and the status and comment boxes. Closing it reloads the progress table.
export function ReviewModal({ memberId, name, onClose, onChanged }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    Promise.all([fetchLessons(), fetchSubmissionsForIntern(memberId)])
      .then(([lessons, subs]) => {
        const order = new Map(lessons.map((l, i) => [l.id, { lesson: l, week: i + 1 }]));
        setItems(
          subs
            .filter((s) => !s.status)
            .map((s) => ({ submission: s, ...order.get(s.lesson_id) }))
            .filter((x) => x.lesson)
        );
      })
      .catch((e) => setError(e.message));
  }
  useEffect(load, [memberId]);

  function done() {
    onChanged?.();
    load();
  }

  return (
    <Modal title={`${name}: work to review`} onClose={onClose} width={720} footer={<button className="btn btn-secondary" onClick={onClose}>Close</button>}>
      {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
      {items === null && !error && <p className="meta">Loading…</p>}
      {items?.length === 0 && <p className="meta">Nothing left to review for {name}.</p>}
      {items?.map(({ submission, lesson, week }) => (
        <section key={submission.id} className="review-item">
          <h3 className="review-item__title">
            Week {week}: {lesson.title}
          </h3>
          <p className="meta" style={{ marginTop: 0 }}>
            Submitted {new Date(submission.submitted_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
          <SubmissionDetail name={name} submission={submission} resolveAuthorName={(id) => (id === memberId ? name : "Committee")} onGraded={done} />
        </section>
      ))}
    </Modal>
  );
}
