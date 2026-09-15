import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { STAGES, INTERVIEW_STAGES, outcomeLabel, rejectionStageLabel } from "../data/trackerUtils.js";
import { deadlineLabel, isUrgent } from "../data/jobUtils.js";
import { SEED_TRACKED_JOB_IDS } from "../data/store.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import DemoDataBadge from "./DemoDataBadge.jsx";

// Real drag-and-drop, cross-device: a live mobile QA pass (2026-09-14,
// CLAUDE.md's dated entry) found that the previous native HTML5 Drag and
// Drop implementation (draggable/onDragStart/onDragOver/onDrop) -- which
// worked fine with a mouse -- has literally no touch equivalent in any
// mobile browser, and Table/Timeline offer no other way to change a
// tracked application's stage either. That meant a real member could not
// change a tracked application's stage at all on a real phone. Replaced
// entirely (not layered on top of) with a single Pointer Events
// implementation: the same code path handles mouse, touch, and pen,
// since all three route through the same pointer* events in every modern
// browser. touch-action: none on .board-card (styles/tracker.css) is
// required alongside this -- without it, a touch-drag on a card would
// simultaneously trigger the board's own native horizontal-scroll
// gesture, fighting the drag.
//
// Dragging still isn't keyboard-operable on its own (no drag gesture is,
// by nature), so every card also gets a real "Move to" <select> --
// works via touch tap, mouse click, or keyboard alone, and is often
// just faster than dragging across all 7 columns regardless of device.
// Both paths call the same commitMove() so the Closed-stage outcome
// prompt fires identically either way.
//
// onRequestOutcome: (jobId) => void, optional -- when provided, moving a
// card into Closed opens the outcome-capture modal right away (Applications.jsx
// owns that modal's open/closed state), and Closed cards with no outcome
// recorded yet get a "Record outcome" affordance instead of a bare detail
// line. Optional so this component still works standalone/unchanged if a
// future caller doesn't want the prompt.
export default function TrackerBoard({ applications, onMoveStage, onRequestOutcome }) {
  const [dragOverStage, setDragOverStage] = useState(null);
  const [draggingJobId, setDraggingJobId] = useState(null);
  // Per-gesture tracking kept in a ref, not state -- overStage included.
  // React batches state updates, so a fast gesture (several pointermove
  // events followed immediately by pointerup, with no render in between
  // -- confirmed live: a synthetic drag completing within one JS tick
  // never actually moved the card) can mean endDrag's closure still sees
  // the *previous* render's dragOverStage value, silently dropping the
  // move. Reading the target stage from this ref instead of from state
  // makes the actual move correct regardless of when React gets around
  // to re-rendering; dragOverStage (state, below) still drives the
  // visual highlight, which is fine to lag a frame.
  const dragRef = useRef({ jobId: null, startX: 0, startY: 0, moved: false, cardEl: null, overStage: null });
  const justDraggedRef = useRef(false);

  function commitMove(jobId, stage) {
    onMoveStage(jobId, stage);
    // Prompt right at the moment of transition, per this feature's own
    // design brief -- doesn't fire for a card moved between two
    // non-Closed stages, and doesn't re-fire for a card already in
    // Closed (this can't distinguish "just arrived" from "already here"
    // -- harmless, since the modal is a no-op to re-open on an
    // application that already has an outcome, and the persistent card
    // affordance covers the rest).
    if (stage === "Closed") onRequestOutcome?.(jobId);
  }

  function handlePointerDown(event, jobId) {
    if (event.button !== undefined && event.button !== 0) return; // primary button/touch/pen only
    const cardEl = event.currentTarget;
    dragRef.current = { jobId, startX: event.clientX, startY: event.clientY, moved: false, cardEl, overStage: null };
    try {
      cardEl.setPointerCapture(event.pointerId);
    } catch {
      // Rare real edge case (e.g. a second pointer arriving mid-gesture) --
      // the drag still works via the normal event flow, just without
      // capture keeping it locked to this element if the pointer strays.
    }
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag.jobId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 6) return; // still just a tap/click, not a drag yet
      drag.moved = true;
      setDraggingJobId(drag.jobId);
    }
    drag.cardEl.style.transform = `translate(${dx}px, ${dy}px)`;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const column = target?.closest(".board-column__drop-zone");
    drag.overStage = column?.dataset.stage ?? null;
    setDragOverStage(drag.overStage);
  }

  function endDrag(event, commit) {
    const drag = dragRef.current;
    if (!drag.jobId) return;
    if (drag.cardEl) {
      drag.cardEl.style.transform = "";
      try {
        drag.cardEl.releasePointerCapture(event.pointerId);
      } catch {
        // Already released (e.g. pointercancel firing after pointerup) -- fine to ignore.
      }
    }
    if (commit && drag.moved && drag.overStage) {
      justDraggedRef.current = true;
      commitMove(drag.jobId, drag.overStage);
    }
    dragRef.current = { jobId: null, startX: 0, startY: 0, moved: false, cardEl: null, overStage: null };
    setDraggingJobId(null);
    setDragOverStage(null);
  }

  // The browser fires a click on the same element right after pointerup
  // even when the pointer moved -- without this, finishing a real drag
  // would also trigger the card's own <Link> and navigate to the job.
  function handleCardLinkClick(event) {
    if (justDraggedRef.current) {
      event.preventDefault();
      justDraggedRef.current = false;
    }
  }

  return (
    <div className="board">
      {STAGES.map((stage) => {
        const cards = applications.filter((a) => a.stage === stage);
        return (
          <div className="board-column" key={stage}>
            <div className="board-column__header">
              <span>{stage}</span>
              <span>{cards.length}</span>
            </div>
            <div className={`board-column__rule${INTERVIEW_STAGES.includes(stage) ? " is-interview" : ""}`} />
            <div
              className={`board-column__drop-zone${dragOverStage === stage ? " is-drag-over" : ""}`}
              data-stage={stage}
            >
              {cards.map(({ jobId, job, outcome, rejectionStage }) => {
                const urgent = isUrgent(job);
                return (
                  <div
                    key={jobId}
                    className={`board-card${urgent ? " is-imminent" : ""}${stage === "Closed" ? " is-closed" : ""}${draggingJobId === jobId ? " is-dragging" : ""}`}
                    onPointerDown={(e) => handlePointerDown(e, jobId)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={(e) => endDrag(e, true)}
                    onPointerCancel={(e) => endDrag(e, false)}
                  >
                    {SEED_TRACKED_JOB_IDS.includes(jobId) && (
                      <DemoDataBadge label="Seeded demo" title="One of the 7 illustrative applications seeded so the tracker isn't empty on first load -- not a real application" />
                    )}
                    <Link to={`/jobs/${jobId}`} style={{ color: "inherit", textDecoration: "none" }} onClick={handleCardLinkClick}>
                      <div className="board-card__company">
                        <CompanyLogo name={job.company} initials={job.logoInitials} className="board-card__logo" />
                        {job.company}
                      </div>
                      <div className="board-card__role">{job.role}</div>
                    </Link>
                    <div className={`board-card__detail${urgent ? " is-urgent" : ""}`}>
                      {stage === "Closed"
                        ? outcome
                          ? outcome === "rejected" && rejectionStage
                            ? `${outcomeLabel(outcome)} — ${rejectionStageLabel(rejectionStage)}`
                            : outcomeLabel(outcome)
                          : "Closed"
                        : job.rolling
                        ? "Rolling deadline"
                        : deadlineLabel(job)}
                    </div>
                    <label className="board-card__move">
                      <span className="board-card__move-label">Move to</span>
                      <select
                        value={stage}
                        onChange={(e) => commitMove(jobId, e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    {/* No real "log a follow-up" flow/data exists --
                        routes to the listing itself (the real
                        UC-connections/write-ups a member would actually
                        use to follow up live there), rather than a dead
                        click on every Applied-stage card. */}
                    {stage === "Applied" && (
                      <Link to={`/jobs/${jobId}`} className="btn btn-secondary board-card__followup" onClick={(e) => e.stopPropagation()}>
                        Follow up
                      </Link>
                    )}
                    {stage === "Closed" && !outcome && (
                      <button
                        className="btn btn-secondary board-card__followup"
                        onClick={(e) => {
                          e.preventDefault();
                          onRequestOutcome?.(jobId);
                        }}
                      >
                        Record outcome
                      </button>
                    )}
                  </div>
                );
              })}
              {cards.length === 0 && (
                <p className="meta" style={{ padding: "var(--space-3) var(--space-2)" }}>
                  Nothing here yet.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
