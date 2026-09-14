import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { findCompany } from "../data/mockCompanies.js";
import { deadlineLabel } from "../data/jobUtils.js";
import { fetchLiveJobsByCompany } from "../data/companyLiveJobs.js";
import { realJobToCardShape } from "../data/realJobAdapter.js";
import { fetchRealPeopleAtCompany } from "../data/realPeople.js";
import { deriveCompanyProfile, fetchRealCompanySummaries, fetchRealCompanyStats, liveCharacterization } from "../data/realCompanies.js";
import { fetchRealWriteupsForCompany } from "../data/realWriteups.js";
import { COMPANIES } from "../data/mockCompanies.js";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
import { resolvedClassYear } from "../data/profileUtils.js";
import Placeholder from "./Placeholder.jsx";
import CompanyLogo from "../components/CompanyLogo.jsx";
import DemoDataBadge from "../components/DemoDataBadge.jsx";
import "../styles/jobs.css";
import "../styles/jobDetail.css";
import "../styles/network.css";
import "../styles/companies.css";
import "../styles/home.css"; // .empty-state, reused by the "no live feed" panel below

const TABS = ["Overview", "Opportunities", "UC connections", "Recruiting intelligence", "Activity"];
const TIMELINE_STAGES = ["Interested", "Preparing", "Applied", "Interviews", "Offer"];
const PREP_RESOURCES = ["Case Interview Fundamentals", "Behavioral Prep Guide", "Company Interview Playbook"];

export default function CompanyPage() {
  const { companyId, companyName: companyNameParam } = useParams();
  // Two distinct routes share this one page (see App.jsx's own comment):
  // /companies/:companyId for the 8 hand-authored mock companies, and
  // /companies/real/:companyName for every other real company, derived
  // fresh from real job data rather than looked up by a stored id.
  const isRealRoute = companyNameParam !== undefined;
  const realCompanyName = isRealRoute ? decodeURIComponent(companyNameParam) : null;
  const mockCompany = isRealRoute ? null : findCompany(companyId);
  const { preferences, updatePreferences, profileOverrides } = useAppState();
  const classYear = resolvedClassYear(currentUser, profileOverrides);
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");

  // Real jobs for this company, not data/mockJobs.js's jobsAt() -- see this
  // file's header comment (well, data/companyLiveJobs.js's) for why: several
  // of the companies here (Bain, McKinsey, Goldman Sachs, BCG, EY-Parthenon,
  // Accenture) have never had a real automated source, so their old mock
  // "open opportunities" list was fabricated data rendered exactly like a
  // real found posting -- specific role/location/deadline/match-score, an
  // Apply-adjacent "View" button, no visual distinction from Stripe's or
  // Deloitte's real ones. undefined = loading, [] = loaded with zero (either
  // genuinely no live feed, or a real feed with nothing active right now --
  // both get the same honest "no live feed" panel rather than a guess).
  const [liveJobs, setLiveJobs] = useState(undefined);

  // Real UConsulting Directory people at this company, not data/mockPeople.js's
  // peopleAt() -- see JOB_ENGINE_ARCHITECTURE.md's Stage 5 entry. undefined
  // while loading (kept separate from [] so ucAlumni/officeCounts below don't
  // flash "0" before the real fetch resolves).
  const [realPeople, setRealPeople] = useState(undefined);

  // Real recruiting-intelligence state (2026-09-09, extended 2026-09-11 to
  // cover the mock route too) -- see this file's header comment above
  // findCompany's old sole use. Originally real-route-only, with mock
  // companies kept on data/companyUtils.js's statsFor()/quotesFor()/
  // activityFor() -- entirely fabricated numbers and quotes attributed to
  // invented people, shown as fact on Deloitte's/Stripe's own real pages.
  // Direct follow-up ask ("go fix the mock companies too") extended this
  // real fetch to every company, mock or real -- see the stats/quotes/
  // activity consts below, no longer isRealRoute-gated.
  const [realStats, setRealStats] = useState(undefined);
  const [realWriteups, setRealWriteups] = useState(undefined);
  const [similarRealCompanies, setSimilarRealCompanies] = useState([]);

  const companyNameToFetch = isRealRoute ? realCompanyName : mockCompany?.name;

  useEffect(() => {
    if (!companyNameToFetch) return;
    let cancelled = false;
    setLiveJobs(undefined);
    fetchLiveJobsByCompany([companyNameToFetch])
      .then((byCompany) => {
        if (!cancelled) setLiveJobs(byCompany.get(companyNameToFetch) ?? []);
      })
      .catch(() => {
        if (!cancelled) setLiveJobs([]);
      });
    setRealPeople(undefined);
    fetchRealPeopleAtCompany(companyNameToFetch)
      .then((people) => {
        if (!cancelled) setRealPeople(people);
      })
      .catch(() => {
        if (!cancelled) setRealPeople([]);
      });
    // Real recruiting-intelligence stats and write-ups -- fetched for
    // every company now, mock or real (see the state comment above).
    setRealStats(undefined);
    fetchRealCompanyStats(companyNameToFetch)
      .then((s) => {
        if (!cancelled) setRealStats(s);
      })
      .catch(() => {
        if (!cancelled) setRealStats({ ucApplicants: 0, interviewCount: 0, offerCount: 0, offerRate: 0 });
      });
    setRealWriteups(undefined);
    fetchRealWriteupsForCompany(companyNameToFetch)
      .then((rows) => {
        if (!cancelled) setRealWriteups(rows);
      })
      .catch(() => {
        if (!cancelled) setRealWriteups([]);
      });
    if (isRealRoute) {
      fetchRealCompanySummaries(COMPANIES.map((c) => c.name))
        .then((summaries) => {
          if (cancelled) return;
          setSimilarRealCompanies(summaries.filter((c) => c.name !== companyNameToFetch));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [companyNameToFetch, isRealRoute]);

  if (!isRealRoute && !mockCompany) {
    return <Placeholder title="Company not found" />;
  }

  const people = realPeople ?? [];
  const hasLiveFeed = Array.isArray(liveJobs) && liveJobs.length > 0;

  // Real companies get a profile derived entirely from their own real
  // postings (data/realCompanies.js) -- never a hand-authored
  // characterization/description/size, matching the Opportunities tab's
  // own "no invented specifics" rule below. industry/offices only resolve
  // once liveJobs loads (same fetch the Opportunities tab already needs),
  // so this reads "…"/empty briefly on first render, same loading pattern
  // as every other real figure on this page.
  const company = isRealRoute
    ? {
        id: `real/${encodeURIComponent(realCompanyName)}`,
        name: realCompanyName,
        isReal: true,
        ...(liveJobs ? deriveCompanyProfile(realCompanyName, liveJobs) : { logoInitials: realCompanyName.slice(0, 3).toUpperCase(), industry: "…", offices: [] }),
        size: undefined,
        recruitingStatus: hasLiveFeed ? "Actively hiring" : liveJobs === undefined ? "…" : "No live feed",
        description: null,
        careersUrl: liveJobs?.[0]?.application_url ?? null,
      }
    : { ...mockCompany, isReal: false };

  // Real stats for every company now (2026-09-11) -- see
  // fetchRealCompanyStats's own comment for why (job_track_record_report(),
  // the same real security-definer aggregate the real odds model uses).
  // Used to be statsFor()'s mock-derived numbers for the 8 mock companies
  // (peopleAt()/jobsAt() against fictional data/mockPeople.js/mockJobs.js
  // rosters) -- direct follow-up ask ("go fix the mock companies too")
  // after the same fabrication was deliberately avoided when real
  // companies were added. "finalRounds"/"offers" have no real equivalent
  // from that RPC (it reports interview-stage progress and a genuine
  // offer count, not a rounds breakdown) -- interviewCount fills the
  // analogous "how far did people get" role in the JSX below instead.
  const stats = {
    ucApplicants: realStats?.ucApplicants ?? 0,
    offerRate: realStats?.offerRate ?? 0,
    offers: realStats?.offerCount ?? 0,
    finalRounds: realStats?.interviewCount ?? 0,
    medianPrepHours: null,
    ucAlumni: realPeople === undefined ? "…" : people.length,
  };
  const openRolesDisplay = liveJobs === undefined ? "…" : hasLiveFeed ? String(liveJobs.length) : "—";
  const openRolesLabel = liveJobs !== undefined && !hasLiveFeed ? "No live feed" : "Open roles";

  // "No data yet" vs. a genuine "0" -- direct follow-up ask alongside the
  // fabrication fix: a bare "0" (or "0%") reads as a confident negative
  // fact ("no one has ever gotten an offer here"), when what's actually
  // true is "nothing has been tracked here yet." Every real figure on
  // this page is a cumulative count since launch, so 0 always means "no
  // data," never "verified zero" -- same em-dash + relabel convention
  // already used for openRolesDisplay/openRolesLabel above. offerRate and
  // finalRounds/interviewCount are both gated on ucApplicants > 0 (not on
  // their own value) since a real "0%"/"0 reached interview" out of a
  // real nonzero applicant pool IS a genuine, meaningful fact worth
  // showing plainly -- only the "we have literally nothing tracked" case
  // gets the no-data treatment.
  const hasAlumniData = stats.ucAlumni !== "…" && stats.ucAlumni > 0;
  const alumniChipText = stats.ucAlumni === "…" ? "…" : hasAlumniData ? `${stats.ucAlumni} UC alumni` : "No UC alumni yet";
  const ucApplicantsDisplay = stats.ucApplicants > 0 ? { number: stats.ucApplicants, label: "UC applicants" } : { number: "—", label: "No applicants tracked yet" };
  const offerRateDisplay = stats.ucApplicants > 0 ? { number: `${stats.offerRate}%`, label: "UC offer rate" } : { number: "—", label: "No offer data yet" };
  const interviewDisplay =
    stats.ucApplicants > 0 ? { number: stats.finalRounds, label: "Reached interview stage" } : { number: "—", label: "No interview data yet" };
  const ucAlumniDisplay =
    stats.ucAlumni === "…" ? { number: "…", label: "UC alumni here" } : hasAlumniData ? { number: stats.ucAlumni, label: "UC alumni here" } : { number: "—", label: "No UC alumni yet" };

  const isWatched = preferences.followedCompanies.includes(company.name);
  const stageCount = stats.offers > 0 ? 5 : stats.ucApplicants >= 5 ? 3 : stats.ucApplicants > 0 ? 2 : 1;
  // Genuine submitted interview write-ups for every company now, in place
  // of quotesFor()'s fabricated ones (attributed to invented named
  // people) -- reshaped to the {author, classYear, body} shape the JSX
  // below already renders, honoring is_anonymous the same way
  // RealJobDetail.jsx's own write-up section does.
  const quotes = (realWriteups ?? [])
    .slice(0, 3)
    .map((w) => ({ id: w.id, author: w.is_anonymous ? "Anonymous UC member" : w.submitted_by_name || "A UC member", classYear: null, body: w.body }));
  // No real "community activity feed" data source exists yet for any
  // company -- every company gets the honest empty state below
  // (activity.length === 0), never activityFor()'s fabricated posts
  // about invented people.
  const activity = [];
  const officeCounts = company.offices.map((o) => ({ office: o, count: people.filter((p) => p.office === o).length }));
  // Capped at 2 back when this only ever had 7 other mock companies to
  // draw from; now that the real roster (data/realCompanies.js) has ~90
  // industry-classified companies to match against, 2 left real matches
  // on the table for no reason -- widened to 4.
  const similar = isRealRoute
    ? similarRealCompanies
        .filter((c) => c.industry === company.industry)
        .slice(0, 4)
        .map((c) => ({ id: `real/${encodeURIComponent(c.name)}`, name: c.name, logoInitials: c.logoInitials }))
    : COMPANIES.filter((c) => c.industry === company.industry && c.id !== company.id).slice(0, 4);

  function toggleWatch() {
    updatePreferences({
      followedCompanies: isWatched
        ? preferences.followedCompanies.filter((c) => c !== company.name)
        : [...preferences.followedCompanies, company.name],
    });
  }

  return (
    <div>
      <div className="company-header">
        <CompanyLogo name={company.name} initials={company.logoInitials} className="company-header__logo" />
        <div style={{ flex: 1 }}>
          <div className="company-header__title-row">
            <h1>{company.name}</h1>
            <span className="chip chip-accent">{company.recruitingStatus}</span>
            <span className="chip">{alumniChipText}</span>
            {!company.isReal && (
              <DemoDataBadge
                label="Demo company"
                title="One of 8 hand-authored companies from before the real pipeline existed -- a real company, but this page isn't auto-sourced from live postings the way the rest of the directory is"
              />
            )}
          </div>
          <p className="company-header__meta">
            {[company.industry, company.size, company.offices.join(", ")].filter(Boolean).join(" · ")}
          </p>
          {/* Real companies (company.isReal) have no hand-authored
              description -- never invented, see this file's header
              comment on the real-company branch above. */}
          {company.description && <p style={{ marginBottom: "var(--space-5)" }}>{company.description}</p>}
          <div className="company-header__actions">
            <button className="btn btn-primary" onClick={toggleWatch}>
              {isWatched ? "Watching ✓" : "Add to watchlist"}
            </button>
            <button className="btn btn-secondary" onClick={() => setTab("Opportunities")}>
              {liveJobs === undefined ? "See open roles" : hasLiveFeed ? `See ${liveJobs.length} open roles` : "See careers page"}
            </button>
            {/* No standalone "intro request" flow exists -- reuses the
                same real ?company= filter "See all N UC members" links
                to below, landing on the people who can actually field a
                coffee-chat request, rather than a dead click. */}
            <button className="btn btn-secondary" onClick={() => navigate(`/network?company=${encodeURIComponent(company.name)}`)}>
              Request an intro
            </button>
          </div>
        </div>
      </div>

      <div className="jobs-tabs">
        <div className="jobs-tabs__list">
          {TABS.map((t) => (
            <button key={t} className={`jobs-tabs__tab${tab === t ? " is-active" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          {tab === "Overview" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Overview</h2>
              <div className="stat-strip">
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{ucApplicantsDisplay.number}</div>
                  <div className="stat-strip__label">{ucApplicantsDisplay.label}</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{offerRateDisplay.number}</div>
                  <div className="stat-strip__label">{offerRateDisplay.label}</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{openRolesDisplay}</div>
                  <div className="stat-strip__label">{openRolesLabel}</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{ucAlumniDisplay.number}</div>
                  <div className="stat-strip__label">{ucAlumniDisplay.label}</div>
                </div>
              </div>
              {/* Generated from the same real numbers above, not a static
                  hand-authored claim -- see liveCharacterization's own
                  comment for why (a fixed sentence could drift out of sync
                  with real data; this can't). Held back while ucAlumni is
                  still "…" so it can't briefly claim "no data yet" a beat
                  before the real fetch resolves. */}
              {stats.ucAlumni !== "…" && <p>{liveCharacterization(stats)}</p>}
            </div>
          )}

          {tab === "Opportunities" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Open opportunities</h2>

              {liveJobs === undefined && <p className="meta">Loading…</p>}

              {liveJobs !== undefined && hasLiveFeed &&
                liveJobs.map((rawJob) => {
                  const j = realJobToCardShape(rawJob);
                  const isYourYear = j.classYears.includes(classYear);
                  return (
                    <div className="opportunity-row" key={j.id}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{j.role}</div>
                        <div className="opportunity-row__meta">
                          {j.location || j.workMode} · {j.type} · {deadlineLabel(j)}
                        </div>
                      </div>
                      {j.classYears.length > 0 && (
                        <span className={`chip${isYourYear ? " chip-accent" : ""}`}>
                          {isYourYear ? "Your grad year" : "Different grad year"}
                        </span>
                      )}
                      <Link to={`/jobs/${j.id}`} className="btn btn-secondary">
                        View
                      </Link>
                    </div>
                  );
                })}

              {/* "No live feed" panel -- deliberately not a job list. Several
                  of this app's companies (Bain, McKinsey, Goldman Sachs, BCG,
                  EY-Parthenon, Accenture) have no automated source UC can
                  legally pull postings from (no public API, no syndicated
                  feed -- see JOB_ENGINE_ARCHITECTURE.md's Stage 3/4 source
                  research). Rather than fabricate role/comp/deadline details
                  that would render identically to a real found posting, this
                  states the situation honestly, links straight to the
                  company's own real careers page, and surfaces only facts
                  the app can already trace elsewhere (UC's own historical
                  track record) -- never an invented specific opening. */}
              {liveJobs !== undefined && !hasLiveFeed && (
                <div className="empty-state" style={{ textAlign: "left" }}>
                  <h3 style={{ marginTop: 0 }}>We don't have a live jobs feed for {company.name}</h3>
                  <p className="meta">
                    {company.isReal
                      ? // Distinct from the mock-company copy below -- a real
                        // company only reaches this page because it DOES have
                        // an automated source; zero active postings here means
                        // its feed is genuinely empty right now (or over its
                        // company-tier cap, see data/companyTiers.js), not that
                        // no source exists.
                        `${company.name} has an automated source, but it isn't returning any active postings right now.`
                      : `${company.name} doesn't publish postings through a source UC can pull from automatically yet — no
                    public API or syndicated feed we've verified. Rather than guess at specific openings, here's
                    their own careers page directly.`}
                  </p>
                  <div style={{ display: "flex", gap: "var(--space-3)", margin: "var(--space-5) 0" }}>
                    {company.careersUrl && (
                      <a className="btn btn-primary" href={company.careersUrl} target="_blank" rel="noreferrer">
                        Open {company.name}'s careers page ↗
                      </a>
                    )}
                    <button
                      className="btn-link"
                      onClick={() =>
                        navigate("/feed", { state: { prefill: `Does anyone know of open roles at ${company.name} right now?` } })
                      }
                    >
                      Ask the network
                    </button>
                  </div>
                  {quotes.length > 0 && (
                    <>
                      <p style={{ fontWeight: 700, marginBottom: "var(--space-3)" }}>What UC members have said about recruiting here</p>
                      {quotes.map((q) => (
                        <div className="writeup-card" key={q.id}>
                          <div className="writeup-card__meta">
                            <strong>{q.author}</strong>
                            {q.classYear && <span className="meta">'{String(q.classYear).slice(2)}</span>}
                          </div>
                          <p style={{ margin: 0 }}>"{q.body}"</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "UC connections" && (
            <div className="detail-section">
              <h2 className="detail-section__title">UC members at {company.name}</h2>
              {people.length === 0 && <p className="meta">No UC members on record here yet.</p>}
              {people.map((p) => (
                <div className="person-row" key={p.id}>
                  <div>
                    <div className="person-row__name">{p.name}</div>
                    <div className="person-row__meta">
                      {p.role} · {p.office}
                    </div>
                  </div>
                  <Link to={`/network/${p.id}`} className="btn btn-secondary">
                    Profile
                  </Link>
                </div>
              ))}
            </div>
          )}

          {tab === "Recruiting intelligence" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Recruiting intelligence</h2>
              <div className="stat-strip">
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{ucApplicantsDisplay.number}</div>
                  <div className="stat-strip__label">{ucApplicantsDisplay.label}</div>
                </div>
                <div className="stat-strip__cell">
                  {/* job_track_record_report()'s real interview_count
                      measures reaching First/Final round combined (see
                      data/realOddsModel.js's identical "reached an
                      interview" label) -- the label says what the real
                      number actually is, not the finer-grained "final
                      round" breakdown the old fabricated stat implied. */}
                  <div className="stat-strip__number">{interviewDisplay.number}</div>
                  <div className="stat-strip__label">{interviewDisplay.label}</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{offerRateDisplay.number}</div>
                  <div className="stat-strip__label">{offerRateDisplay.label}</div>
                </div>
                {/* No real equivalent exists for "median prep hours" (the
                    tracker records no such field) -- omitted for every
                    company rather than shown as "null hrs" or a
                    fabricated number. */}
              </div>
              <div className="recruiting-timeline">
                {TIMELINE_STAGES.map((stage, i) => (
                  <div className="recruiting-timeline__stage" key={stage}>
                    <div className={`recruiting-timeline__bar${i < stageCount ? " is-complete" : ""}`} />
                    <div className="recruiting-timeline__label">{stage}</div>
                  </div>
                ))}
              </div>
              {quotes.length === 0 ? (
                <p className="meta">No interview write-ups shared for {company.name} yet.</p>
              ) : (
                <>
                  <p style={{ fontWeight: 700, marginBottom: "var(--space-3)" }}>What UC members say</p>
                  {quotes.map((q) => (
                    <div className="writeup-card" key={q.id}>
                      <div className="writeup-card__meta">
                        <strong>{q.author}</strong>
                        {q.classYear && <span className="meta">'{String(q.classYear).slice(2)}</span>}
                      </div>
                      <p style={{ margin: 0 }}>"{q.body}"</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === "Activity" && (
            <div className="detail-section">
              <h2 className="detail-section__title">Community activity</h2>
              {activity.length === 0 && <p className="meta">No recent activity from UC members here.</p>}
              {activity.map((a, i) => (
                <div className="activity-row" key={i}>
                  <div className="activity-row__avatar">{a.person.name.split(" ").map((p) => p[0]).join("")}</div>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detail-rail">
          <div className="rail-card is-accent">
            <div className="rail-card__title">UC members here</div>
            {realPeople !== undefined && people.length === 0 && <p className="meta">No UC members on record here yet.</p>}
            {people.slice(0, 3).map((p) => (
              <div className="person-row" key={p.id}>
                <div>
                  <div className="person-row__name">{p.name}</div>
                  <div className="person-row__meta">
                    {p.role} · {p.office}
                  </div>
                </div>
                <Link to={`/network/${p.id}`} className="btn btn-secondary">
                  Profile
                </Link>
              </div>
            ))}
            {people.length > 3 && (
              <Link
                to={`/network?company=${encodeURIComponent(company.name)}`}
                className="btn-link"
                style={{ display: "inline-block", marginTop: "var(--space-3)" }}
              >
                See all {people.length} UC members
              </Link>
            )}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Offices UC members work in</div>
            {/* A per-office 0 next to every real listed office read as a
                confident negative fact ("we know nobody's there") rather
                than "nobody's told us yet" -- one honest line instead, same
                fix as the stat-strip cells above. */}
            {people.length === 0 ? (
              <p className="meta">No UC members on record here yet.</p>
            ) : (
              officeCounts.map((o) => (
                <div className="company-count-row" key={o.office}>
                  <span>{o.office}</span>
                  <span>{o.count}</span>
                </div>
              ))
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
            <div className="rail-card__title">Similar companies</div>
            {similar.map((c) => (
              <Link to={`/companies/${c.id}`} className="similar-row" key={c.id} style={{ color: "inherit", textDecoration: "none" }}>
                <CompanyLogo name={c.name} initials={c.logoInitials} className="similar-row__logo" />
                <div style={{ flex: 1 }}>{c.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
