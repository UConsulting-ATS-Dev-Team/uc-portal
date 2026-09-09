import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { findCompany } from "../data/mockCompanies.js";
import { statsFor, quotesFor, activityFor } from "../data/companyUtils.js";
import { deadlineLabel } from "../data/jobUtils.js";
import { fetchLiveJobsByCompany } from "../data/companyLiveJobs.js";
import { realJobToCardShape } from "../data/realJobAdapter.js";
import { fetchRealPeopleAtCompany } from "../data/realPeople.js";
import { COMPANIES } from "../data/mockCompanies.js";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
import { resolvedClassYear } from "../data/profileUtils.js";
import Placeholder from "./Placeholder.jsx";
import CompanyLogo from "../components/CompanyLogo.jsx";
import "../styles/jobs.css";
import "../styles/jobDetail.css";
import "../styles/network.css";
import "../styles/companies.css";
import "../styles/home.css"; // .empty-state, reused by the "no live feed" panel below

const TABS = ["Overview", "Opportunities", "UC connections", "Recruiting intelligence", "Activity"];
const TIMELINE_STAGES = ["Interested", "Preparing", "Applied", "Interviews", "Offer"];
const PREP_RESOURCES = ["Case Interview Fundamentals", "Behavioral Prep Guide", "Company Interview Playbook"];

export default function CompanyPage() {
  const { companyId } = useParams();
  const company = findCompany(companyId);
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

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setLiveJobs(undefined);
    fetchLiveJobsByCompany([company.name])
      .then((byCompany) => {
        if (!cancelled) setLiveJobs(byCompany.get(company.name) ?? []);
      })
      .catch(() => {
        if (!cancelled) setLiveJobs([]);
      });
    setRealPeople(undefined);
    fetchRealPeopleAtCompany(company.name)
      .then((people) => {
        if (!cancelled) setRealPeople(people);
      })
      .catch(() => {
        if (!cancelled) setRealPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  if (!company) {
    return <Placeholder title="Company not found" />;
  }

  const people = realPeople ?? [];
  const stats = { ...statsFor(company), ucAlumni: realPeople === undefined ? "…" : people.length };
  const hasLiveFeed = Array.isArray(liveJobs) && liveJobs.length > 0;
  const openRolesDisplay = liveJobs === undefined ? "…" : hasLiveFeed ? String(liveJobs.length) : "—";
  const openRolesLabel = liveJobs !== undefined && !hasLiveFeed ? "No live feed" : "Open roles";
  const isWatched = preferences.followedCompanies.includes(company.name);
  const stageCount = stats.offers > 0 ? 5 : stats.ucApplicants >= 5 ? 3 : stats.ucApplicants > 0 ? 2 : 1;
  const quotes = quotesFor(company);
  const activity = activityFor(company);
  const officeCounts = company.offices.map((o) => ({ office: o, count: people.filter((p) => p.office === o).length }));
  const similar = COMPANIES.filter((c) => c.industry === company.industry && c.id !== company.id).slice(0, 2);

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
            <span className="chip">{stats.ucAlumni} UC alumni</span>
          </div>
          <p className="company-header__meta">
            {company.industry} · {company.size} · {company.offices.join(", ")}
          </p>
          <p style={{ marginBottom: "var(--space-5)" }}>{company.description}</p>
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
                  <div className="stat-strip__number">{stats.ucApplicants}</div>
                  <div className="stat-strip__label">UC applicants</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{stats.offerRate}%</div>
                  <div className="stat-strip__label">UC offer rate</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{openRolesDisplay}</div>
                  <div className="stat-strip__label">{openRolesLabel}</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{stats.ucAlumni}</div>
                  <div className="stat-strip__label">UC alumni here</div>
                </div>
              </div>
              <p>{company.characterization}</p>
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
                    {company.name} doesn't publish postings through a source UC can pull from automatically yet — no
                    public API or syndicated feed we've verified. Rather than guess at specific openings, here's
                    their own careers page directly.
                  </p>
                  <div style={{ display: "flex", gap: "var(--space-3)", margin: "var(--space-5) 0" }}>
                    <a className="btn btn-primary" href={company.careersUrl} target="_blank" rel="noreferrer">
                      Open {company.name}'s careers page ↗
                    </a>
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
                        <div className="writeup-card" key={q.author}>
                          <div className="writeup-card__meta">
                            <strong>{q.author}</strong>
                            <span className="meta">'{String(q.classYear).slice(2)}</span>
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
                  <div className="stat-strip__number">{stats.ucApplicants}</div>
                  <div className="stat-strip__label">UC applicants</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{stats.finalRounds}</div>
                  <div className="stat-strip__label">Reached final round</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{stats.offerRate}%</div>
                  <div className="stat-strip__label">UC offer rate</div>
                </div>
                <div className="stat-strip__cell">
                  <div className="stat-strip__number">{stats.medianPrepHours} hrs</div>
                  <div className="stat-strip__label">Median prep, offer-holders</div>
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
              <p style={{ fontWeight: 700, marginBottom: "var(--space-3)" }}>What UC members say</p>
              {quotes.map((q) => (
                <div className="writeup-card" key={q.author}>
                  <div className="writeup-card__meta">
                    <strong>{q.author}</strong>
                    <span className="meta">'{String(q.classYear).slice(2)}</span>
                  </div>
                  <p style={{ margin: 0 }}>"{q.body}"</p>
                </div>
              ))}
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
            {officeCounts.map((o) => (
              <div className="company-count-row" key={o.office}>
                <span>{o.office}</span>
                <span>{o.count}</span>
              </div>
            ))}
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
