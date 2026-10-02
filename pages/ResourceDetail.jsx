import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLibrary } from "../data/useLibrary.js";
import LogPrepModal from "../components/modals/LogPrepModal.jsx";
import { JOBS as MOCK_JOBS } from "../data/mockJobs.js";
import { useAppState } from "../data/store.jsx";
import { useRealJobs } from "../data/useRealJobs.js";
import { currentUser } from "../data/mockUser.js";
import { resolvedClassYear, resolvedGradMonth } from "../data/profileUtils.js";
import { fetchGuideFileFor, uploadGuideFile } from "../data/resourceGuideSync.js";
import Placeholder from "./Placeholder.jsx";
import "../styles/jobDetail.css";
import "../styles/resources.css";

export default function ResourceDetail() {
  const { resourceId } = useParams();
  const { resources: RESOURCES, loading: libraryLoading } = useLibrary();
  const resource = RESOURCES.find((r) => r.id === resourceId);
  const { savedResourceIds, toggleSavedResource, resourceProgress, toggleResourceSection, trackedJobs, preferences, profileOverrides, isAdmin } =
    useAppState();
  const [showLogPrepModal, setShowLogPrepModal] = useState(false);
  const [guideFile, setGuideFile] = useState(undefined); // undefined = loading, null = none
  const [uploadingGuide, setUploadingGuide] = useState(false);

  useEffect(() => {
    if (!resource) return;
    let cancelled = false;
    fetchGuideFileFor(resource.id).then((result) => {
      if (!cancelled) setGuideFile(result);
    });
    return () => {
      cancelled = true;
    };
  }, [resource?.id]);

  async function handleGuideUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !resource) return;
    setUploadingGuide(true);
    try {
      await uploadGuideFile(resource.id, file);
      setGuideFile(await fetchGuideFileFor(resource.id));
    } finally {
      setUploadingGuide(false);
      e.target.value = "";
    }
  }

  // Hook called unconditionally, before the "resource not found" early
  // return, per Rules of Hooks -- same real-first/mock-fallback pattern
  // as CareerResources.jsx so "Used for" can match a real tracked job too.
  const classYear = resolvedClassYear(currentUser, profileOverrides);
  const gradMonth = resolvedGradMonth(currentUser, profileOverrides);
  const { realJobs } = useRealJobs(preferences, classYear, gradMonth);

  if (!resource) {
    return <Placeholder title={libraryLoading ? "Loading…" : "Resource not found"} />;
  }

  // A resource with no checklist entries still gets one implicit item, so
  // "Mark as completed" and the progress bar work the same way for every
  // resource.
  const sections = resource.sections.length ? resource.sections : ["Read this resource"];

  const isSaved = savedResourceIds.includes(resource.id);
  const done = resourceProgress[resource.id] || [];
  const pctComplete = Math.round((done.length / sections.length) * 100);

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
    sections.forEach((_, i) => {
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
              <span className="chip">{resource.format}</span>
              <span className="chip">Updated {resource.updated}</span>
            </div>
            <h1>{resource.title}</h1>
            <p>{resource.description}</p>
            {resource.author && (
              <div className="maintainer-row">
                <span>Added by {resource.author}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
              {guideFile && (
                <>
                  <a href={guideFile.url} target="_blank" rel="noreferrer" className="btn btn-primary">
                    Open guide
                  </a>
                  <a href={guideFile.url} download={guideFile.fileName} className="btn btn-secondary">
                    Download
                  </a>
                </>
              )}
              {resource.linkUrl && (
                <a href={resource.linkUrl} target="_blank" rel="noreferrer" className={guideFile ? "btn btn-secondary" : "btn btn-primary"}>
                  Open link ↗
                </a>
              )}
              <button className="btn btn-secondary" onClick={() => toggleSavedResource(resource.id)}>
                {isSaved ? "Saved ★" : "Save ★"}
              </button>
              <button className="btn btn-secondary" onClick={markCompleted}>
                {pctComplete === 100 ? "Completed ✓" : "Mark as completed"}
              </button>
            </div>
            {guideFile === null && !resource.linkUrl && !isAdmin && (
              <p className="meta" style={{ marginBottom: 0 }}>No file has been attached to this resource yet.</p>
            )}
            {isAdmin && (
              <div style={{ marginTop: "var(--space-3)" }}>
                <label className="btn-link" style={{ cursor: "pointer" }}>
                  {uploadingGuide
                    ? "Uploading…"
                    : guideFile?.isSpecific
                      ? `Admin: replace guide file (currently "${guideFile.fileName}")`
                      : "Admin: upload a guide file for this resource"}
                  <input type="file" accept=".pdf,.ppt,.pptx,.xls,.xlsx" onChange={handleGuideUpload} disabled={uploadingGuide} style={{ display: "none" }} />
                </label>
              </div>
            )}
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Contents</h2>
            {sections.map((s, i) => (
              <button
                type="button"
                className="checklist-section-row"
                key={s}
                aria-pressed={done.includes(i)}
                onClick={() => toggleResourceSection(resource.id, i)}
              >
                <span>{done.includes(i) ? "✓" : "○"}</span>
                <span style={{ flex: 1 }}>{s}</span>
              </button>
            ))}
          </div>

          {resource.notes && (
            <div className="detail-section" style={{ borderLeft: "var(--border-accent-emphasis)", background: "var(--color-accent-tint)" }}>
              <h2 className="detail-section__title">UC-specific notes</h2>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{resource.notes}</p>
            </div>
          )}
        </div>

        <div className="detail-rail">
          <div className="rail-card">
            <div className="rail-card__title">Your progress</div>
            <div>
              {done.length} of {sections.length} sections · {pctComplete}%
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${pctComplete}%` }} />
            </div>
            <button className="btn btn-secondary" onClick={() => setShowLogPrepModal(true)}>
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

        </div>
      </div>
      {showLogPrepModal && <LogPrepModal onClose={() => setShowLogPrepModal(false)} />}
    </div>
  );
}
