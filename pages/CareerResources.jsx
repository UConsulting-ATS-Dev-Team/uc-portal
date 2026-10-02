import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CERTIFICATIONS } from "../data/certifications.js";
import { CATEGORIES, SKILL_CATEGORIES } from "../data/libraryCategories.js";
import { useLibrary } from "../data/useLibrary.js";
import { JOBS as MOCK_JOBS } from "../data/mockJobs.js";
import { useAppState } from "../data/store.jsx";
import { useRealJobs } from "../data/useRealJobs.js";
import { currentUser } from "../data/mockUser.js";
import { resolvedClassYear, resolvedGradMonth } from "../data/profileUtils.js";
import { fetchContributions } from "../data/contributionsSync.js";
import ContributeModal from "../components/modals/ContributeModal.jsx";
import CasePartnerFinder from "../components/CasePartnerFinder.jsx";
import "../styles/jobDetail.css";
import "../styles/resources.css";
import "../styles/network.css";

function daysAgo(dateStr) {
  return Math.max(0, Math.round((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)));
}

export default function CareerResources() {
  const { trackedJobs, savedResourceIds, resourceProgress, trackProgress, preferences, profileOverrides, isAdmin } = useAppState();
  const { resources: RESOURCES, tracks: LEARNING_TRACKS, loading: libraryLoading, error: libraryError } = useLibrary();
  const [search, setSearch] = useState("");
  const [showContributeModal, setShowContributeModal] = useState(false);
  // Same collapsible-nav pattern as Jobs.jsx/Companies.jsx's filter
  // columns -- live-audited at 375px: the categories/skills nav rendered
  // inline above the page's actual content, forcing a scroll past two
  // full lists (13 category rows total) plus the progress card before
  // reaching a single resource.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [contributions, setContributions] = useState([]);
  useEffect(() => {
    fetchContributions().then(setContributions).catch(() => {});
  }, [showContributeModal]); // refetch after the modal closes so a fresh contribution shows up

  // Same real-first/mock-fallback lookup as Home/Applications/Jobs -- a
  // real tracked job's interview-stage retitle used to only ever check
  // the 8 mock demo jobs, so it silently never fired for a real posting.
  const classYear = resolvedClassYear(currentUser, profileOverrides);
  const gradMonth = resolvedGradMonth(currentUser, profileOverrides);
  const { realJobs } = useRealJobs(preferences, classYear, gradMonth);

  const interviewJob = Object.entries(trackedJobs)
    .map(([jobId, info]) => ({
      job: realJobs.find((j) => j.id === jobId) || MOCK_JOBS.find((j) => j.id === jobId),
      stage: info.stage,
    }))
    .find((e) => e.job && ["First round", "Final round"].includes(e.stage));

  const recommended = useMemo(() => {
    const companyGuide = interviewJob ? RESOURCES.find((r) => r.title.includes(interviewJob.job.company.split(" ")[0])) : null;
    const base = RESOURCES.filter((r) => r.category === "Consulting cases" || r.category === "Behavioral");
    const picks = companyGuide ? [companyGuide, ...base.filter((r) => r.id !== companyGuide.id)] : base;
    return picks.slice(0, 3);
  }, [interviewJob, RESOURCES]);

  const recentlyAdded = [...RESOURCES].sort((a, b) => new Date(b.updated) - new Date(a.updated)).slice(0, 5);
  const filtered = search ? RESOURCES.filter((r) => r.title.toLowerCase().includes(search.toLowerCase())) : null;

  // Progress only counts resources that still exist (a deleted resource's
  // old checkmarks shouldn't inflate the total) and uses the same
  // "no sections = one implicit section" rule ResourceDetail applies.
  const sectionCount = (r) => Math.max(1, r.sections.length);
  const totalSections = RESOURCES.reduce((sum, r) => sum + sectionCount(r), 0);
  const completedSections = RESOURCES.reduce((sum, r) => sum + (resourceProgress[r.id]?.length || 0), 0);
  const startedTrack = LEARNING_TRACKS.find((t) => (trackProgress[t.id] || 0) > 0) ?? LEARNING_TRACKS[0];

  return (
    <div className="resources-layout">
      <aside className="resources-nav">
        <div className="resources-nav__header">
          <span>Browse</span>
          {/* Only rendered/visible via CSS at the tablet/phone tier where
              this nav stacks above the main content (same 899px tier
              styles/resources.css already stacks it at) -- see that
              file's is-mobile-collapsed rule. */}
          <button
            type="button"
            className="resources-nav__mobile-toggle"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? "Hide" : "Show"}
          </button>
        </div>
        <div className={mobileNavOpen ? "resources-nav__body" : "resources-nav__body is-mobile-collapsed"}>
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
            <div className="progress-bar-fill" style={{ width: `${totalSections ? (completedSections / totalSections) * 100 : 0}%` }} />
          </div>
          {startedTrack && (
            <p className="meta" style={{ margin: 0 }}>
              {trackProgress[startedTrack.id] || 0} of {startedTrack.steps.length} · {startedTrack.title}
            </p>
          )}
        </div>
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
            {libraryError && (
              <p className="meta" style={{ color: "var(--color-danger)" }}>
                Couldn't load the resource library ({libraryError}).
              </p>
            )}
            {!libraryLoading && !libraryError && RESOURCES.length === 0 && (
              <div className="rail-card">
                <div className="rail-card__title">The library is empty so far</div>
                <p style={{ margin: 0 }}>
                  Guides, templates and slide decks the Exec team adds will show up here.
                  {isAdmin ? " Add the first one from Library in the Leadership menu." : " Have something that helped you? Use + Contribute."}
                </p>
              </div>
            )}
            {recommended.length > 0 && (
            <div className="rail-card is-accent">
              <div className="rail-card__title">
                {interviewJob ? `Recommended for your ${interviewJob.job.company} first round` : "Recommended for you"}
              </div>
              <p className="meta" style={{ marginBottom: "var(--space-3)" }}>Based on your tracker</p>
              <div className="resource-tile-grid">
                {recommended.map((r) => (
                  <Link to={`/resources/${r.id}`} className="resource-tile" key={r.id} style={{ color: "inherit", textDecoration: "none" }}>
                    <div className="resource-tile__title">{r.title}</div>
                    <div className="meta">{r.format}</div>
                  </Link>
                ))}
              </div>
            </div>
            )}

            <CasePartnerFinder />

            {LEARNING_TRACKS.length > 0 && <h2>Learning tracks — structured, start to finish</h2>}
            <div className="track-card-grid">
              {LEARNING_TRACKS.map((t) => {
                const completed = trackProgress[t.id] || 0;
                const pct = t.steps.length ? (completed / t.steps.length) * 100 : 0;
                return (
                  <Link to={`/resources/tracks/${t.id}`} className="track-card" key={t.id} style={{ color: "inherit", textDecoration: "none" }}>
                    <span className="chip">{t.category}</span>
                    <div className="track-card__title">{t.title}</div>
                    <div className="track-card__summary">{t.summary}</div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="track-card__status">
                      {t.steps.length === 0 ? "No steps yet" : completed > 0 ? `${completed} of ${t.steps.length} · continue` : "Not started"}
                    </div>
                  </Link>
                );
              })}
            </div>

            <h2>Free certifications</h2>
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
                      <td>{c.countsFor.length ? c.countsFor.join(", ") : "—"}</td>
                      <td>
                        <a href={c.url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                          Start ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {recentlyAdded.length > 0 && <h2>Recently added</h2>}
            {recentlyAdded.map((r) => (
              <div className="recent-row" key={r.id}>
                <span className="chip">{r.category}</span>
                <Link to={`/resources/${r.id}`} style={{ flex: 1, color: "inherit" }}>
                  {r.title}
                </Link>
                <span className="meta">
                  {r.author ? `${r.author} · ` : ""}{daysAgo(r.updated)}d ago
                </span>
              </div>
            ))}

            {/* Real member-submitted content -- library_contributions,
                written by ContributeModal.jsx for every type except
                Interview write-up (which has its own real display on
                RealJobDetail.jsx already). Hidden entirely while empty,
                same "nothing to apologize for by omission" convention
                this app uses for other thin real data elsewhere. */}
            {contributions.length > 0 && (
              <>
                <h2>Member contributions</h2>
                {contributions.map((c) => (
                  <div className="recent-row" key={c.id}>
                    <span className="chip">{c.type}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{c.title}</div>
                      <div className="meta">{c.body.slice(0, 120)}{c.body.length > 120 ? "…" : ""}</div>
                    </div>
                    <span className="meta">
                      {c.is_anonymous ? "Anonymous" : c.submitted_by_name || "A member"} · {daysAgo(c.created_at)}d ago
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {showContributeModal && <ContributeModal onClose={() => setShowContributeModal(false)} />}
    </div>
  );
}

function ResourceTile({ resource, saved }) {
  return (
    <Link to={`/resources/${resource.id}`} className="resource-card" style={{ color: "inherit", textDecoration: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="chip">{resource.category}</span>
        {saved && <span className="chip chip-accent">Saved</span>}
      </div>
      <div className="resource-card__title">{resource.title}</div>
      <div className="resource-card__meta">
        {resource.format} · updated {resource.updated}
      </div>
      {resource.description && <p style={{ margin: 0 }}>{resource.description}</p>}
      {resource.author && <div className="resource-card__author">{resource.author}</div>}
    </Link>
  );
}
