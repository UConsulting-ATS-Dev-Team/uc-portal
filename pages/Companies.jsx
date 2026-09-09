import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COMPANIES } from "../data/mockCompanies.js";
import { statsFor } from "../data/companyUtils.js";
import { fetchLiveJobsByCompany } from "../data/companyLiveJobs.js";
import { useAppState } from "../data/store.jsx";
import CompanyLogo from "../components/CompanyLogo.jsx";
import "../styles/jobs.css";
import "../styles/companies.css";

const INDUSTRIES = [...new Set(COMPANIES.map((c) => c.industry))];
const RECRUITING_STATUSES = ["Currently hiring", "Opens soon", "Closed for cycle"];
const SIZES = ["1-50", "51-500", "501-5k", "5k+"];
const LOCATIONS = [...new Set(COMPANIES.flatMap((c) => c.offices))];
const CONNECTIONS_OPTIONS = ["Any", "1+", "2+"];

export default function Companies() {
  const { preferences, updatePreferences } = useAppState();
  const [name, setName] = useState("");
  const [industries, setIndustries] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [connectionsMin, setConnectionsMin] = useState("Any");
  const [sortBy, setSortBy] = useState("alumni");
  // Same collapsible-filters fix as Jobs.jsx (both share styles/jobs.css's
  // .filters/.jobs-layout) -- caught live at 375px: this page's filter
  // column inherited the CSS but not the toggle, so it still forced a
  // long scroll past every filter group before reaching a single company.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function toggleWatch(companyName) {
    const already = preferences.followedCompanies.includes(companyName);
    updatePreferences({
      followedCompanies: already
        ? preferences.followedCompanies.filter((c) => c !== companyName)
        : [...preferences.followedCompanies, companyName],
    });
  }

  // Real per-company job counts, not statsFor()'s mock-derived openRoles --
  // several companies here (Bain, McKinsey, Goldman Sachs, BCG, EY-Parthenon,
  // Accenture) have never had a real automated source, so that mock number
  // was a fabricated count of fabricated postings rendered as if it were a
  // real fact on every card in this grid. undefined = still loading (cards
  // show "…" rather than flash a fake number first); a company absent from
  // the map, or present with an empty array, means no live feed -- see
  // data/companyLiveJobs.js's header comment for why those two cases are
  // deliberately treated the same.
  const [liveJobsByCompany, setLiveJobsByCompany] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchLiveJobsByCompany(COMPANIES.map((c) => c.name)).then((byCompany) => {
      if (!cancelled) setLiveJobsByCompany(byCompany);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const withStats = useMemo(() => {
    return COMPANIES.map((c) => {
      const stats = statsFor(c);
      const liveCount = liveJobsByCompany?.get(c.name)?.length;
      return { ...c, stats: { ...stats, openRoles: liveJobsByCompany === undefined ? undefined : liveCount ?? 0 } };
    });
  }, [liveJobsByCompany]);

  const filtered = useMemo(() => {
    const minConn = connectionsMin === "Any" ? 0 : Number(connectionsMin.replace("+", ""));
    return withStats.filter((c) => {
      if (name && !c.name.toLowerCase().includes(name.toLowerCase())) return false;
      if (industries.length && !industries.includes(c.industry)) return false;
      if (statuses.length && !statuses.includes(c.recruitingStatus)) return false;
      if (sizes.length && !sizes.includes(c.size)) return false;
      if (locations.length && !c.offices.some((o) => locations.includes(o))) return false;
      if (c.stats.ucAlumni < minConn) return false;
      return true;
    });
  }, [withStats, name, industries, statuses, sizes, locations, connectionsMin]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortBy === "alumni") copy.sort((a, b) => b.stats.ucAlumni - a.stats.ucAlumni);
    else if (sortBy === "roles") copy.sort((a, b) => (b.stats.openRoles ?? 0) - (a.stats.openRoles ?? 0));
    return copy;
  }, [filtered, sortBy]);

  const withAlumni = withStats.filter((c) => c.stats.ucAlumni > 0).length;
  const hiringNow = withStats.filter((c) => c.recruitingStatus === "Currently hiring").length;

  return (
    <div className="jobs-layout">
      <aside className="filters">
        <div className="filters__header">
          <span>Filters</span>
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
            <button
              className="btn-link"
              onClick={() => {
                setName("");
                setIndustries([]);
                setStatuses([]);
                setSizes([]);
                setLocations([]);
                setConnectionsMin("Any");
              }}
            >
              Clear all
            </button>
            {/* Only rendered/visible via CSS at the phone tier -- see
                styles/jobs.css's is-mobile-collapsed rule (shared with
                Jobs.jsx's identical toggle). */}
            <button
              type="button"
              className="filters__mobile-toggle"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              aria-expanded={mobileFiltersOpen}
            >
              {mobileFiltersOpen ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className={mobileFiltersOpen ? "filters__body" : "filters__body is-mobile-collapsed"}>
        <div className="filters__group">
          <input type="text" placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Industry</div>
          {INDUSTRIES.map((i) => (
            <label className="filters__checkbox" key={i}>
              <span>
                <input type="checkbox" checked={industries.includes(i)} onChange={() => toggle(industries, setIndustries, i)} /> {i}
              </span>
            </label>
          ))}
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Recruiting status</div>
          {RECRUITING_STATUSES.map((s) => (
            <label className="filters__checkbox" key={s}>
              <span>
                <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggle(statuses, setStatuses, s)} /> {s}
              </span>
            </label>
          ))}
        </div>

        <div className="filters__group">
          <div className="filters__group-title">UC connections</div>
          <div className="filters__chip-group">
            {CONNECTIONS_OPTIONS.map((o) => (
              <button
                type="button"
                key={o}
                className={`filters__chip${connectionsMin === o ? " is-selected" : ""}`}
                onClick={() => setConnectionsMin(o)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Company size</div>
          <div className="filters__chip-group">
            {SIZES.map((s) => (
              <button
                type="button"
                key={s}
                className={`filters__chip${sizes.includes(s) ? " is-selected" : ""}`}
                onClick={() => toggle(sizes, setSizes, s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="filters__group">
          <div className="filters__group-title">Location</div>
          <div className="filters__chip-group">
            {LOCATIONS.map((l) => (
              <button
                type="button"
                key={l}
                className={`filters__chip${locations.includes(l) ? " is-selected" : ""}`}
                onClick={() => toggle(locations, setLocations, l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        </div>
      </aside>

      <div className="companies-main">
        <div className="companies-header">
          <div>
            <h1>Companies</h1>
            <p className="jobs-header__count">
              {COMPANIES.length} companies · {withAlumni} with UC alumni · {hiringNow} hiring right now
            </p>
          </div>
          <div className="companies-header__actions">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="alumni">Most UC alumni</option>
              <option value="roles">Most open roles</option>
            </select>
            <span className="chip chip-accent">My watchlist ({preferences.followedCompanies.length})</span>
          </div>
        </div>

        <div className="companies-grid">
          {sorted.map((c) => {
            const isWatched = preferences.followedCompanies.includes(c.name);
            return (
              <div className={`company-card${isWatched ? " is-watched" : ""}`} key={c.id}>
                <div className="company-card__top">
                  <CompanyLogo name={c.name} initials={c.logoInitials} className="company-card__logo" />
                  <div>
                    <Link to={`/companies/${c.id}`} className="company-card__name" style={{ color: "inherit", textDecoration: "none" }}>
                      {c.name}
                    </Link>
                    {isWatched && <span className="chip chip-accent" style={{ marginLeft: "var(--space-3)" }}>Watching</span>}
                  </div>
                </div>
                <p className="company-card__meta">
                  {c.industry} · {c.size} · {c.offices.join(", ")}
                </p>
                <p className="company-card__characterization">{c.characterization}</p>
                <div className="company-card__stats">
                  <div className="company-card__stat">
                    <div className="company-card__stat-number">{c.stats.ucAlumni}</div>
                    <div className="company-card__stat-label">UC alumni</div>
                  </div>
                  <div className="company-card__stat">
                    <div className="company-card__stat-number">
                      {c.stats.openRoles === undefined ? "…" : c.stats.openRoles > 0 ? c.stats.openRoles : "—"}
                    </div>
                    <div className="company-card__stat-label">
                      {c.stats.openRoles === undefined || c.stats.openRoles > 0 ? "Open roles" : "No live feed"}
                    </div>
                  </div>
                  <div className="company-card__stat">
                    <div className="company-card__stat-number">{c.stats.ucApplicants}</div>
                    <div className="company-card__stat-label">UC applicants</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  <Link to={`/companies/${c.id}`} className="btn btn-primary">
                    View company
                  </Link>
                  <button className="btn btn-secondary" onClick={() => toggleWatch(c.name)}>
                    {isWatched ? "Watching" : "Add to watchlist"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
