import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RESOURCES, CERTIFICATIONS, LEARNING_TRACKS } from "../data/mockResources.js";
import { JOBS } from "../data/mockJobs.js";
import { useAppState } from "../data/store.jsx";
import ContributeModal from "../components/modals/ContributeModal.jsx";
import CasePartnerFinder from "../components/CasePartnerFinder.jsx";
import "../styles/jobDetail.css";
import "../styles/resources.css";
import "../styles/network.css";

const CATEGORIES = ["Resume", "Cover letter", "Consulting cases", "Behavioral", "Networking", "Recruiting timelines", "Industry guides", "Company guides"];
const SKILL_CATEGORIES = ["Excel & modeling", "SQL & data", "AI & automation", "Slide & comms craft", "Accounting & finance"];

function daysAgo(dateStr) {
  return Math.max(0, Math.round((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)));
}

export default function CareerResources() {
  const { trackedJobs, savedResourceIds, resourceProgress, trackProgress } = useAppState();
  const [search, setSearch] = useState("");
  const [showContributeModal, setShowContributeModal] = useState(false);

  const interviewJob = Object.entries(trackedJobs)
    .map(([jobId, info]) => ({ job: JOBS.find((j) => j.id === jobId), stage: info.stage }))
    .find((e) => e.job && ["First round", "Final round"].includes(e.stage));

  const recommended = useMemo(() => {
    const companyGuide = interviewJob ? RESOURCES.find((r) => r.title.includes(interviewJob.job.company.split(" ")[0])) : null;
    const base = RESOURCES.filter((r) => r.category === "Consulting cases" || r.category === "Behavioral");
    const picks = companyGuide ? [companyGuide, ...base] : base;
    return picks.slice(0, 3);
  }, [interviewJob]);

  const mostUsed = [...RESOURCES].sort((a, b) => b.views - a.views).slice(0, 4);
  const recentlyAdded = [...RESOURCES].sort((a, b) => new Date(b.updated) - new Date(a.updated)).slice(0, 5);
  const filtered = search ? RESOURCES.filter((r) => r.title.toLowerCase().includes(search.toLowerCase())) : null;

  const totalSections = RESOURCES.reduce((sum, r) => sum + r.sections.length, 0);
  const completedSections = Object.values(resourceProgress).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="resources-layout">
      <aside className="resources-nav">
        <div className="resources-nav__group">
          <div className="resources-nav__title">Categories</div>
          <div className="resources-nav__item">
            <span>All resources</span>
            <span>{RESOURCES.length}</span>
          </div>
          {CATEGORIES.map((c) => (
            <div className="resources-nav__item" key={c}>
              <span>{c}</span>
              <span>{RESOURCES.filter((r) => r.category === c).length}</span>
            </div>
          ))}
        </div>

        <div className="resources-nav__group">
          <div className="resources-nav__title">Skills & certifications</div>
          <div className="resources-nav__item">
            <span>Free certifications</span>
            <span>{CERTIFICATIONS.length}</span>
          </div>
          {SKILL_CATEGORIES.map((c) => (
            <div className="resources-nav__item" key={c}>
              <span>{c}</span>
              <span>{CERTIFICATIONS.filter((cert) => cert.skillCategory === c).length}</span>
            </div>
          ))}
        </div>

        <div className="rail-card">
          <div className="rail-card__title">Your progress</div>
          <div>
            {completedSections} of {totalSections} sections
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${(completedSections / totalSections) * 100}%` }} />
          </div>
          <p className="meta" style={{ margin: 0 }}>
            {trackProgress["case-interview-track"] || 0} of {LEARNING_TRACKS[0].steps.length} · Case Interview Track
          </p>
        </div>
      </aside>

      <div className="resources-main">
        <div className="resources-header">
          <div>
            <h1>Career Resources</h1>
            <p className="meta">The education hub — recruiting prep, skills, and free certifications.</p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <input type="text" placeholder="Search Resources" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="chip chip-accent">My Saved ({savedResourceIds.length})</span>
            <button className="btn btn-primary" onClick={() => setShowContributeModal(true)}>+ Contribute</button>
          </div>
        </div>

        {filtered ? (
          <div className="resource-card-grid">
            {filtered.length === 0 && <p className="meta">No resources match "{search}".</p>}
            {filtered.map((r) => (
              <ResourceTile key={r.id} resource={r} saved={savedResourceIds.includes(r.id)} />
            ))}
          </div>
        ) : (
          <>
            <div className="rail-card is-accent">
              <div className="rail-card__title">
                {interviewJob ? `Recommended for your ${interviewJob.job.company} first round` : "Recommended for you"}
              </div>
              <p className="meta" style={{ marginBottom: "var(--space-3)" }}>Based on your tracker</p>
              <div className="resource-tile-grid">
                {recommended.map((r) => (
                  <Link to={`/resources/${r.id}`} className="resource-tile" key={r.id} style={{ color: "inherit", textDecoration: "none" }}>
                    <div className="resource-tile__title">{r.title}</div>
                    <div className="meta">{r.format} · {r.pages} pages</div>
                  </Link>
                ))}
              </div>
            </div>

            <CasePartnerFinder />

            <h2>Learning tracks — structured, start to finish</h2>
            <div className="track-card-grid">
              {LEARNING_TRACKS.map((t) => {
                const completed = trackProgress[t.id] || 0;
                const pct = (completed / t.steps.length) * 100;
                return (
                  <Link to={`/resources/tracks/${t.id}`} className="track-card" key={t.id} style={{ color: "inherit", textDecoration: "none" }}>
                    <span className="chip">{t.category}</span>
                    <div className="track-card__title">{t.title}</div>
                    <div className="track-card__summary">{t.summary}</div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="track-card__status">
                      {completed > 0 ? `${completed} of ${t.steps.length} · continue` : "Not started"}
                    </div>
                  </Link>
                );
              })}
            </div>

            <h2>Free certifications — vetted by the Careers Committee</h2>
            <p className="meta">{CERTIFICATIONS.length} free · browse all</p>
            <div className="cert-table__scroll">
              <table className="cert-table">
                <thead>
                  <tr>
                    <th>Certification</th>
                    <th>Provider</th>
                    <th>Cost</th>
                    <th>Time</th>
                    <th>Counts for</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {CERTIFICATIONS.map((c) => (
                    <tr key={c.id}>
                      <td>{c.title}</td>
                      <td>{c.provider}</td>
                      <td>
                        <span className="chip chip-accent">{c.cost}</span>
                      </td>
                      <td>{c.hours} hrs</td>
                      <td>{c.countsFor.join(", ")}</td>
                      <td>
                        <button className="btn btn-secondary">Start</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2>Most used in UC</h2>
            <div className="resource-card-grid">
              {mostUsed.map((r) => (
                <ResourceTile key={r.id} resource={r} saved={savedResourceIds.includes(r.id)} expanded />
              ))}
            </div>

            <h2>Recently added</h2>
            {recentlyAdded.map((r) => (
              <div className="recent-row" key={r.id}>
                <span className="chip">{r.category}</span>
                <Link to={`/resources/${r.id}`} style={{ flex: 1, color: "inherit" }}>
                  {r.title}
                </Link>
                <span className="meta">
                  {r.author} · {daysAgo(r.updated)}d ago
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {showContributeModal && <ContributeModal onClose={() => setShowContributeModal(false)} />}
    </div>
  );
}

function ResourceTile({ resource, saved, expanded }) {
  return (
    <Link to={`/resources/${resource.id}`} className="resource-card" style={{ color: "inherit", textDecoration: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="chip">{resource.category}</span>
        {saved && <span className="chip chip-accent">Saved</span>}
      </div>
      <div className="resource-card__title">{resource.title}</div>
      <div className="resource-card__meta">
        {resource.format} · {resource.pages} pages · updated {resource.updated}
      </div>
      {expanded && <p style={{ margin: 0 }}>{resource.description}</p>}
      <div className="resource-card__author">
        {resource.author} · {resource.views} views · {resource.completions} completed
      </div>
    </Link>
  );
}
