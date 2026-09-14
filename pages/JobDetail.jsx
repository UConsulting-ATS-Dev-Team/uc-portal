import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { JOBS } from "../data/mockJobs.js";
import { deadlineLabel, descriptionFor, qualificationsFor, writeupsFor } from "../data/jobUtils.js";
import { fetchRealPeopleAtCompany } from "../data/realPeople.js";
import { computeOdds } from "../data/oddsModel.js";
import { useAppState } from "../data/store.jsx";
import OddsModel from "../components/OddsModel.jsx";
import LogPrepModal from "../components/modals/LogPrepModal.jsx";
import CompanyLogo from "../components/CompanyLogo.jsx";
import DemoDataBadge from "../components/DemoDataBadge.jsx";
import Placeholder from "./Placeholder.jsx";
import RealJobDetail from "./RealJobDetail.jsx";
import "../styles/jobDetail.css";

const TIMELINE_STAGES = ["Interested", "Preparing", "Applied", "Interviews", "Offer"];
const PREP_RESOURCES = ["Case Interview Fundamentals", "Behavioral Prep Guide", "Resume Review Checklist"];
// Real jobs (Stage 2) have a UUID id; mock jobs (data/mockJobs.js) use a
// readable slug like "bain-consulting-intern". Checking the shape lets one
// route (/jobs/:jobId) serve both without a second parallel URL scheme.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function completedStageCount(job) {
  if (job.pastCycleOffers > 0) return 5;
  if (job.pastCycleApplicants >= 5) return 3;
  if (job.pastCycleApplicants > 0) return 2;
  return 1;
}

export default function JobDetail() {
  const { jobId } = useParams();
  const job = JOBS.find((j) => j.id === jobId);
  const { preferences, savedJobIds, toggleSavedJob, trackedJobs, addToTracker, prepLogged } = useAppState();
  const [showLogPrepModal, setShowLogPrepModal] = useState(false);

  // Real UConsulting Directory people at this company (see JOB_ENGINE_
  // ARCHITECTURE.md's Stage 5 entry), not data/mockPeople.js's peopleAt() --
  // same real data RealJobDetail.jsx and CompanyPage.jsx already show,
  // just also wired into this legacy mock-job-only page for consistency.
  // Called unconditionally (Rules of Hooks) even though it's a no-op
  // whenever `job` is undefined, i.e. whenever this route is actually
  // serving a real job via RealJobDetail below instead.
  const [people, setPeople] = useState([]);
  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    fetchRealPeopleAtCompany(job.company).then((rows) => {
      if (!cancelled) setPeople(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [job?.company]);

  if (!job) {
    return UUID_PATTERN.test(jobId) ? <RealJobDetail jobId={jobId} /> : <Placeholder title="Job not found" />;
  }

  const isTracked = !!trackedJobs[job.id];
  const isSaved = savedJobIds.includes(job.id);
  const extraPrepHours = prepLogged[job.id] || 0;

  const checklist = [
    {
      match: preferences.industries.includes(job.industry),
      label: `Target industry: ${job.industry}`,
      mismatchLabel: `Outside your target industries (${job.industry})`,
    },
    {
      match:
        preferences.locations.includes(job.location) ||
        (preferences.remoteOrHybridOnly && ["Remote", "Hybrid"].includes(job.workMode)) ||
        preferences.openToRelocating,
      label: `In one of your target locations: ${job.location}`,
      mismatchLabel: `Outside your target locations (${job.location})`,
    },
    {
      match: preferences.roles.some((r) => job.role.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes("consultant")),
      label: `Matches a role you're targeting`,
      mismatchLabel: "Not one of your target roles",
    },
    {
      match: job.ucConnections > 0,
      label: `${job.ucConnections} UC connections at this office`,
      mismatchLabel: "No UC connections here yet",
    },
    {
      match: !job.compHourly || job.compMax >= preferences.compTarget,
      label: `Compensation meets your $${preferences.compTarget}/hr target`,
      mismatchLabel: `Compensation below your $${preferences.compTarget}/hr target`,
    },
  ];

  const stageCount = completedStageCount(job);
  const writeups = writeupsFor(job);
  const similar = JOBS.filter((j) => j.industry === job.industry && j.id !== job.id).slice(0, 2);

  return (
    <div>
      <p className="detail-breadcrumb">
        <Link to="/jobs">Jobs</Link> / {job.role}
      </p>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-header">
            <CompanyLogo name={job.company} initials={job.logoInitials} className="detail-header__logo" />
            <div className="detail-header__body">
              <div className="detail-header__title-row">
                <h1 className="detail-header__role">{job.role}</h1>
                <DemoDataBadge
                  label="Demo job"
                  title="One of 8 hand-authored demo jobs from before the real job board existed -- not a real posting. The real board is at /jobs."
                />
                <span className="job-card__match">{job.matchScore}% match</span>
                {/* "UC alumni here", not "UC-posted" -- see components/
                    JobCard.jsx's identical chip for why. */}
                {job.ucPosted && <span className="chip chip-accent">UC alumni here</span>}
              </div>
              {/* .filter(Boolean), not a bare template join -- see
                  components/JobCard.jsx's identical fix for why (an empty
                  field renders as a double " ·  · " separator otherwise). */}
              <p className="detail-header__detail-line">
                {[job.company, job.location, job.workMode, job.compDisplay].filter(Boolean).join(" · ")}
              </p>
              <div className="detail-header__actions">
                {/* Documented limitation (CLAUDE.md): mock jobs have no
                    real employer URL to send a member to. In practice a
                    member browsing today's real Jobs board never lands
                    here -- real jobs route to RealJobDetail.jsx, which
                    has a genuinely working version of this same button. */}
                <button className="btn btn-primary" disabled title="Not wired up -- this demo job has no real employer application page">
                  Apply on {job.company} site
                </button>
                <button className="btn btn-secondary" onClick={() => addToTracker(job.id, "Interested")}>
                  {isTracked ? "In tracker ✓" : "Add to my tracker"}
                </button>
                <button
                  className={`btn btn-secondary${isSaved ? " is-saved" : ""}`}
                  onClick={() => toggleSavedJob(job.id)}
                >
                  {isSaved ? "✓ Saved" : "Save"}
                </button>
                <button className="btn btn-secondary" onClick={() => addToTracker(job.id, "Interested")}>
                  {isTracked ? "Interested ✓" : "Mark interested"}
                </button>
                <span className="detail-header__deadline">
                  {job.rolling ? "Rolling deadline" : `Applications close · ${deadlineLabel(job)}`}
                </span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Why this is a {job.matchScore}% match for you</h2>
            <div className="checklist-grid">
              {checklist.map((item, i) => (
                <div className={`checklist-item ${item.match ? "is-match" : "is-mismatch"}`} key={i}>
                  <span className="checklist-item__icon">{item.match ? "✓" : "✕"}</span>
                  <span>{item.match ? item.label : item.mismatchLabel}</span>
                </div>
              ))}
            </div>
          </div>

          <OddsModel odds={computeOdds(job, { extraPrepHours })} onLogPrep={() => setShowLogPrepModal(true)} />

          <div className="detail-section">
            <h2 className="detail-section__title">Role description</h2>
            <p>{descriptionFor(job)}</p>
            <p style={{ fontWeight: 700, marginTop: "var(--space-5)" }}>Qualifications</p>
            <ul>
              {qualificationsFor(job).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">UC recruiting intelligence</h2>
            <div className="stat-strip">
              <div className="stat-strip__cell">
                <div className="stat-strip__number">{job.pastCycleApplicants}</div>
                <div className="stat-strip__label">UC applicants (3 yrs)</div>
              </div>
              <div className="stat-strip__cell">
                <div className="stat-strip__number">{Math.round(job.pastCycleApplicants * 0.4)}</div>
                <div className="stat-strip__label">Reached final round</div>
              </div>
              <div className="stat-strip__cell">
                <div className="stat-strip__number">{job.pastCycleOffers}</div>
                <div className="stat-strip__label">Received offers</div>
              </div>
              <div className="stat-strip__cell">
                <div className="stat-strip__number">3 wks</div>
                <div className="stat-strip__label">Median time to decision</div>
              </div>
            </div>

            <div className="recruiting-timeline">
              {TIMELINE_STAGES.map((stage, i) => (
                <div className="recruiting-timeline__stage" key={stage}>
                  <div className={`recruiting-timeline__bar${i < stageCount ? " is-complete" : ""}`} />
                  <div className="recruiting-timeline__label">{stage}</div>
                </div>
              ))}
            </div>

            <p style={{ fontWeight: 700, marginBottom: "var(--space-3)" }}>Interview experiences from UC members</p>
            {writeups.map((w) => (
              <div className="writeup-card" key={w.author}>
                <div className="writeup-card__meta">
                  <strong>{w.author}</strong>
                  <span className="meta">'{String(w.classYear).slice(2)}</span>
                  <span className="chip chip-accent">{w.outcome}</span>
                  <span className="meta">{w.cycle}</span>
                </div>
                <p style={{ margin: 0 }}>{w.body}</p>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-4)" }}>
              {/* RealJobDetail.jsx has the genuine, working version of this
                  (real interview_writeups table) -- this demo job has no
                  real job_id to tie a write-up to. */}
              <button className="btn btn-secondary" disabled title="Not wired up -- this demo job can't take a real write-up submission">
                Add your experience
              </button>
              <span className="meta">3 more write-ups</span>
            </div>
          </div>
        </div>

        <div className="detail-rail">
          <div className="rail-card is-accent">
            <div className="rail-card__title">UC members at {job.company}</div>
            {people.length === 0 && <p className="meta" style={{ margin: 0 }}>No UC members on record here yet.</p>}
            {people.slice(0, 3).map((p) => (
              <div className="person-row" key={p.id}>
                <div>
                  <div className="person-row__name">{p.name}</div>
                  <div className="person-row__meta">{p.role || p.status}{p.office ? ` · ${p.office}` : ""}</div>
                </div>
                <Link to={`/network/${p.id}`} className="btn btn-secondary">
                  Profile
                </Link>
              </div>
            ))}
            {people.length > 3 && (
              <Link
                to={`/network?company=${encodeURIComponent(job.company)}`}
                className="btn-link"
                style={{ display: "inline-block", marginTop: "var(--space-3)" }}
              >
                See all {people.length} UC members
              </Link>
            )}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Prep resources</div>
            {PREP_RESOURCES.map((r) => (
              <div className="resource-row" key={r}>
                {r}
              </div>
            ))}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Similar UC-relevant roles</div>
            {similar.map((s) => (
              <Link to={`/jobs/${s.id}`} className="similar-row" key={s.id} style={{ color: "inherit", textDecoration: "none" }}>
                <CompanyLogo name={s.company} initials={s.logoInitials} className="similar-row__logo" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{s.role}</div>
                  <div className="meta">{s.company}</div>
                </div>
                <span className="chip chip-accent">{s.matchScore}%</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {showLogPrepModal && <LogPrepModal job={job} onClose={() => setShowLogPrepModal(false)} />}
    </div>
  );
}
