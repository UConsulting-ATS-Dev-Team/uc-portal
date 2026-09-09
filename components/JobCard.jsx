import { Link } from "react-router-dom";
import { deadlineLabel, isUrgent } from "../data/jobUtils.js";
import CompanyLogo from "./CompanyLogo.jsx";

export default function JobCard({ job, saved, onToggleSave }) {
  const urgent = isUrgent(job);

  return (
    <div className={`job-card${job.ucPosted ? " is-uc-posted" : ""}`}>
      <CompanyLogo name={job.company} initials={job.logoInitials} className="job-card__logo" />

      <div className="job-card__body">
        <div className="job-card__title-row">
          <span className="job-card__role">{job.role}</span>
          <span className="job-card__match">{job.matchScore}% match</span>
          {job.ucPosted && <span className="chip chip-accent">UC-posted</span>}
          {job.possiblyClosed && <span className="chip">Possibly no longer open</span>}
        </div>
        {/* .filter(Boolean), not a bare template join -- a real job with
            remote_type "in_person" but no city on file (data/realJobAdapter.js's
            location: job.city ?? (remote ? "Remote" : "")) renders location as
            "", which a plain join turned into a double " ·  · " separator.
            Company is always present so this can't collapse to a leading dot. */}
        <p className="job-card__detail-line">
          {[job.company, job.location, job.workMode, job.compDisplay].filter(Boolean).join(" · ")}
        </p>

        <div className="chip-row" style={{ marginBottom: "var(--space-4)" }}>
          <span className="chip">{job.type}</span>
          {job.classYears?.length > 0 && <span className="chip">Class of {job.classYears.join(", ")}</span>}
          {job.industry && <span className="chip">{job.industry}</span>}
          <span className={`chip job-card__chip${urgent ? " is-urgent" : ""}`}>{deadlineLabel(job)}</span>
        </div>

        {(job.ucConnections > 0 || job.pastCycleApplicants != null || job.whyLowerMatch) && (
          <div className="job-card__footer">
            {job.ucConnections > 0 && (
              <>
                <div className="job-card__avatars">
                  {Array.from({ length: Math.min(job.ucConnections, 3) }).map((_, i) => (
                    <div className="job-card__avatar" key={i} />
                  ))}
                </div>
                <span className="job-card__connections">{job.ucConnections} UC connections</span>
                <span>·</span>
              </>
            )}
            {/* pastCycleApplicants/Offers come from UC's own tracker data (Part 3.6) --
                left undefined rather than faked as 0 for a real job that doesn't have it yet. */}
            {job.pastCycleApplicants != null && (
              <span>
                {job.pastCycleApplicants} UC members applied last cycle · {job.pastCycleOffers} received offers
              </span>
            )}
            {job.whyLowerMatch && <span className="job-card__why">— {job.whyLowerMatch}</span>}
          </div>
        )}
      </div>

      <div className="job-card__actions">
        <Link to={`/jobs/${job.id}`} className="btn btn-primary">
          View & apply
        </Link>
        <button type="button" className={`btn btn-secondary${saved ? " is-saved" : ""}`} onClick={() => onToggleSave(job.id)}>
          {saved ? "✓ Saved" : "Save"}
        </button>
        <span className="job-card__posted">Posted {job.postedDaysAgo}d ago</span>
      </div>
    </div>
  );
}
