import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import JobCard from "../components/JobCard.jsx";
import ErrorState from "../components/ErrorState.jsx";
import PostOpportunityModal from "../components/modals/PostOpportunityModal.jsx";
import { INDUSTRIES, LOCATIONS } from "../data/careerOptions.js";
import { daysUntil, matchesDeadlineBucket } from "../data/jobUtils.js";
import { useAppState } from "../data/store.jsx";
import { supabase } from "../data/supabaseClient.js";
import { matchJob } from "../data/jobMatch.js";
import { realJobToCardShape } from "../data/realJobAdapter.js";
import { currentUser } from "../data/mockUser.js";
import "../styles/jobs.css";
import "../styles/search.css";
import "../styles/home.css";

// Stage 2: the Jobs board now reads real data (the jobs table) instead of
// data/mockJobs.js -- see JOB_ENGINE_ARCHITECTURE.md's Stage 2 notes for why
// this was deliberately deferred until search/matching/a real detail page
// all existed and were proven first. Every real job is adapted to the exact
// shape JobCard/jobUtils.js already expect (data/realJobAdapter.js), so
// neither of those needed to change. What's genuinely gone, on purpose, not
// by oversight: the "UC advantage" filters tied to fields a real job
// doesn't carry (has UC connections, UC-posted only, referral available,
// company size) -- that data comes from the still-mocked CRM/tracker
// boundary (Part 3.6), and showing a checkbox that can never honestly match
// anything would be worse than not having it.
const GRAD_YEARS = ["2026", "2027", "2028", "2029"];
const DEADLINE_BUCKETS = ["This week", "This month", "Rolling"];
const TABS = [
  { key: "recommended", label: "Recommended for you" },
  { key: "all", label: "All jobs" },
  { key: "saved", label: "Saved" },
];
const PAGE_SIZE = 5;

const DEFAULT_FILTERS = {
  keyword: "",
  recommendedForMe: false,
  types: [],
  gradYears: ["2027"],
  industries: ["Management consulting"],
  locations: ["Chicago", "New York"],
  compMin: 25,
  compMax: 60,
  deadlines: ["This month"],
};

const LOCATION_CHIPS = [...new Set([...LOCATIONS, "Los Angeles", "San Francisco"])];
const INDUSTRY_OPTIONS = INDUSTRIES.filter((i) => i.name !== "Still figuring it out");

function matchesFilters(job, filters) {
  if (filters.keyword) {
    const q = filters.keyword.toLowerCase();
    if (!job.role.toLowerCase().includes(q) && !job.company.toLowerCase().includes(q)) return false;
  }
  if (filters.recommendedForMe && job.matchScore < 70) return false;
  if (filters.types.length && !filters.types.includes(job.type)) return false;
  // A job with no graduation-year requirement listed passes every grad-year
  // filter rather than being excluded -- "unknown" isn't "ineligible."
  if (filters.gradYears.length && job.classYears.length && !job.classYears.some((y) => filters.gradYears.includes(String(y))))
    return false;
  if (filters.industries.length && job.industry && !filters.industries.includes(job.industry)) return false;
  if (filters.locations.length && !filters.locations.includes(job.location) && !filters.locations.includes(job.workMode))
    return false;
  if (job.compHourly && job.compMin != null && (job.compMax < filters.compMin || job.compMin > filters.compMax)) return false;
  if (filters.deadlines.length && !filters.deadlines.some((d) => matchesDeadlineBucket(job, d))) return false;
  return true;
}

// Zero-result diagnostic (wireframe 3e): for each active filter, compute
// how many results dropping *just that one* would unlock.
const DROPPABLE_FILTERS = [
  { key: "keyword", label: (f) => `"${f.keyword}"`, clear: (f) => ({ ...f, keyword: "" }) },
  { key: "locations", label: (f) => f.locations.join(", "), clear: (f) => ({ ...f, locations: [] }) },
  { key: "industries", label: (f) => f.industries.join(", "), clear: (f) => ({ ...f, industries: [] }) },
  { key: "gradYears", label: (f) => `Class of ${f.gradYears.join(", ")}`, clear: (f) => ({ ...f, gradYears: [] }) },
  { key: "types", label: (f) => f.types.join(", "), clear: (f) => ({ ...f, types: [] }) },
  { key: "deadlines", label: (f) => f.deadlines.join(", "), clear: (f) => ({ ...f, deadlines: [] }) },
  { key: "comp", label: (f) => `$${f.compMax}/hr+`, clear: (f) => ({ ...f, compMin: 15, compMax: 60 }) },
];

function diagnoseEmptyFilters(filters, jobs) {
  return DROPPABLE_FILTERS.filter((d) => (d.key === "comp" ? filters.compMin > 15 || filters.compMax < 60 : filters[d.key].length > 0))
    .map((d) => ({ ...d, count: jobs.filter((j) => matchesFilters(j, d.clear(filters))).length, currentLabel: d.label(filters) }))
    .sort((a, b) => b.count - a.count);
}

function matchesTab(job, tab, savedJobIds) {
  if (tab === "recommended") return job.matchScore >= 70;
  if (tab === "saved") return savedJobIds.includes(job.id);
  return true;
}

function sortJobs(jobs, sortBy) {
  const copy = [...jobs];
  if (sortBy === "bestMatch") copy.sort((a, b) => b.matchScore - a.matchScore);
  else if (sortBy === "deadline")
    copy.sort((a, b) => (daysUntil(a.deadlineDate) ?? Infinity) - (daysUntil(b.deadlineDate) ?? Infinity));
  else if (sortBy === "newest") copy.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
  return copy;
}

function toggleInArray(array, value) {
  return array.includes(value) ? array.filter((v) => v !== value) : [...array, value];
}

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [tab, setTab] = useState("recommended");
  const [sortBy, setSortBy] = useState("bestMatch");
  const [page, setPage] = useState(1);
  const [showMoreIndustries, setShowMoreIndustries] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const { savedJobIds, toggleSavedJob, preferences } = useAppState();

  const [rawJobs, setRawJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState(null);

  useEffect(() => {
    supabase
      .from("jobs")
      .select("*")
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) setJobsError(error.message);
        else setRawJobs(data);
        setJobsLoading(false);
      });
  }, []);

  const JOBS = useMemo(
    () => rawJobs.map((job) => realJobToCardShape(job, matchJob(job, preferences, currentUser.classYear))),
    [rawJobs, preferences]
  );

  useEffect(() => {
    setPage(1);
  }, [filters, tab]);

  function patchFilters(patch) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function toggleChip(key, value) {
    patchFilters({ [key]: toggleInArray(filters[key], value) });
  }

  const typeCounts = useMemo(() => {
    const counts = {};
    JOBS.forEach((j) => {
      counts[j.type] = (counts[j.type] || 0) + 1;
    });
    return counts;
  }, [JOBS]);

  const filteredForCount = useMemo(() => JOBS.filter((j) => matchesFilters(j, filters)), [JOBS, filters]);
  const matchedCount = useMemo(() => JOBS.filter((j) => j.matchScore >= 70).length, [JOBS]);

  const tabbed = useMemo(
    () => filteredForCount.filter((j) => matchesTab(j, tab, savedJobIds)),
    [filteredForCount, tab, savedJobIds]
  );
  const sorted = useMemo(() => sortJobs(tabbed, sortBy), [tabbed, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageJobs = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const diagnostics = useMemo(
    () => (sorted.length === 0 ? diagnoseEmptyFilters(filters, JOBS) : []),
    [sorted.length, filters, JOBS]
  );

  // Demo-only trigger for wireframe 3e's error state -- there's no real
  // fetch layer in this prototype to fail naturally. Visit
  // /jobs?simulateError=1 to see it. Placed after every hook call (not
  // before) -- an early return above any hook breaks the Rules of Hooks.
  if (searchParams.get("simulateError")) {
    return <ErrorState what="jobs" onRetry={() => setSearchParams({})} />;
  }

  const activeChips = [];
  if (filters.keyword) activeChips.push({ label: `"${filters.keyword}"`, onRemove: () => patchFilters({ keyword: "" }) });
  if (filters.recommendedForMe)
    activeChips.push({ label: "Recommended for me", onRemove: () => patchFilters({ recommendedForMe: false }) });
  filters.types.forEach((t) => activeChips.push({ label: t, onRemove: () => toggleChip("types", t) }));
  filters.gradYears.forEach((y) => activeChips.push({ label: `Class of ${y}`, onRemove: () => toggleChip("gradYears", y) }));
  filters.industries.forEach((i) => activeChips.push({ label: i, onRemove: () => toggleChip("industries", i) }));
  filters.locations.forEach((l) => activeChips.push({ label: l, onRemove: () => toggleChip("locations", l) }));
  filters.deadlines.forEach((d) => activeChips.push({ label: d, onRemove: () => toggleChip("deadlines", d) }));

  if (jobsError) {
    return <ErrorState what="jobs" onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="jobs-layout">
      <aside className="filters">
        <div className="filters__header">
          <span>Filters</span>
          <button className="btn-link" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear all
          </button>
        </div>

        <div className="filters__group">
          <input
            type="text"
            placeholder="Keyword, role or company"
            value={filters.keyword}
            onChange={(e) => patchFilters({ keyword: e.target.value })}
          />
        </div>

        <div className="filters__group">
          <label className="filters__checkbox">
            <span>
              <input
                type="checkbox"
                checked={filters.recommendedForMe}
                onChange={() => patchFilters({ recommendedForMe: !filters.recommendedForMe })}
              />{" "}
              Recommended for me
            </span>
          </label>
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Opportunity type</div>
          {Object.keys(typeCounts).map((type) => (
            <label className="filters__checkbox" key={type}>
              <span>
                <input
                  type="checkbox"
                  checked={filters.types.includes(type)}
                  onChange={() => toggleChip("types", type)}
                />{" "}
                {type}
              </span>
              <span className="filters__checkbox-count">{typeCounts[type]}</span>
            </label>
          ))}
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Graduation year</div>
          <div className="filters__chip-group">
            {GRAD_YEARS.map((y) => (
              <button
                type="button"
                key={y}
                className={`filters__chip${filters.gradYears.includes(y) ? " is-selected" : ""}`}
                onClick={() => toggleChip("gradYears", y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Industry</div>
          {(showMoreIndustries ? INDUSTRY_OPTIONS : INDUSTRY_OPTIONS.slice(0, 4)).map((ind) => (
            <label className="filters__checkbox" key={ind.name}>
              <span>
                <input
                  type="checkbox"
                  checked={filters.industries.includes(ind.name)}
                  onChange={() => toggleChip("industries", ind.name)}
                />{" "}
                {ind.name}
              </span>
            </label>
          ))}
          {!showMoreIndustries && INDUSTRY_OPTIONS.length > 4 && (
            <button className="btn-link filters__show-more" onClick={() => setShowMoreIndustries(true)}>
              Show {INDUSTRY_OPTIONS.length - 4} more
            </button>
          )}
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Location & work mode</div>
          <div className="filters__chip-group">
            {LOCATION_CHIPS.map((loc) => (
              <button
                type="button"
                key={loc}
                className={`filters__chip${filters.locations.includes(loc) ? " is-selected" : ""}`}
                onClick={() => toggleChip("locations", loc)}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Compensation</div>
          <input
            type="range"
            min={15}
            max={60}
            value={filters.compMin}
            onChange={(e) => patchFilters({ compMin: Math.min(Number(e.target.value), filters.compMax) })}
          />
          <input
            type="range"
            min={15}
            max={60}
            value={filters.compMax}
            onChange={(e) => patchFilters({ compMax: Math.max(Number(e.target.value), filters.compMin) })}
          />
          <div className="filters__range-labels">
            <span>${filters.compMin}/hr</span>
            <span>${filters.compMax}/hr+</span>
          </div>
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Deadline</div>
          <div className="filters__chip-group">
            {DEADLINE_BUCKETS.map((d) => (
              <button
                type="button"
                key={d}
                className={`filters__chip${filters.deadlines.includes(d) ? " is-selected" : ""}`}
                onClick={() => toggleChip("deadlines", d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="jobs-main">
        <div className="jobs-header">
          <div>
            <h1>Jobs</h1>
            <p className="jobs-header__count">
              {jobsLoading ? "Loading…" : `${JOBS.length} opportunities · ${matchedCount} matched to your profile`}
            </p>
          </div>
          <div className="jobs-header__actions">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="bestMatch">Best match</option>
              <option value="deadline">Deadline</option>
              <option value="newest">Newest</option>
            </select>
            <button className="btn btn-secondary">Save this search</button>
            <button className="btn btn-primary" onClick={() => setShowPostModal(true)}>Post a job</button>
          </div>
        </div>

        <div className="jobs-tabs">
          <div className="jobs-tabs__list">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`jobs-tabs__tab${tab === t.key ? " is-active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label} ({t.key === "recommended" ? matchedCount : t.key === "saved" ? savedJobIds.length : JOBS.length})
              </button>
            ))}
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="active-filter-chips" style={{ marginBottom: "var(--space-6)" }}>
            {activeChips.map((chip, i) => (
              <span className="active-filter-chip" key={i}>
                {chip.label}
                <button onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="jobs-banner">
          <strong>UC-POSTED OPPORTUNITY</strong>
          <span>— Alumni-referred roles are posted by UC members and never appear on Handshake.</span>
          <button className="btn-link">Learn more</button>
        </div>

        {jobsLoading && <p className="meta">Loading opportunities…</p>}

        {!jobsLoading && pageJobs.length === 0 && (
          <div className="no-results">
            <p style={{ fontWeight: 700 }}>0 results with these filters</p>
            {diagnostics.length > 0 ? (
              <>
                {diagnostics.slice(0, 2).map((d) => (
                  <p key={d.key} className="meta">
                    Dropping <strong>{d.currentLabel}</strong> would show {d.count} role{d.count === 1 ? "" : "s"}.
                  </p>
                ))}
                <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", marginTop: "var(--space-5)" }}>
                  <button className="btn btn-primary" onClick={() => setFilters(diagnostics[0].clear(filters))}>
                    Drop "{diagnostics[0].currentLabel}"
                  </button>
                  <button className="btn btn-secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    Clear all filters
                  </button>
                  <button className="btn btn-secondary">Save as an alert</button>
                </div>
                <p className="meta" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
                  We'll email you when a matching role is posted.
                </p>
              </>
            ) : (
              <button className="btn btn-secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear all filters
              </button>
            )}
          </div>
        )}

        {pageJobs.map((job) => (
          <JobCard key={job.id} job={job} saved={savedJobIds.includes(job.id)} onToggleSave={toggleSavedJob} />
        ))}

        {totalPages > 1 && (
          <div className="pagination">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i} className={page === i + 1 ? "is-active" : ""} onClick={() => setPage(i + 1)}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {showPostModal && <PostOpportunityModal onClose={() => setShowPostModal(false)} />}
    </div>
  );
}
