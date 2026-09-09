import { useState } from "react";
import { Link } from "react-router-dom";
import { STAGES, INTERVIEW_STAGES, outcomeLabel, rejectionStageLabel } from "../data/trackerUtils.js";
import { deadlineLabel, isUrgent } from "../data/jobUtils.js";
import CompanyLogo from "./CompanyLogo.jsx";

// onRequestOutcome: (jobId) => void, optional -- when provided, dropping a
// card into Closed opens the outcome-capture modal right away (Applications.jsx
// owns that modal's open/closed state), and Closed cards with no outcome
// recorded yet get a "Record outcome" affordance instead of a bare detail
// line. Optional so this component still works standalone/unchanged if a
// future caller doesn't want the prompt.
export default function TrackerBoard({ applications, onMoveStage, onRequestOutcome }) {
  const [dragOverStage, setDragOverStage] = useState(null);

  function handleDrop(event, stage) {
    event.preventDefault();
    const jobId = event.dataTransfer.getData("text/plain");
    if (jobId) {
      onMoveStage(jobId, stage);
      // Prompt right at the moment of transition, per this feature's own
      // design brief -- doesn't fire for a card dragged between two
      // non-Closed columns, and doesn't re-fire for a card dragged within
      // Closed (drop target is already Closed either way, so this can't
      // distinguish "just arrived" from "already here" -- harmless, since
      // the modal is a no-op to re-open on an application that already has
      // an outcome, and the persistent card affordance covers the rest).
      if (stage === "Closed") onRequestOutcome?.(jobId);
    }
    setDragOverStage(null);
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
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage);
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => handleDrop(e, stage)}
            >
              {cards.map(({ jobId, job, outcome, rejectionStage }) => {
                const urgent = isUrgent(job);
                return (
                  <div
                    key={jobId}
                    className={`board-card${urgent ? " is-imminent" : ""}${stage === "Closed" ? " is-closed" : ""}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", jobId)}
                  >
                    <Link to={`/jobs/${jobId}`} style={{ color: "inherit", textDecoration: "none" }}>
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
