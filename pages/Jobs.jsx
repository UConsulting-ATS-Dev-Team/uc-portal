import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import JobCard from "../components/JobCard.jsx";
import ErrorState from "../components/ErrorState.jsx";
import PostOpportunityModal from "../components/modals/PostOpportunityModal.jsx";
import { INDUSTRIES, LOCATIONS } from "../data/careerOptions.js";
import { daysUntil, matchesDeadlineBucket, CAP_PER_COMPANY } from "../data/jobUtils.js";
import { useAppState } from "../data/store.jsx";
import { fetchAllRows } from "../data/fetchAllRows.js";
import { matchJob, finalScore } from "../data/jobMatch.js";
import { realJobToCardShape } from "../data/realJobAdapter.js";
import { currentUser } from "../data/mockUser.js";
import { resolvedClassYear } from "../data/profileUtils.js";
import { parseJobQuery } from "../data/nlSearchParser.js";
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
// "Scroll feed" (formerly "Continuous feed") removed per direct ask --
// it read as doing the same thing as "All jobs" from a member's
// perspective. It technically loaded differently under the hood (real
// infinite-scroll pagination via components/ContinuousJobFeed.jsx's
// .range() calls, vs. this page's own fetchAllRows() front-loading
// everything for full client-side filtering), but that distinction
// wasn't visible or valuable enough to justify a fourth tab once the
// pagination-explosion problem it was partly working around got a real
// fix (windowed pageWindow() below). ContinuousJobFeed.jsx itself is
// deleted, not just unused -- its one real reusable idea (lighter-weight
// incremental load instead of front-loading the whole table) is still
// available in git history if a future feature wants it back.
const TABS = [
  { key: "recommended", label: "Recommended for you" },
  { key: "all", label: "All jobs" },
  { key: "saved", label: "Saved" },
];
const PAGE_SIZE = 5;

// One company having a public ATS API shouldn't mean it fills the board:
// Databricks alone has 800+ real postings, most other target companies have
// none at all (see JOB_ENGINE_ARCHITECTURE.md's Stage 4 relevance-filter
// entry). Capping how many of one company's cards can appear at once keeps
// the board diverse across companies instead of exhaustive within one --
// the rest are one click away via "View N more at Company", not hidden.
// (CAP_PER_COMPANY itself lives in data/jobUtils.js -- also read by the
// now-unused components/ContinuousJobFeed.jsx, so if that ever comes
// back both still enforce the same number.)

// Applied to the already-sorted list, so which 3 "win" respects whatever
// sort is active (bestMatch keeps each company's top 3 matches, etc.).
// Global across the whole result set, not per-page -- otherwise a company
// could still dominate by spilling its 4th+ card onto page 2 instead of
// being deferred to the explicit "view more" link.
function capPerCompany(jobs, cap) {
  const countByCompany = {};
  const kept = [];
  const overflowByCompany = {};
  for (const job of jobs) {
    countByCompany[job.company] = (countByCompany[job.company] || 0) + 1;
    if (countByCompany[job.company] <= cap) kept.push(job);
    else overflowByCompany[job.company] = (overflowByCompany[job.company] || 0) + 1;
  }
  const lastKeptIdByCompany = {};
  kept.forEach((j) => {
    lastKeptIdByCompany[j.company] = j.id;
  });
  return { kept, overflowByCompany, lastKeptIdByCompany };
}

// A blank slate for natural-language search (and "Clear all") to build
// on -- a described search, or an explicit reset, should start from
// nothing and apply only what was actually asked for.
const NEUTRAL_FILTERS = {
  keyword: "",
  types: [],
  gradYears: [],
  industries: [],
  locations: [],
  compMin: 15,
  compMax: 75,
  deadlines: [],
};

// The Jobs board's actual first-load default. Used to hardcode a generic
// seeded demo state (gradYears: ["2027"], industries: ["Management
// consulting"], locations: ["Chicago", "New York"]) regardless of who was
// signed in -- a member's first look at Jobs showed filters that had
// nothing to do with their own onboarding answers. Now built from the
// member's real preferences instead: their own class year, their own
// ranked industries/locations, their own opportunity type, and their own
// stated comp target as the floor (never a ceiling -- nothing here
// should hide a role that pays *more* than what they asked for).
// Deliberately still filters, not an empty NEUTRAL_FILTERS-style slate:
// showing exactly what the member said they care about, out of the box,
// is the whole point of having collected preferences during onboarding
// in the first place -- "Clear all" (NEUTRAL_FILTERS above) is right
// there for anyone who wants to start from nothing instead.
function defaultFiltersFromPreferences(preferences, classYear) {
  return {
    ...NEUTRAL_FILTERS,
    gradYears: classYear ? [String(classYear)] : [],
    industries: preferences.industries ?? [],
    locations: preferences.locations ?? [],
    types: preferences.opportunityType === "Both" || !preferences.opportunityType ? [] : [preferences.opportunityType],
    compMin: preferences.compTarget ?? NEUTRAL_FILTERS.compMin,
  };
}

// Location (a physical place, matched against job.location) and work mode
// (matched against job.workMode) used to render as one combined chip group
// under a single "Location & work mode" heading, both writing into the
// same filters.locations array -- confusing to scan since they're
// filtering two different job fields. Still one shared filters.locations
// array under the hood (matchesFilters below already ORs across
// location-or-workMode, unchanged), just rendered as two separate groups
// now so it's clear which kind of thing each chip is.
const WORK_MODE_CHIPS = ["Remote", "Hybrid", "In-person"];
const LOCATION_CHIPS = [...new Set([...LOCATIONS, "Los Angeles", "San Francisco"])].filter(
  (loc) => !WORK_MODE_CHIPS.includes(loc)
);
const INDUSTRY_OPTIONS = INDUSTRIES.filter((i) => i.name !== "Still figuring it out");

function matchesFilters(job, filters) {
  if (filters.keyword) {
    const q = filters.keyword.toLowerCase();
    if (!job.role.toLowerCase().includes(q) && !job.company.toLowerCase().includes(q)) return false;
  }
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
  { key: "comp", label: (f) => `$${f.compMax}/hr+`, clear: (f) => ({ ...f, compMin: 15, compMax: 75 }) },
];

function diagnoseEmptyFilters(filters, jobs) {
  return DROPPABLE_FILTERS.filter((d) => (d.key === "comp" ? filters.compMin > 15 || filters.compMax < 75 : filters[d.key].length > 0))
    .map((d) => ({ ...d, count: jobs.filter((j) => matchesFilters(j, d.clear(filters))).length, currentLabel: d.label(filters) }))
    .sort((a, b) => b.count - a.count);
}

function matchesTab(job, tab, savedJobIds) {
  if (tab === "recommended") return job.matchScore >= 70;
  if (tab === "saved") return savedJobIds.includes(job.id);
  return true;
}

function sortJobs(jobs, sortBy, preferences, keyword) {
  const copy = [...jobs];
  if (sortBy === "bestMatch") {
    // US-40/41/42/43's real weighted formula (data/jobMatch.js's
    // finalScore) -- blends in freshness/deadline urgency/quality/UC
    // relevance on top of the pure preference-fit percentage, so "Best
    // match" isn't just re-sorting by matchScore alone. matchScore itself
    // (the displayed "94% match" badge) is untouched by this.
    copy.sort((a, b) => finalScore(b, preferences, keyword) - finalScore(a, preferences, keyword));
  } else if (sortBy === "deadline")
    copy.sort((a, b) => (daysUntil(a.deadlineDate) ?? Infinity) - (daysUntil(b.deadlineDate) ?? Infinity));
  else if (sortBy === "newest") copy.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
  return copy;
}

function toggleInArray(array, value) {
  return array.includes(value) ? array.filter((v) => v !== value) : [...array, value];
}

// Windowed pagination -- totalPages can run into the hundreds against the
// real jobs table (thousands of rows / PAGE_SIZE), so listing every page
// number (the old behavior) meant hundreds of buttons spilling across the
// whole screen. Always keeps the first and last page, the current page
// and its immediate neighbors, and collapses any gap into a single
// non-interactive "…".
function pageWindow(current, total) {
  const kept = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...kept].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const withGaps = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) withGaps.push("…");
    withGaps.push(sorted[i]);
  }
  return withGaps;
}

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { savedJobIds, toggleSavedJob, preferences, savedSearches, saveSearch, removeSavedSearch, profileOverrides } = useAppState();
  const classYear = resolvedClassYear(currentUser, profileOverrides);
  // Starts fully neutral (no filters at all) -- was previously seeded
  // from the member's own preferences at mount, but that's a step
  // further than asked and had its own real cost (e.g. it's exactly why
  // a saved job could go missing under the Saved tab: a genuinely-saved
  // job that didn't match the profile-derived default filters vanished
  // from the list even though its own tab count still said 1 -- fixed
  // separately above by having Saved bypass filters entirely regardless
  // of this default, but the underlying complaint was "why does Jobs
  // start filtered by my profile at all"). Profile-based filtering is
  // still one click away via "Match my profile" in the header, which
  // reuses this same defaultFiltersFromPreferences() function on demand
  // instead of applying it automatically.
  const [filters, setFilters] = useState(NEUTRAL_FILTERS);
  const [tab, setTab] = useState("recommended");
  const [sortBy, setSortBy] = useState("bestMatch");
  const [page, setPage] = useState(1);
  const [showMoreIndustries, setShowMoreIndustries] = useState(false);
  const [showMoreLocations, setShowMoreLocations] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [nlQuery, setNlQuery] = useState("");
  const [nlResult, setNlResult] = useState(null);

  const [rawJobs, setRawJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState(null);

  useEffect(() => {
    // fetchAllRows(), not a bare .select() -- a plain select silently
    // truncates at PostgREST's default 1000-row page, which real active-job
    // volume now exceeds (see data/fetchAllRows.js's header comment).
    fetchAllRows("jobs", "*", (q) => q.eq("active", true))
      .then((data) => setRawJobs(data))
      .catch((err) => setJobsError(err.message))
      .finally(() => setJobsLoading(false));
  }, []);

  const JOBS = useMemo(
    () => rawJobs.map((job) => realJobToCardShape(job, matchJob(job, preferences, classYear))),
    [rawJobs, preferences, classYear]
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

  // §3.8's staged plan for natural-language search: parse into the exact
  // same filter object the chip UI produces, then just set that -- every
  // existing active-chip/diagnostic/matching code path below already
  // handles it unchanged, nothing NL-specific to render downstream.
  function handleNlSearch(event) {
    event.preventDefault();
    if (!nlQuery.trim()) return;
    const { patch, matchedLabels, understood } = parseJobQuery(nlQuery);
    setFilters({ ...NEUTRAL_FILTERS, ...patch });
    setTab("all");
    setNlResult({ understood, matchedLabels });
  }

  const typeCounts = useMemo(() => {
    const counts = {};
    JOBS.forEach((j) => {
      counts[j.type] = (counts[j.type] || 0) + 1;
    });
    return counts;
  }, [JOBS]);

  const filteredForCount = useMemo(() => JOBS.filter((j) => matchesFilters(j, filters)), [JOBS, filters]);
  // Was JOBS.filter(...) -- every job app-wide scoring >= 70, ignoring
  // the sidebar filters entirely. That's a different number than what
  // the Recommended tab (matchesTab requires the same >= 70 AND
  // matchesFilters, see `tabbed` below) can actually show, so the tab's
  // "(10)" badge and subtitle could claim a count nothing on the page
  // ever displayed -- reported directly ("says 10... but only show[s]
  // 1"). Now counted off the same post-filter set the tab itself reads
  // from, so this number is always exactly what clicking that tab
  // reveals.
  const matchedCount = useMemo(() => filteredForCount.filter((j) => j.matchScore >= 70).length, [filteredForCount]);

  const tabbed = useMemo(() => {
    // "Saved" is a personal bookmark list, not another search view -- it
    // shouldn't be additionally narrowed by whatever industry/location/
    // comp/grad-year/type filters happen to be active, since those
    // describe a *search*, not "which of my saved jobs to show." Reads
    // straight off JOBS, bypassing filteredForCount entirely, so a saved
    // job stays visible under Saved no matter the current filter state.
    // Reported directly: the tab's own count (savedJobIds.length) said
    // 1, the list showed 0 -- the one saved job simply didn't match
    // whatever filters happened to be active (seeded from the member's
    // own profile by default, but still a "current search," same
    // reasoning as the Recommended-tab count fix above).
    if (tab === "saved") return JOBS.filter((j) => savedJobIds.includes(j.id));
    return filteredForCount.filter((j) => matchesTab(j, tab, savedJobIds));
  }, [filteredForCount, JOBS, tab, savedJobIds]);
  const sorted = useMemo(
    () => sortJobs(tabbed, sortBy, preferences, filters.keyword),
    [tabbed, sortBy, preferences, filters.keyword]
  );
  // Skip capping once a keyword search is active -- "View N more at
  // Company" works by setting the keyword filter to that company's name,
  // and re-capping on top of an already-explicit narrowing would show the
  // same 3 cards every time, making "view more" a dead end. Also skipped
  // on the Saved tab, same reasoning as bypassing filters above -- a
  // member who saved 4 jobs at one company should see all 4 under
  // Saved, not 3 with the rest silently hidden behind "View more."
  const { kept: displayJobs, overflowByCompany, lastKeptIdByCompany } = useMemo(
    () =>
      filters.keyword || tab === "saved"
        ? { kept: sorted, overflowByCompany: {}, lastKeptIdByCompany: {} }
        : capPerCompany(sorted, CAP_PER_COMPANY),
    [sorted, filters.keyword, tab]
  );

  const totalPages = Math.max(1, Math.ceil(displayJobs.length / PAGE_SIZE));
  const pageJobs = displayJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function viewMoreAtCompany(company) {
    setFilters((prev) => ({ ...prev, keyword: company }));
    setTab("all");
    setPage(1);
  }
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
  filters.types.forEach((t) => activeChips.push({ label: t, onRemove: () => toggleChip("types", t) }));
  filters.gradYears.forEach((y) => activeChips.push({ label: `Class of ${y}`, onRemove: () => toggleChip("gradYears", y) }));
  filters.industries.forEach((i) => activeChips.push({ label: i, onRemove: () => toggleChip("industries", i) }));
  filters.locations.forEach((l) => activeChips.push({ label: l, onRemove: () => toggleChip("locations", l) }));
  filters.deadlines.forEach((d) => activeChips.push({ label: d, onRemove: () => toggleChip("deadlines", d) }));

  function handleSaveSearch() {
    saveSearch(filters, activeChips.length > 0 ? activeChips.map((c) => c.label).join(", ") : "All jobs");
  }

  function applySavedSearch(search) {
    setFilters(search.filters);
    setTab("all");
  }

  if (jobsError) {
    return <ErrorState what="jobs" onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="jobs-layout">
      <aside className="filters">
        <div className="filters__header">
          <span>Filters</span>
          <button className="btn-link" onClick={() => setFilters(NEUTRAL_FILTERS)}>
            Clear all
          </button>
        </div>

        {savedSearches.length > 0 && (
          <div className="filters__group">
            <div className="filters__group-title">Saved searches</div>
            {savedSearches.map((s) => (
              <div className="filters__checkbox" key={s.id}>
                <button type="button" className="btn-link" style={{ textAlign: "left" }} onClick={() => applySavedSearch(s)}>
                  {s.label}
                </button>
                <button type="button" className="btn-link" aria-label={`Remove saved search "${s.label}"`} onClick={() => removeSavedSearch(s.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <form className="filters__group nl-search" onSubmit={handleNlSearch}>
          <div className="filters__group-title">Describe what you're looking for</div>
          <div className="nl-search__row">
            <input
              type="text"
              placeholder="e.g. consulting internships in Chicago for juniors"
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" disabled={!nlQuery.trim()}>
              Search
            </button>
          </div>
          {nlResult && (
            <p className="nl-search__feedback">
              {nlResult.understood
                ? `Searched for: ${nlResult.matchedLabels.join(", ")}`
                : "Didn't recognize anything specific in that — searching it as plain keywords instead."}
            </p>
          )}
        </form>

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
          <div className="filters__group-title">Location</div>
          <div className="filters__chip-group">
            {(showMoreLocations ? LOCATION_CHIPS : LOCATION_CHIPS.slice(0, 8)).map((loc) => (
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
          {!showMoreLocations && LOCATION_CHIPS.length > 8 && (
            <button className="btn-link filters__show-more" onClick={() => setShowMoreLocations(true)}>
              Show {LOCATION_CHIPS.length - 8} more
            </button>
          )}
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Work mode</div>
          <div className="filters__chip-group">
            {WORK_MODE_CHIPS.map((mode) => (
              <button
                type="button"
                key={mode}
                className={`filters__chip${filters.locations.includes(mode) ? " is-selected" : ""}`}
                onClick={() => toggleChip("locations", mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Compensation</div>
          <input
            type="range"
            min={15}
            max={75}
            value={filters.compMin}
            onChange={(e) => patchFilters({ compMin: Math.min(Number(e.target.value), filters.compMax) })}
          />
          <input
            type="range"
            min={15}
            max={75}
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
            {/* A real button in the page's own header, not a small text
                link buried in the filter sidebar -- member-reported as
                "in a weird place and isn't super obvious." Visible on
                every tab now too (the filter sidebar it used to live in
                doesn't exist on every tab). */}
            <button
              className="btn btn-secondary"
              onClick={() => {
                setFilters(defaultFiltersFromPreferences(preferences, classYear));
                setTab("all");
              }}
            >
              Match my profile
            </button>
            <button className="btn btn-secondary" onClick={handleSaveSearch}>Save this search</button>
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
                  <button className="btn btn-secondary" onClick={() => setFilters(NEUTRAL_FILTERS)}>
                    Clear all filters
                  </button>
                  <button className="btn btn-secondary">Save as an alert</button>
                </div>
                <p className="meta" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
                  We'll email you when a matching role is posted.
                </p>
              </>
            ) : (
              <button className="btn btn-secondary" onClick={() => setFilters(NEUTRAL_FILTERS)}>
                Clear all filters
              </button>
            )}
          </div>
        )}

        {pageJobs.map((job) => (
          <div key={job.id}>
            <JobCard job={job} saved={savedJobIds.includes(job.id)} onToggleSave={toggleSavedJob} />
            {lastKeptIdByCompany[job.company] === job.id && overflowByCompany[job.company] > 0 && (
              <button
                className="btn-link"
                style={{ display: "block", marginBottom: "var(--space-6)" }}
                onClick={() => viewMoreAtCompany(job.company)}
              >
                View {overflowByCompany[job.company]} more at {job.company} →
              </button>
            )}
          </div>
        ))}

        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
              ‹
            </button>
            {pageWindow(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span className="pagination__gap" key={`gap-${i}`}>
                  …
                </span>
              ) : (
                <button key={p} className={page === p ? "is-active" : ""} onClick={() => setPage(p)}>
                  {p}
                </button>
              )
            )}
            <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
              ›
            </button>
          </div>
        )}
      </div>

      {showPostModal && <PostOpportunityModal onClose={() => setShowPostModal(false)} />}
    </div>
  );
}
