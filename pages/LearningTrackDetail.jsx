import { Link, useParams } from "react-router-dom";
import { LEARNING_TRACKS, findTrack } from "../data/mockResources.js";
import { JOBS } from "../data/mockJobs.js";
import { useAppState } from "../data/store.jsx";
import { hashString } from "../data/hash.js";
import Placeholder from "./Placeholder.jsx";
import "../styles/jobDetail.css";
import "../styles/resources.css";

export default function LearningTrackDetail() {
  const { trackId } = useParams();
  const track = findTrack(trackId);
  const { trackProgress, advanceTrackStep, trackedJobs } = useAppState();

  if (!track) {
    return <Placeholder title="Learning track not found" />;
  }

  const completed = trackProgress[track.id] || 0;
  const pct = Math.round((completed / track.steps.length) * 100);
  const currentStep = track.steps[completed];
  const membersActive = 6 + (hashString(track.id) % 10);
  const membersFinished = 3 + (hashString(track.id + "f") % 8);

  const tiedApplications = Object.entries(trackedJobs)
    .map(([jobId, info]) => ({ job: JOBS.find((j) => j.id === jobId), stage: info.stage }))
    .filter((e) => e.job && e.job.industry === "Management consulting")
    .slice(0, 3);

  const otherTracks = LEARNING_TRACKS.filter((t) => t.id !== track.id);

  return (
    <div>
      <div className="detail-header" style={{ display: "block" }}>
        <div className="chip-row">
          <span className="chip">{track.category}</span>
          <span className="chip">{track.steps.length} steps</span>
          <span className="chip">{track.totalHours} hrs</span>
          <span className="chip">Self-paced</span>
        </div>
        <h1>{track.title}</h1>
        <p>{track.summary}</p>
        <div className="progress-bar-track" style={{ maxWidth: "300px" }}>
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="meta">
          {completed} / {track.steps.length}
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {currentStep && (
            <button
              className="btn btn-primary"
              onClick={() => advanceTrackStep(track.id, track.steps.length)}
            >
              Continue — step {completed + 1}
            </button>
          )}
          <button className="btn btn-secondary">Log prep time</button>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-section">
            {track.steps.map((step, i) => {
              const isDone = i < completed;
              const isCurrent = i === completed;
              const isLocked = i > completed;
              return (
                <div className={`step-row${isCurrent ? " is-current" : ""}`} key={step.title}>
                  <span>{isDone ? "✓" : "○"}</span>
                  <span className="step-row__number">{i + 1}</span>
                  <div className="step-row__body">
                    <div className="step-row__title">{step.title}</div>
                    <div className="step-row__detail">
                      {step.type} · {step.detail}
                    </div>
                  </div>
                  <div className="step-row__state">
                    {isDone && "Done"}
                    {isCurrent && (
                      <button className="btn btn-secondary" onClick={() => advanceTrackStep(track.id, track.steps.length)}>
                        {step.type === "Live event" ? "RSVP" : "Start"}
                      </button>
                    )}
                    {isLocked && `Locked until ${i}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="detail-rail">
          <div className="rail-card is-accent">
            <div className="rail-card__title">Why finish this</div>
            <p style={{ margin: 0 }}>{track.outcomeStat}</p>
            <p className="meta">n={track.outcomeSampleSize} members</p>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Tied to your applications</div>
            {tiedApplications.length === 0 && <p className="meta" style={{ margin: 0 }}>Not tied to a tracked application yet.</p>}
            {tiedApplications.map((e) => (
              <div className="resource-row" key={e.job.id}>
                <Link to={`/jobs/${e.job.id}`}>{e.job.role}</Link> · {e.job.company}
              </div>
            ))}
            <p className="meta" style={{ marginTop: "var(--space-3)" }}>
              Time logged here counts toward the prep factor in your odds estimate.
            </p>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Members on this track</div>
            <p style={{ margin: 0 }}>
              {membersActive} active · {membersFinished} finished
            </p>
            <button className="btn-link" style={{ marginTop: "var(--space-3)" }}>
              Find a case partner
            </button>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Other tracks</div>
            {otherTracks.map((t) => (
              <div className="resource-row" key={t.id}>
                <Link to={`/resources/tracks/${t.id}`}>{t.title}</Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
