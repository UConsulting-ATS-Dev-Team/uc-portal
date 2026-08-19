import { useState } from "react";
import { Link } from "react-router-dom";
import { STAGES, INTERVIEW_STAGES } from "../data/trackerUtils.js";
import { deadlineLabel, isUrgent } from "../data/jobUtils.js";

export default function TrackerBoard({ applications, onMoveStage }) {
  const [dragOverStage, setDragOverStage] = useState(null);

  function handleDrop(event, stage) {
    event.preventDefault();
    const jobId = event.dataTransfer.getData("text/plain");
    if (jobId) onMoveStage(jobId, stage);
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
              {cards.map(({ jobId, job }) => {
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
                        <span className="board-card__logo">{job.logoInitials}</span>
                        {job.company}
                      </div>
                      <div className="board-card__role">{job.role}</div>
                    </Link>
                    <div className={`board-card__detail${urgent ? " is-urgent" : ""}`}>
                      {stage === "Closed" ? "Closed" : job.rolling ? "Rolling deadline" : deadlineLabel(job)}
                    </div>
                    {stage === "Applied" && (
                      <button className="btn btn-secondary board-card__followup">Follow up</button>
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
