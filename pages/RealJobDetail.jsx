import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../data/supabaseClient.js";
import { matchJob } from "../data/jobMatch.js";
import { useAppState } from "../data/store.jsx";
import { currentUser } from "../data/mockUser.js";
import CompanyLogo from "../components/CompanyLogo.jsx";
import Placeholder from "./Placeholder.jsx";
import "../styles/jobDetail.css";

const EMPLOYMENT_TYPE_LABEL = {
  internship: "Internship",
  full_time: "Full-time",
  part_time: "Part-time",
  fellowship: "Fellowship",
  co_op: "Co-op",
  apprenticeship: "Apprenticeship",
  externship: "Externship",
};
const REMOTE_TYPE_LABEL = { remote: "Remote", hybrid: "Hybrid", in_person: "In-person" };

// Detail view for a real job (a UUID id, see JobDetail.jsx's dispatch at the
// top of its component). Deliberately much simpler than the mock JobDetail:
// no odds model, no UC connections, no interview write-ups -- those need
// CRM/application-tracker data this job record doesn't have and won't
// fabricate. What IS real here: the job's actual fields from the jobs
// table, and a genuine match explanation via data/jobMatch.js against the
// member's real local preferences -- same principle as the mock page's
// match checklist, just honestly scoped to what's actually available for a
// real job right now.
export default function RealJobDetail({ jobId }) {
  const [job, setJob] = useState(undefined); // undefined = loading, null = not found
  const { preferences } = useAppState();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setJob(data ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (job === undefined) return <Placeholder title="Loading…" />;
  if (job === null) return <Placeholder title="Job not found" />;

  const match = matchJob(job, preferences, currentUser.classYear);
  const compLabel = job.compensation_text || (job.salary_min ? `$${job.salary_min}${job.salary_max && job.salary_max !== job.salary_min ? `-${job.salary_max}` : ""}` : "Not listed");
  const locationLabel = job.city ? `${job.city}${job.remote_type && job.remote_type !== "in_person" ? ` · ${REMOTE_TYPE_LABEL[job.remote_type]}` : ""}` : REMOTE_TYPE_LABEL[job.remote_type] ?? "Not listed";

  return (
    <div>
      <p className="detail-breadcrumb">
        <Link to="/jobs">Jobs</Link> / {job.title}
      </p>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-header">
            <CompanyLogo name={job.company} initials={job.company.slice(0, 3).toUpperCase()} className="detail-header__logo" />
            <div className="detail-header__body">
              <div className="detail-header__title-row">
                <h1 className="detail-header__role">{job.title}</h1>
                {!job.active && <span className="chip">No longer active</span>}
              </div>
              <p className="detail-header__detail-line">
                {job.company} · {locationLabel} · {compLabel}
              </p>
              <div className="detail-header__actions">
                <a href={job.application_url} target="_blank" rel="noreferrer" className="btn btn-primary">
                  Apply on {job.company}'s site
                </a>
                {job.application_deadline && (
                  <span className="detail-header__deadline">
                    Applications close · {new Date(job.application_deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Why this might be a fit for you</h2>
            <div className="checklist-grid">
              {match.factors.map((f) => (
                <div className={`checklist-item ${f.match ? "is-match" : "is-mismatch"}`} key={f.key}>
                  <span className="checklist-item__icon">{f.match ? "✓" : "✕"}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
            {!match.eligible && (
              <p className="meta" style={{ marginTop: "var(--space-3)" }}>
                This role's requirements don't match your profile's graduation year or opportunity-type preference.
              </p>
            )}
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Role details</h2>
            {job.description && <p>{job.description}</p>}
            {job.qualifications_text && (
              <>
                <p style={{ fontWeight: 700, marginTop: "var(--space-5)" }}>Qualifications</p>
                <p>{job.qualifications_text}</p>
              </>
            )}
            {!job.description && !job.qualifications_text && (
              <p className="meta">No further description was provided with this posting.</p>
            )}
            <p style={{ fontWeight: 700, marginTop: "var(--space-5)" }}>Type</p>
            <p>{EMPLOYMENT_TYPE_LABEL[job.employment_type] ?? "Not classified"}</p>
            {job.application_deadline && (
              <>
                <p style={{ fontWeight: 700, marginTop: "var(--space-5)" }}>Application deadline</p>
                <p>{new Date(job.application_deadline).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
              </>
            )}
            {job.graduation_years?.length > 0 && (
              <>
                <p style={{ fontWeight: 700, marginTop: "var(--space-5)" }}>Open to class years</p>
                <p>{job.graduation_years.join(", ")}</p>
              </>
            )}
          </div>
        </div>

        <div className="detail-rail">
          <div className="rail-card">
            <div className="rail-card__title">About this listing</div>
            <p className="meta" style={{ margin: 0 }}>
              This is a real, admin-approved posting -- not yet enriched with UC recruiting intelligence
              (alumni connections, past-cycle outcomes, interview write-ups). That data comes from the
              application tracker and CRM integration, which don't yet cover real jobs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
