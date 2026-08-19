import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { findCompany } from "../data/mockCompanies.js";
import { statsFor, quotesFor, activityFor } from "../data/companyUtils.js";
import { jobsAt, deadlineLabel } from "../data/jobUtils.js";
import { peopleAt } from "../data/mockPeople.js";
import { COMPANIES } from "../data/mockCompanies.js";
import { useAppState } from "../data/store.jsx";
import Placeholder from "./Placeholder.jsx";
import "../styles/jobs.css";
import "../styles/jobDetail.css";
import "../styles/network.css";
import "../styles/companies.css";

const TABS = ["Overview", "Opportunities", "UC connections", "Recruiting intelligence", "Activity"];
const TIMELINE_STAGES = ["Interested", "Preparing", "Applied", "Interviews", "Offer"];
const PREP_RESOURCES = ["Case Interview Fundamentals", "Behavioral Prep Guide", "Company Interview Playbook"];

export default function CompanyPage() {
  const { companyId } = useParams();
  const company = findCompany(companyId);
  const { preferences, updatePreferences } = useAppState();
  const [tab, setTab] = useState("Overview");

  if (!company) {
    return <Placeholder title="Company not found" />;
  }

  const stats = statsFor(company);
  const jobs = jobsAt(company.name);
  const people = peopleAt(company.name);
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
        <div className="company-header__logo">{company.logoInitials}</div>
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
              See {stats.openRoles} open roles
            </button>
            <button className="btn btn-secondary">Request an intro</button>
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
                  <div className="stat-strip__number">{stats.openRoles}</div>
                  <div className="stat-strip__label">Open roles</div>
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
              {jobs.length === 0 && <p className="meta">No open roles posted right now.</p>}
              {jobs.map((j) => {
                const isYourYear = j.classYears.includes(2027);
                return (
                  <div className="opportunity-row" key={j.id}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{j.role}</div>
                      <div className="opportunity-row__meta">
                        {j.location} · {j.type} · {deadlineLabel(j)}
                      </div>
                    </div>
                    {isYourYear ? (
                      <span className="chip chip-accent">{j.matchScore}% match</span>
                    ) : (
                      <span className="chip">Not your year</span>
                    )}
                    <Link to={`/jobs/${j.id}`} className="btn btn-secondary">
                      View
                    </Link>
                  </div>
                );
              })}
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
              <button className="btn-link" style={{ marginTop: "var(--space-3)" }}>
                See all {people.length} UC members
              </button>
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
                <div className="similar-row__logo">{c.logoInitials}</div>
                <div style={{ flex: 1 }}>{c.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
