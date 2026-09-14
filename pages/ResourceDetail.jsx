import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RESOURCES, findResource } from "../data/mockResources.js";
import { JOBS as MOCK_JOBS } from "../data/mockJobs.js";
import { useAppState } from "../data/store.jsx";
import { useRealJobs } from "../data/useRealJobs.js";
import { currentUser } from "../data/mockUser.js";
import { resolvedClassYear } from "../data/profileUtils.js";
import Placeholder from "./Placeholder.jsx";
import "../styles/jobDetail.css";
import "../styles/resources.css";

export default function ResourceDetail() {
  const { resourceId } = useParams();
  const resource = findResource(resourceId);
  const { savedResourceIds, toggleSavedResource, resourceProgress, toggleResourceSection, trackedJobs, preferences, profileOverrides } = useAppState();
  const [hoursLogged, setHoursLogged] = useState(0);

  // Hook called unconditionally, before the "resource not found" early
  // return, per Rules of Hooks -- same real-first/mock-fallback pattern
  // as CareerResources.jsx so "Used for" can match a real tracked job too.
  const classYear = resolvedClassYear(currentUser, profileOverrides);
  const { realJobs } = useRealJobs(preferences, classYear);

  if (!resource) {
    return <Placeholder title="Resource not found" />;
  }

  const isSaved = savedResourceIds.includes(resource.id);
  const done = resourceProgress[resource.id] || [];
  const pctComplete = Math.round((done.length / resource.sections.length) * 100);
  const pagesPerSection = Math.max(1, Math.round(resource.pages / resource.sections.length));

  const activeStages = ["Preparing", "Applied", "Assessment", "First round", "Final round"];
  const usedFor = Object.entries(trackedJobs)
    .map(([jobId, info]) => ({ job: realJobs.find((j) => j.id === jobId) || MOCK_JOBS.find((j) => j.id === jobId), stage: info.stage }))
    .filter(
      (e) =>
        e.job &&
        activeStages.includes(e.stage) &&
        (resource.title.includes(e.job.company.split(" ")[0]) ||
          ((resource.category === "Consulting cases" || resource.category === "Behavioral") &&
            e.job.industry === "Management consulting"))
    )
    .slice(0, 3);

  const related = RESOURCES.filter((r) => r.category === resource.category && r.id !== resource.id).slice(0, 3);

  function markCompleted() {
    resource.sections.forEach((_, i) => {
      if (!done.includes(i)) toggleResourceSection(resource.id, i);
    });
  }

  return (
    <div>
      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-section">
            <div className="chip-row">
              <span className="chip">{resource.category}</span>
              {resource.isInternal && <span className="chip chip-accent">Internal</span>}
              <span className="chip">{resource.pages} pages</span>
              <span className="chip">Updated {resource.updated}</span>
            </div>
            <h1>{resource.title}</h1>
            <p>{resource.description}</p>
            <div className="maintainer-row">
              <span>
                Maintained by {resource.author} and {resource.contributors} contributors
              </span>
              <span>·</span>
              <span>
                {resource.views} views · {resource.completions} completed
              </span>
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              {/* No real document exists behind any resource in this
                  prototype (same limitation as Career Resources'
                  certification "Start" buttons) -- these sat right next
                  to two real working buttons (Save/Mark completed) with
                  no visual distinction, so clicking either looked
                  broken rather than "not built yet." */}
              <button className="btn btn-primary" disabled title="Not wired up yet -- no real guide content behind this in a prototype">
                Open guide
              </button>
              <button className="btn btn-secondary" disabled title="Not wired up yet -- no real file behind this in a prototype">
                Download PDF
              </button>
              <button className="btn btn-secondary" onClick={() => toggleSavedResource(resource.id)}>
                {isSaved ? "Saved ★" : "Save ★"}
              </button>
              <button className="btn btn-secondary" onClick={markCompleted}>
                {pctComplete === 100 ? "Completed ✓" : "Mark as completed"}
              </button>
            </div>
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Contents</h2>
            {resource.sections.map((s, i) => (
              <button
                type="button"
                className="checklist-section-row"
                key={s}
                aria-pressed={done.includes(i)}
                onClick={() => toggleResourceSection(resource.id, i)}
              >
                <span>{done.includes(i) ? "✓" : "○"}</span>
                <span style={{ flex: 1 }}>{s}</span>
                <span className="meta">{pagesPerSection} pages</span>
              </button>
            ))}
          </div>

          <div className="detail-section" style={{ borderLeft: "var(--border-accent-emphasis)", background: "var(--color-accent-tint)" }}>
            <h2 className="detail-section__title">UC-specific notes</h2>
            <ul style={{ margin: 0, paddingLeft: "var(--space-6)" }}>
              {resource.ucNotes.map((n) => (
                <li key={n} style={{ marginBottom: "var(--space-2)" }}>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="detail-rail">
          <div className="rail-card">
            <div className="rail-card__title">Your progress</div>
            <div>
              {done.length} of {resource.sections.length} sections · {pctComplete}%
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${pctComplete}%` }} />
            </div>
            <p className="meta">{hoursLogged} hrs logged</p>
            <button className="btn btn-secondary" onClick={() => setHoursLogged((h) => h + 1)}>
              Log prep time
            </button>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Used for</div>
            {usedFor.length === 0 && <p className="meta" style={{ margin: 0 }}>Not tied to a tracked application yet.</p>}
            {usedFor.map((e) => (
              <div className="resource-row" key={e.job.id}>
                <Link to={`/jobs/${e.job.id}`}>{e.job.role}</Link> · {e.job.company}
              </div>
            ))}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Related resources</div>
            {related.map((r) => (
              <div className="resource-row" key={r.id}>
                <Link to={`/resources/${r.id}`}>{r.title}</Link>
              </div>
            ))}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Members who completed this</div>
            <p style={{ margin: 0 }}>{resource.completions} UC members</p>
          </div>
        </div>
      </div>
    </div>
  );
}
