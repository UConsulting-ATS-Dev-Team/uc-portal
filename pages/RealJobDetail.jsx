import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../data/supabaseClient.js";
import { matchJob } from "../data/jobMatch.js";
import { fetchRealOddsInputs, computeRealOdds } from "../data/realOddsModel.js";
import { useAppState } from "../data/store.jsx";
import { currentUser } from "../data/mockUser.js";
import { fetchRealPeopleAtCompany } from "../data/realPeople.js";
import { COMPANIES } from "../data/mockCompanies.js";
import CompanyLogo from "../components/CompanyLogo.jsx";
import OddsModel from "../components/OddsModel.jsx";
import LogPrepModal from "../components/modals/LogPrepModal.jsx";
import Skeleton from "../components/Skeleton.jsx";
import Placeholder from "./Placeholder.jsx";
import "../styles/jobDetail.css";
import "../styles/network.css";

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

// US-28 -- classification_method exists on every real job row (§3.2/Part
// 10) but was never surfaced anywhere in the frontend before this. Only
// covers the "Target industry" checklist row since that's the one field
// classification_method actually describes (normalize.ts always tags it
// "onet_occupation" or "rule" -- the industry/function classification,
// never the whole job) -- not a general-purpose "is this field a fact"
// label for every row. Known gap, not silently papered over: a submitted
// job whose industries came from the submitter's own chip selection
// (approve-submission's submitterIndustries override) still carries
// whatever classification_method the occupation stub produced, since that
// override isn't reflected back into the column -- rare enough in
// practice (industries usually agree) not to block shipping the common
// case, but worth fixing if it turns out to matter.
const CLASSIFICATION_METHOD_LABEL = {
  source_stated: "as stated by the employer",
  human: "confirmed by a UC admin",
  onet_occupation: "our estimate, from the role title (O*NET)",
  rule: "our estimate, from the role title",
  llm: "our estimate (AI-assisted)",
};

// Detail view for a real job (a UUID id, see JobDetail.jsx's dispatch at the
// top of its component). Still simpler than the mock JobDetail -- no
// past-cycle stage timeline, no interview write-ups, since those need
// content someone actually contributed and nothing exists yet for real
// postings. What IS real here: the job's actual fields from the jobs
// table, a genuine match explanation via data/jobMatch.js against the
// member's real local preferences, real UC members at this company (since
// the real people import -- see JOB_ENGINE_ARCHITECTURE.md's Stage 5
// entry), matched the same way CompanyPage.jsx does (the directory's
// company text doesn't match this app's canonical names, so it's a
// starts-with match on the first token, not an exact one) -- and now the
// odds model too (data/realOddsModel.js), the last piece of the mock
// JobDetail this page didn't have a real-data equivalent for. See that
// module's own header for how each factor is sourced from real data and
// why "UC track record" measures interview-stage progress rather than
// offers (tracked_applications has no offer outcome to read).
export default function RealJobDetail({ jobId }) {
  const [job, setJob] = useState(undefined); // undefined = loading, null = not found
  const { preferences, savedConnections, coffeeChatStatus, prepLogged } = useAppState();
  const [showLogPrepModal, setShowLogPrepModal] = useState(false);

  // Real UConsulting Directory people at this company (see JOB_ENGINE_
  // ARCHITECTURE.md's Stage 5 entry) -- undefined while loading, kept
  // separate from [] so the rail doesn't flash "no UC members" before the
  // fetch resolves.
  const [people, setPeople] = useState(undefined);

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

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    setPeople(undefined);
    fetchRealPeopleAtCompany(job.company)
      .then((rows) => {
        if (!cancelled) setPeople(rows);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [job?.company]);

  // The odds model's real signals (see data/realOddsModel.js): the one
  // async piece is the UC track record RPC, so this waits for `people` to
  // resolve too (networking depth reuses the exact same "UC members at
  // {company}" fetch the rail above already made, rather than re-querying).
  // undefined = loading, null = the RPC failed (rare -- rendered as an
  // honest unavailable note rather than crashing or silently hiding the
  // whole section).
  const [oddsInputs, setOddsInputs] = useState(undefined);
  useEffect(() => {
    if (!job || people === undefined) return;
    let cancelled = false;
    setOddsInputs(undefined);
    const matchScore = matchJob(job, preferences, currentUser.classYear).score;
    fetchRealOddsInputs(job, { matchScore, people, savedConnections, coffeeChatStatus })
      .then((inputs) => {
        if (!cancelled) setOddsInputs(inputs);
      })
      .catch(() => {
        if (!cancelled) setOddsInputs(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, people]);

  if (job === undefined) return <Placeholder title="Loading…" />;
  if (job === null) return <Placeholder title="Job not found" />;

  const companyPage = COMPANIES.find((c) => c.name === job.company);

  const match = matchJob(job, preferences, currentUser.classYear);
  const extraPrepHours = prepLogged[job.id] || 0;
  const odds = oddsInputs ? computeRealOdds(oddsInputs, { extraPrepHours }) : null;
  const oddsComputeFn = (_j, opts) => computeRealOdds(oddsInputs, opts);
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
                {job.active && job.status === "potentially_expired" && (
                  <span className="chip">Possibly no longer open</span>
                )}
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
                  <span>
                    {f.label}
                    {f.key === "industry" && job.classification_method && (
                      <span className="meta" style={{ display: "block" }}>
                        {CLASSIFICATION_METHOD_LABEL[job.classification_method] ?? job.classification_method}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {!match.eligible && (
              <p className="meta" style={{ marginTop: "var(--space-3)" }}>
                This role's requirements don't match your profile's graduation year or opportunity-type preference.
              </p>
            )}
          </div>

          {odds ? (
            <OddsModel odds={odds} onLogPrep={() => setShowLogPrepModal(true)} />
          ) : oddsInputs === null ? (
            <div className="detail-section">
              <h2 className="detail-section__title">Your realistic odds</h2>
              <p className="meta">Couldn't load the odds model for this posting right now.</p>
            </div>
          ) : (
            <div className="detail-section">
              <h2 className="detail-section__title">Your realistic odds</h2>
              <Skeleton lines={4} />
            </div>
          )}

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
          <div className="rail-card is-accent">
            <div className="rail-card__title">UC members at {job.company}</div>
            {people === undefined && <p className="meta" style={{ margin: 0 }}>Loading…</p>}
            {people?.length === 0 && (
              <p className="meta" style={{ margin: 0 }}>
                No UC members on record at {job.company} yet.
              </p>
            )}
            {people?.slice(0, 3).map((p) => (
              <div className="person-row" key={p.id}>
                <div>
                  <div className="person-row__name">{p.name}</div>
                  <div className="person-row__meta">{p.role || p.status}</div>
                </div>
                <Link to={`/network/${p.id}`} className="btn btn-secondary">
                  Profile
                </Link>
              </div>
            ))}
            {people?.length > 3 && (
              <button className="btn-link" style={{ marginTop: "var(--space-3)" }}>
                See all {people.length} UC members
              </button>
            )}
            {companyPage && (
              <Link to={`/companies/${companyPage.id}`} className="btn-link" style={{ display: "block", marginTop: "var(--space-3)" }}>
                See {job.company}'s full company page →
              </Link>
            )}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">About this listing</div>
            <p className="meta" style={{ margin: 0 }}>
              This is a real posting (admin/member-submitted or from an automated source). The odds
              model above and profile-fit checklist are real, computed from your own preferences and
              the real application tracker -- interview write-ups and past-cycle stage timelines still
              don't exist for real postings, since no one has contributed one yet.
            </p>
          </div>
        </div>
      </div>

      {showLogPrepModal && <LogPrepModal job={job} computeOddsFn={oddsComputeFn} onClose={() => setShowLogPrepModal(false)} />}
    </div>
  );
}
