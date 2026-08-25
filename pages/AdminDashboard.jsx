import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PostOpportunityModal from "../components/modals/PostOpportunityModal.jsx";
import { supabase } from "../data/supabaseClient.js";
import {
  KPIS,
  INDUSTRY_INTEREST,
  biggestGap,
  CLASS_YEAR_BREAKDOWN,
  MOST_TARGETED_COMPANIES,
  MEMBER_ENGAGEMENT,
  ACCESS_CONTROL,
  FLAGGED_FEED_POSTS,
} from "../data/mockAdmin.js";
import "../styles/jobs.css";
import "../styles/jobDetail.css";
import "../styles/network.css";
import "../styles/resources.css";
import "../styles/admin.css";

const FEATURE_REQUEST_STATUS_LABEL = {
  pending: "Pending",
  approved: "Approved",
  in_progress: "In progress",
  done: "Done",
  declined: "Declined",
};

// Opportunity queue (Stage 2) reads/writes real Supabase data --
// opportunity_submissions for the queue itself, promoting an approved
// submission into a real jobs row. Everything else on this page (KPIs,
// industry interest, etc.) is still the mock-data prototype layer; only the
// queue has a real backend behind it so far.
export default function AdminDashboard() {
  const [showPostModal, setShowPostModal] = useState(false);
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState(null);
  const [queueNote, setQueueNote] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(true);
  const [duplicatesError, setDuplicatesError] = useState(null);
  const [duplicatesNote, setDuplicatesNote] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [lowQualityJobs, setLowQualityJobs] = useState([]);
  const [lowQualityLoading, setLowQualityLoading] = useState(true);
  const [lowQualityError, setLowQualityError] = useState(null);
  const [brokenLinkJobs, setBrokenLinkJobs] = useState([]);
  const [brokenLinkLoading, setBrokenLinkLoading] = useState(true);
  const [brokenLinkError, setBrokenLinkError] = useState(null);
  const [featureRequests, setFeatureRequests] = useState([]);
  const [featureRequestsLoading, setFeatureRequestsLoading] = useState(true);
  const [featureRequestsError, setFeatureRequestsError] = useState(null);
  const [updatingRequestId, setUpdatingRequestId] = useState(null);
  const gap = biggestGap();
  const maxMembers = Math.max(...INDUSTRY_INTEREST.map((i) => i.members));

  // US-09 -- duplicate_tier/duplicate_best_job_id are written by
  // score-submission-duplicate right after a member submits (see that
  // function's header comment), so the queue can show the signal before an
  // admin clicks Approve, not only after. Same batched-lookup enrichment
  // pattern as loadDuplicates() below, for the same reason (one extra
  // query instead of N+1).
  async function loadQueue() {
    setQueueLoading(true);
    const { data, error } = await supabase
      .from("opportunity_submissions")
      .select("*")
      .in("status", ["needs_review", "live"])
      .order("created_at", { ascending: false });
    if (error) {
      setQueueError(error.message);
      setQueueLoading(false);
      return;
    }
    const matchedJobIds = [...new Set((data ?? []).map((o) => o.duplicate_best_job_id).filter(Boolean))];
    const { data: matchedJobs } = matchedJobIds.length > 0
      ? await supabase.from("jobs").select("id, title, company").in("id", matchedJobIds)
      : { data: [] };
    const jobById = Object.fromEntries((matchedJobs ?? []).map((j) => [j.id, j]));
    setQueue((data ?? []).map((o) => ({ ...o, duplicateMatchJob: o.duplicate_best_job_id ? jobById[o.duplicate_best_job_id] : null })));
    setQueueLoading(false);
  }

  // duplicate_candidates (US-18) -- populated by both approve-submission and
  // fetch-greenhouse-stripe's dedup scoring whenever a job lands in the
  // 70-89 review band. Each candidate is enriched with both jobs' own
  // title/company here (one extra query) rather than N+1 queries per row.
  async function loadDuplicates() {
    setDuplicatesLoading(true);
    const { data: candidates, error } = await supabase
      .from("duplicate_candidates")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      setDuplicatesError(error.message);
      setDuplicatesLoading(false);
      return;
    }
    const jobIds = [...new Set((candidates ?? []).flatMap((c) => [c.job_id_a, c.job_id_b]))];
    const { data: jobs } = jobIds.length > 0
      ? await supabase.from("jobs").select("id, title, company").in("id", jobIds)
      : { data: [] };
    const jobById = Object.fromEntries((jobs ?? []).map((j) => [j.id, j]));
    setDuplicates((candidates ?? []).map((c) => ({ ...c, jobA: jobById[c.job_id_a], jobB: jobById[c.job_id_b] })));
    setDuplicatesLoading(false);
  }

  // feature_requests -- deliberately not anonymized like duplicate_candidates
  // or the company-demand report: the whole point of this feature (per the
  // ask) is admins seeing exactly who requested what, so submitted_by_name
  // is shown directly, not aggregated.
  async function loadFeatureRequests() {
    setFeatureRequestsLoading(true);
    const { data, error } = await supabase
      .from("feature_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setFeatureRequestsError(error.message);
    else setFeatureRequests(data ?? []);
    setFeatureRequestsLoading(false);
  }

  // US-52 -- quality_score is computed and stored at ingestion time
  // (_shared/pipeline/quality.ts) for every job, but nothing surfaced it
  // before this. Threshold (<0.5) rather than an unconditional "bottom N"
  // list -- an always-populated table would misrepresent a genuinely
  // healthy board as having a standing quality problem. Direct client
  // query, not an Edge Function: read-only, and jobs_select_admin's RLS
  // policy already grants admins full read access (unlike the write paths
  // elsewhere on this page, which do need service_role).
  async function loadLowQualityJobs() {
    setLowQualityLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("id, company, title, quality_score, application_url")
      .eq("active", true)
      .lt("quality_score", 0.5)
      .order("quality_score", { ascending: true })
      .limit(15);
    if (error) setLowQualityError(error.message);
    else setLowQualityJobs(data ?? []);
    setLowQualityLoading(false);
  }

  // The other real half of US-52 -- deferred at the time the Job quality
  // panel above was built because "live application-URL health checks
  // aren't meaningful yet with no real automated source running" (see
  // quality.ts's own header comment, and JOB_ENGINE_ARCHITECTURE.md's
  // matching note). That's no longer true: check-job-links now runs daily
  // against every active job's application_url and writes link_health
  // (20260825110000). Direct client query, same reasoning as
  // loadLowQualityJobs -- read-only, jobs_select_admin's RLS already
  // covers it, no Edge Function needed.
  async function loadBrokenLinkJobs() {
    setBrokenLinkLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("id, company, title, application_url, link_check_failures, last_link_checked_at")
      .eq("active", true)
      .eq("link_health", "broken")
      .order("last_link_checked_at", { ascending: false })
      .limit(25);
    if (error) setBrokenLinkError(error.message);
    else setBrokenLinkJobs(data ?? []);
    setBrokenLinkLoading(false);
  }

  useEffect(() => {
    loadQueue();
    loadDuplicates();
    loadFeatureRequests();
    loadLowQualityJobs();
    loadBrokenLinkJobs();
  }, []);

  // feature_requests grants admins direct update access via RLS (unlike
  // jobs/job_sources) since there's no equivalent trust boundary here --
  // an admin changing a request's status doesn't need to write to a table
  // regular members have no access to at all, so a plain client update is
  // enough, no Edge Function needed.
  async function handleUpdateRequestStatus(request, status) {
    setUpdatingRequestId(request.id);
    setFeatureRequestsError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("feature_requests")
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", request.id);

    if (error) setFeatureRequestsError(error.message);
    await loadFeatureRequests();
    setUpdatingRequestId(null);
  }

  // Runs the real reassign-sources-and-deactivate flow server-side
  // (supabase/functions/resolve-duplicate-candidate) for a confirmed
  // duplicate, or just records the review for "not a duplicate" -- see that
  // function's header for why this needs service_role rather than a direct
  // client update (job_sources grants no client writes to anyone).
  async function handleResolveDuplicate(candidate, resolution, keepJobId) {
    setResolvingId(candidate.id);
    setDuplicatesError(null);
    setDuplicatesNote(null);

    const { data, error } = await supabase.functions.invoke("resolve-duplicate-candidate", {
      body: { candidateId: candidate.id, resolution, keepJobId },
    });

    if (error) {
      const detail = await error.context?.json?.().catch(() => null);
      setDuplicatesError(detail?.error ?? error.message);
    } else if (data?.outcome === "confirmed_duplicate") {
      const kept = keepJobId === candidate.job_id_a ? candidate.jobA : candidate.jobB;
      const mergedNote = data.mergedFields?.length > 0 ? ` Merged in from the duplicate: ${data.mergedFields.join(", ")}.` : "";
      setDuplicatesNote(`Kept "${kept?.title ?? "the selected listing"}" -- the duplicate was deactivated and its sources reassigned.${mergedNote}`);
    } else {
      setDuplicatesNote("Marked as not a duplicate.");
    }

    await loadDuplicates();
    setResolvingId(null);
  }

  // Approve runs the real normalize/validate/dedup/enrich pipeline server-side
  // (supabase/functions/approve-submission), not a client-side field copy --
  // see that function's header comment for why this has to be an Edge
  // Function (service_role, admin check re-derived server-side) rather than
  // a direct client insert.
  async function handleApprove(submission) {
    setActioningId(submission.id);
    setQueueError(null);
    setQueueNote(null);

    const { data, error } = await supabase.functions.invoke("approve-submission", {
      body: { submissionId: submission.id },
    });

    if (error) {
      // Edge Function errors arrive as a generic FunctionsHttpError; the
      // actual message is on the response body, not `error.message`.
      const detail = await error.context?.json?.().catch(() => null);
      setQueueError(detail?.error ?? error.message);
    } else if (data?.outcome === "merged") {
      setQueueNote(`Matched an existing listing (score ${data.matchedScore}) -- attached as an additional source instead of creating a duplicate.`);
    } else if (data?.outcome === "live_flagged_duplicate") {
      setQueueNote(`Live, but flagged as a possible duplicate (score ${data.duplicateScore}) -- see the duplicate review queue.`);
    }

    await loadQueue();
    setActioningId(null);
  }

  async function handleReject(submission) {
    setActioningId(submission.id);
    setQueueError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("opportunity_submissions")
      .update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", submission.id);

    if (error) setQueueError(error.message);
    await loadQueue();
    setActioningId(null);
  }

  return (
    <div>
      <div className="jobs-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1>Admin Dashboard</h1>
          <p className="meta">Aggregate interest and engagement — never an individual member's application list.</p>
        </div>
        <div className="jobs-header__actions">
          <select defaultValue="Fall 2026">
            <option>Fall 2026</option>
            <option>Spring 2026</option>
          </select>
          <button className="btn btn-secondary">Export report</button>
          <button className="btn btn-primary" onClick={() => setShowPostModal(true)}>+ Post opportunity</button>
        </div>
      </div>

      <div className="admin-kpi-strip">
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.activeMembers}</div>
          <div className="admin-kpi-cell__label">Active members</div>
          <div className="admin-kpi-cell__change">+{KPIS.activeMembersChange} vs last quarter</div>
        </div>
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.profilesUpToDatePct}%</div>
          <div className="admin-kpi-cell__label">Profiles up to date</div>
          <div className="admin-kpi-cell__change">{KPIS.staleProfiles} stale</div>
        </div>
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.applicationsTracked}</div>
          <div className="admin-kpi-cell__label">Applications tracked</div>
          <div className="admin-kpi-cell__change">{KPIS.applicationsPerMember} per member</div>
        </div>
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.coffeeChatsBooked}</div>
          <div className="admin-kpi-cell__label">Coffee chats booked</div>
          <div className="admin-kpi-cell__change">+{KPIS.coffeeChatsChange} vs last cycle</div>
        </div>
        <div className="admin-kpi-cell">
          <div className="admin-kpi-cell__number">{KPIS.offersReported}</div>
          <div className="admin-kpi-cell__label">Offers reported</div>
          <div className="admin-kpi-cell__change">
            {KPIS.offersInternship} internships · {KPIS.offersFullTime} FT
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-section">
            <h2 className="detail-section__title">Where members want to work</h2>
            {INDUSTRY_INTEREST.map((i) => (
              <div className="industry-bar-row" key={i.industry}>
                <span>{i.industry}</span>
                <div className="industry-bar-track">
                  <div className="industry-bar-fill" style={{ width: `${(i.members / maxMembers) * 100}%` }} />
                </div>
                <span className="meta">{i.members}</span>
              </div>
            ))}
            <div className="gap-insight">
              Gap: {gap.members} members target {gap.industry} but UC has only {gap.alumni} alumni there — a
              recruiting-outreach target for this cycle.
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Class-year breakdown</h2>
            <div className="class-year-grid">
              {CLASS_YEAR_BREAKDOWN.map((c) => (
                <div className="class-year-cell" key={c.year}>
                  <div className="class-year-cell__label">{c.label}</div>
                  <div className="class-year-cell__year">Class of {c.year}</div>
                  <p className="meta">{c.members} members</p>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${c.profileCompletePct}%` }} />
                  </div>
                  <p className="meta" style={{ marginBottom: 0 }}>{c.profileCompletePct}% profiles complete</p>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Opportunity queue</h2>
            {queueError && <p className="meta" style={{ color: "#B3261E" }}>{queueError}</p>}
            {queueNote && <p className="meta">{queueNote}</p>}
            <div className="queue-table__scroll">
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((o) => (
                  <tr key={o.id}>
                    <td>
                      {o.company}
                      {o.duplicate_tier && o.duplicate_tier !== "distinct" && (
                        <div className="meta" style={{ color: "#B3261E" }}>
                          {o.duplicate_tier === "auto_merge" ? "Likely duplicate" : "Possible duplicate"} of{" "}
                          {o.duplicateMatchJob ? `"${o.duplicateMatchJob.title}" (${o.duplicateMatchJob.company})` : "an existing listing"}
                          {" "}· {Math.round(o.duplicate_best_score)}% match
                        </div>
                      )}
                    </td>
                    <td>{o.role}</td>
                    <td>{new Date(o.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                    <td>
                      <span className="chip chip-accent">{o.status === "live" ? "Live" : "Needs review"}</span>
                    </td>
                    <td>
                      <div className="queue-table__actions">
                        {o.status === "needs_review" && (
                          <button className="btn btn-secondary" disabled={actioningId === o.id} onClick={() => handleApprove(o)}>
                            {actioningId === o.id ? "Approving…" : "Approve"}
                          </button>
                        )}
                        {o.status === "needs_review" && (
                          <button className="btn btn-secondary" disabled={actioningId === o.id} onClick={() => handleReject(o)}>
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!queueLoading && queue.length === 0 && (
                  <tr>
                    <td colSpan={5} className="meta">
                      Queue is empty.
                    </td>
                  </tr>
                )}
                {queueLoading && (
                  <tr>
                    <td colSpan={5} className="meta">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Duplicate review queue</h2>
            <p className="meta" style={{ marginTop: 0 }}>
              Flagged by dedup scoring (70–89 confidence band) on either a member/admin submission or an
              automated source -- not auto-merged, since the signals weren't strong enough to be certain.
            </p>
            {duplicatesError && <p className="meta" style={{ color: "#B3261E" }}>{duplicatesError}</p>}
            {duplicatesNote && <p className="meta">{duplicatesNote}</p>}
            <div className="queue-table__scroll">
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Job A</th>
                  <th>Job B</th>
                  <th>Score</th>
                  <th>Flagged</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {d.jobA?.title ?? "(job removed)"}
                      <div className="meta">{d.jobA?.company}</div>
                    </td>
                    <td>
                      {d.jobB?.title ?? "(job removed)"}
                      <div className="meta">{d.jobB?.company}</div>
                    </td>
                    <td>{d.score}</td>
                    <td>{new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                    <td>
                      <div className="queue-table__actions">
                        <button
                          className="btn btn-secondary"
                          disabled={resolvingId === d.id}
                          onClick={() => handleResolveDuplicate(d, "confirmed_duplicate", d.job_id_a)}
                        >
                          Keep A
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={resolvingId === d.id}
                          onClick={() => handleResolveDuplicate(d, "confirmed_duplicate", d.job_id_b)}
                        >
                          Keep B
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={resolvingId === d.id}
                          onClick={() => handleResolveDuplicate(d, "not_duplicate")}
                        >
                          Not a duplicate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!duplicatesLoading && duplicates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="meta">
                      No pending duplicates.
                    </td>
                  </tr>
                )}
                {duplicatesLoading && (
                  <tr>
                    <td colSpan={5} className="meta">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Job quality</h2>
            <p className="meta" style={{ marginTop: 0 }}>
              Active postings scoring below 0.5 on completeness/confidence (computed at ingestion) --
              missing fields worth checking, not necessarily broken. Dead application links are a
              separate, live signal now -- see "Broken links" below.
            </p>
            {lowQualityError && <p className="meta" style={{ color: "#B3261E" }}>{lowQualityError}</p>}
            <div className="queue-table__scroll">
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Quality score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lowQualityJobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.company}</td>
                    <td>{j.title}</td>
                    <td>{j.quality_score}</td>
                    <td>
                      <Link to={`/jobs/${j.id}`} className="btn btn-secondary">View</Link>
                    </td>
                  </tr>
                ))}
                {!lowQualityLoading && lowQualityJobs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="meta">
                      No active postings currently score below 0.5 -- nothing needs a closer look.
                    </td>
                  </tr>
                )}
                {lowQualityLoading && (
                  <tr>
                    <td colSpan={4} className="meta">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Broken links</h2>
            <p className="meta" style={{ marginTop: 0 }}>
              Active postings whose application_url has failed 3+ consecutive daily checks (check-job-links,
              scheduled via pg_cron) -- HEAD, falling back to GET, plus a redirect check that catches a real
              gap plain status codes miss: several ATS-hosted job pages return HTTP 200 but silently redirect
              a removed posting's URL to the company's generic careers page. A single failed check never
              flags anything here -- one transient timeout is still plausibly a blip, not a dead link. Jobs
              behind bot/CAPTCHA challenges that block automated requests entirely (confirmed live: Carvana)
              are deliberately left out of this list rather than mass-flagged -- there's no reliable way to
              tell a blocked-but-live posting apart from a genuinely dead one from the response alone.
            </p>
            {brokenLinkError && <p className="meta" style={{ color: "#B3261E" }}>{brokenLinkError}</p>}
            <div className="queue-table__scroll">
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Consecutive failures</th>
                  <th>Last checked</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {brokenLinkJobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.company}</td>
                    <td>{j.title}</td>
                    <td>{j.link_check_failures}</td>
                    <td className="meta">
                      {j.last_link_checked_at
                        ? new Date(j.last_link_checked_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : "Never"}
                    </td>
                    <td>
                      <Link to={`/jobs/${j.id}`} className="btn btn-secondary">View</Link>
                    </td>
                  </tr>
                ))}
                {!brokenLinkLoading && brokenLinkJobs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="meta">
                      No active postings currently flagged with a broken application link.
                    </td>
                  </tr>
                )}
                {brokenLinkLoading && (
                  <tr>
                    <td colSpan={5} className="meta">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Feature requests</h2>
            {featureRequestsError && <p className="meta" style={{ color: "#B3261E" }}>{featureRequestsError}</p>}
            <div className="queue-table__scroll">
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Requested by</th>
                  <th>Request</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {featureRequests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.submitted_by_name}
                      <div className="meta">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{r.title}</div>
                      <div className="meta">{r.description}</div>
                    </td>
                    <td>{r.category ?? "—"}</td>
                    <td>
                      <span className={`chip${r.status === "declined" ? "" : " chip-accent"}`}>
                        {FEATURE_REQUEST_STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td>
                      <div className="queue-table__actions">
                        {r.status === "pending" && (
                          <>
                            <button className="btn btn-secondary" disabled={updatingRequestId === r.id} onClick={() => handleUpdateRequestStatus(r, "approved")}>
                              Approve
                            </button>
                            <button className="btn btn-secondary" disabled={updatingRequestId === r.id} onClick={() => handleUpdateRequestStatus(r, "declined")}>
                              Decline
                            </button>
                          </>
                        )}
                        {r.status === "approved" && (
                          <button className="btn btn-secondary" disabled={updatingRequestId === r.id} onClick={() => handleUpdateRequestStatus(r, "in_progress")}>
                            Mark in progress
                          </button>
                        )}
                        {r.status === "in_progress" && (
                          <button className="btn btn-secondary" disabled={updatingRequestId === r.id} onClick={() => handleUpdateRequestStatus(r, "done")}>
                            Mark done
                          </button>
                        )}
                        {(r.status === "done" || r.status === "declined") && <span className="meta">No action needed</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!featureRequestsLoading && featureRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="meta">
                      No feature requests yet.
                    </td>
                  </tr>
                )}
                {featureRequestsLoading && (
                  <tr>
                    <td colSpan={5} className="meta">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <div className="detail-rail">
          <div className="rail-card">
            <div className="rail-card__title">Most targeted companies</div>
            {MOST_TARGETED_COMPANIES.map((c) => (
              <div className="company-count-row" key={c.company}>
                <span>{c.company}</span>
                <span>{c.members}</span>
              </div>
            ))}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Member engagement</div>
            <div className="engagement-row">
              <span>Logged in this week</span>
              <span>{MEMBER_ENGAGEMENT.loggedInThisWeek}</span>
            </div>
            <div className="engagement-row">
              <span>Tracking ≥1 application</span>
              <span>{MEMBER_ENGAGEMENT.trackingAtLeastOne}</span>
            </div>
            <div className="engagement-row">
              <span>Booked a coffee chat</span>
              <span>{MEMBER_ENGAGEMENT.bookedCoffeeChat}</span>
            </div>
            <div className="engagement-row">
              <span>Contributed a resource</span>
              <span>{MEMBER_ENGAGEMENT.contributedResource}</span>
            </div>
            <div className="engagement-row is-accent">
              <span>Never opened the platform</span>
              <span>{MEMBER_ENGAGEMENT.neverOpened}</span>
            </div>
            <button className="btn btn-secondary" style={{ marginTop: "var(--space-4)", width: "100%" }}>
              Nudge inactive members
            </button>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Content management</div>
            <Link to="/resources" className="content-mgmt-link">
              <span>Add resource</span>
            </Link>
            <Link to="/companies" className="content-mgmt-link">
              <span>Manage company pages</span>
            </Link>
            <Link to="/feed" className="content-mgmt-link">
              <span>Moderate feed</span>
              <span className="chip chip-accent">{FLAGGED_FEED_POSTS} flagged</span>
            </Link>
            <a href="#" className="content-mgmt-link" onClick={(e) => e.preventDefault()}>
              <span>Post announcement</span>
            </a>
            <Link to="/admin/members" className="content-mgmt-link">
              <span>Manage member access</span>
            </Link>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Access control</div>
            <p className="meta" style={{ marginBottom: "var(--space-2)" }}>{ACCESS_CONTROL.provisioned}</p>
            <p className="meta" style={{ marginBottom: "var(--space-2)" }}>{ACCESS_CONTROL.autoConversion}</p>
            <p className="meta" style={{ marginBottom: 0 }}>{ACCESS_CONTROL.pendingRemovals} pending removals</p>
          </div>
        </div>
      </div>

      {showPostModal && <PostOpportunityModal onClose={() => setShowPostModal(false)} />}
    </div>
  );
}
