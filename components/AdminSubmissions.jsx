import { useEffect, useRef, useState } from "react";
import { addSubmissionComment, fetchLessons, fetchSubmissionsForIntern, getSubmissionFileSignedUrl, gradeSubmission, submissionFiles } from "../data/acceleratorSync.js";
import { lessonDue, submissionTiming } from "../data/acceleratorLogic.js";
import SubmissionCommentThread from "./SubmissionCommentThread.jsx";
import Modal from "./Modal.jsx";

// Files sit in a private bucket, so a link is made when it is clicked (a signed link made earlier would expire while the page is open).
// A blank tab is opened first, inside the click, so a pop-up blocker allows it; if it is blocked anyway, or the link can't be made,
// the reason shows beside the file instead of nothing happening.
function FileLink({ file }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  async function open(e, download = false) {
    e.preventDefault();
    setProblem(null);
    // A download needs no new tab; opening does, made inside the click so a pop-up blocker allows it.
    const win = download ? null : window.open("", "_blank");
    setBusy(true);
    try {
      const url = await getSubmissionFileSignedUrl(file.path, download ? file.name : undefined);
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (err) {
      win?.close();
      setProblem(err.message || "Couldn't open this file.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a href="#open" onClick={open}>
        {busy ? "Opening…" : file.name}
      </a>
      <span className="meta">
        {" · "}
        <a href="#download" onClick={(e) => open(e, true)}>
          Download
        </a>
      </span>
      {problem && <span className="meta" style={{ color: "var(--color-danger)" }}> Couldn't open it: {problem}</span>}
    </>
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
// With `draft` and `onDraft` the status and comment are held by the caller and there is no Save button here (the review pop-up saves
// everything from its own footer).
export function SubmissionDetail({ name, submission, resolveAuthorName, onGraded, draft, onDraft }) {
  const controlled = draft !== undefined;
  const [ownStatus, setStatus] = useState(submission.status ?? "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ownComment, setComment] = useState("");
  const status = controlled ? draft.status : ownStatus;
  const comment = controlled ? draft.comment : ownComment;
  const [statusSaved, setStatusSaved] = useState(false);
  // Choosing Complete or Incomplete saves on the spot, so a mark is never lost to a forgotten Save. A typed comment still goes
  // with its own button (or Save and close).
  async function changeStatus(v) {
    if (!v) return;
    const previous = status;
    if (controlled) onDraft({ ...draft, status: v });
    else setStatus(v);
    setError(null);
    setStatusSaved(false);
    try {
      await gradeSubmission(submission.id, { status: v });
      setStatusSaved(true);
      onGraded?.();
    } catch (err) {
      setError(err.message);
      if (controlled) onDraft({ ...draft, status: previous });
      else setStatus(previous);
    }
  }
  const changeComment = (v) => (controlled ? onDraft({ ...draft, comment: v }) : setComment(v));
  const [threadVersion, setThreadVersion] = useState(0);

  // One click sets the status and, if something is typed, posts it as a comment the intern sees.
  async function save() {
    if (!comment.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addSubmissionComment(submission.id, comment);
      setComment("");
      setThreadVersion((v) => v + 1);
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

      <SubmissionCommentThread submissionId={submission.id} resolveAuthorName={resolveAuthorName} hideComposer reloadKey={threadVersion} isAdmin />

      <div className="sub-item__grade">
        <select aria-label={`Status for ${name}`} value={status} onChange={(e) => changeStatus(e.target.value)}>
          {!status && <option value="">Not reviewed</option>}
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
        </select>
        {statusSaved && <span className="meta sub-item__saved">Saved ✓</span>}
        <input
          type="text"
          value={comment}
          onChange={(e) => changeComment(e.target.value)}
          onKeyDown={(e) => !controlled && e.key === "Enter" && !saving && save()}
          placeholder="Add a comment for the intern (optional)"
          aria-label={`Comment for ${name}`}
        />
        {!controlled && (
          <button className="btn btn-secondary" onClick={save} disabled={saving || !comment.trim()}>
            {saving ? "Sending…" : "Send comment"}
          </button>
        )}
      </div>
      {error && <div className="meta" style={{ color: "var(--color-danger)" }}>{error}</div>}
    </>
  );
}

// One intern's work for one lesson. Collapsed to a single line; opening it shows the work, the status and the comments.
function SubmissionItem({ name, submission, timing, linked, focusKey, open, onToggle, resolveAuthorName, onGraded }) {
  const ref = useRef(null);

  // Arriving from the progress table opens this intern's work and brings it into view.
  useEffect(() => {
    if (linked) ref.current?.scrollIntoView({ block: "center" });
  }, [linked, focusKey]);

  function toggle() {
    if (submission) onToggle();
  }

  const tag = submission ? statusTag(submission) : null;
  const timingTag = TIMING_TAG[timing];

  return (
    <div ref={ref} className={`sub-item${open ? " is-open" : ""}${open || (linked && !submission) ? " is-focused" : ""}`}>
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
export default function AdminSubmissions({ lesson, schedule, submissions, interns, namesById, focusIntern, focusKey, onGraded }) {
  const now = new Date();
  // Only one line is open at a time, and it is the outlined one: opening another folds the first. A link from the progress table
  // starts with that intern's line open; otherwise everything starts folded.
  const [openId, setOpenId] = useState(focusIntern ?? null);
  // Clicking another link from the progress table while this panel is already showing moves to that intern's line (focusKey changes on
  // every click, so clicking the same intern again still works).
  useEffect(() => {
    if (focusIntern) setOpenId(focusIntern);
  }, [focusIntern, focusKey]);
  const byProfile = new Map(submissions.map((s) => [s.profile_id, s]));
  const people = interns.map((i) => ({ id: i.memberId, name: i.displayName }));
  // Someone who submitted but isn't in the intern list (an account since changed) still appears.
  for (const s of submissions) if (!people.some((p) => p.id === s.profile_id)) people.push({ id: s.profile_id, name: namesById.get(s.profile_id) ?? s.profile_id });
  people.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const rows = people.map((p) => ({ ...p, submission: byProfile.get(p.id) ?? null }));
  const toReview = rows.filter((r) => r.submission && !r.submission.status).length;
  const missing = rows.filter((r) => !r.submission && now > lessonDue(lesson, schedule).date).length;
  const late = rows.filter((r) => r.submission && r.submission.status !== "complete" && submissionTiming(lesson, r.submission, schedule, now) === "late").length;

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
            key={`${r.id}-${r.submission?.id ?? "none"}-${r.submission?.submitted_at ?? ""}`}
            name={r.name}
            submission={r.submission}
            timing={submissionTiming(lesson, r.submission, schedule, now)}
            linked={focusIntern === r.id}
            focusKey={focusKey}
            open={openId === r.id}
            onToggle={() => setOpenId(openId === r.id ? null : r.id)}
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
  const [drafts, setDrafts] = useState({}); // submission id -> { status, comment }
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchLessons(), fetchSubmissionsForIntern(memberId)])
      .then(([lessons, subs]) => {
        const order = new Map(lessons.map((l, i) => [l.id, { lesson: l, week: i + 1 }]));
        const waiting = subs
          .filter((s) => !s.status)
          .map((s) => ({ submission: s, ...order.get(s.lesson_id) }))
          .filter((x) => x.lesson);
        setItems(waiting);
        setDrafts(Object.fromEntries(waiting.map((x) => [x.submission.id, { status: "", comment: "" }])));
      })
      .catch((e) => setError(e.message));
  }, [memberId]);

  // Everything marked in the pop-up is written at once: the status, plus the comment if one is typed.
  async function saveAndClose() {
    const touched = (items ?? []).filter((x) => drafts[x.submission.id]?.comment.trim());
    setSaving(true);
    setError(null);
    try {
      for (const x of touched) {
        const d = drafts[x.submission.id];
        // The status was already saved when it was chosen; only the comment is left to send.
        await addSubmissionComment(x.submission.id, d.comment);
      }
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${name}: work to review`}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={saveAndClose} disabled={saving || items === null}>
            {saving ? "Saving…" : "Save and close"}
          </button>
        </>
      }
    >
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
          <SubmissionDetail
            name={name}
            submission={submission}
            resolveAuthorName={(id) => (id === memberId ? name : "Committee")}
            draft={drafts[submission.id] ?? { status: "", comment: "" }}
            onDraft={(d) => setDrafts((prev) => ({ ...prev, [submission.id]: d }))}
            onGraded={onChanged}
          />
        </section>
      ))}
    </Modal>
  );
}
