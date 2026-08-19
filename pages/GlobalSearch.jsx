import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { searchAll } from "../data/searchUtils.js";
import { COMPANIES } from "../data/mockCompanies.js";
import { useAppState } from "../data/store.jsx";
import "../styles/jobs.css";
import "../styles/jobDetail.css";
import "../styles/onboarding.css";
import "../styles/resources.css";
import "../styles/search.css";

const TABS = ["All", "Jobs", "People", "Companies", "Resources", "Feed posts"];

export default function GlobalSearch() {
  const [params] = useSearchParams();
  const query = params.get("q") || "";
  const navigate = useNavigate();
  const [tab, setTab] = useState("All");
  const [onlyActionable, setOnlyActionable] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [onlyRecent, setOnlyRecent] = useState(false);
  const { savedJobIds, savedConnections, savedResourceIds, preferences, recentSearches, addRecentSearch } = useAppState();

  useEffect(() => {
    if (query) addRecentSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const raw = useMemo(() => searchAll(query), [query]);

  const results = useMemo(() => {
    let { jobs, people, companies, resources, posts } = raw;
    if (onlyActionable) {
      resources = [];
      posts = [];
    }
    if (onlySaved) {
      jobs = jobs.filter((j) => savedJobIds.includes(j.id));
      people = people.filter((p) => savedConnections.includes(p.id));
      resources = resources.filter((r) => savedResourceIds.includes(r.id));
      companies = companies.filter((c) => preferences.followedCompanies.includes(c.name));
    }
    if (onlyRecent) {
      jobs = jobs.filter((j) => j.postedDaysAgo <= 30);
      resources = resources.filter((r) => (new Date() - new Date(r.updated)) / 86400000 <= 30);
    }
    return { jobs, people, companies, resources, posts };
  }, [raw, onlyActionable, onlySaved, onlyRecent, savedJobIds, savedConnections, savedResourceIds, preferences]);

  const total = results.jobs.length + results.people.length + results.companies.length + results.resources.length + results.posts.length;

  const filteredForTab = () => {
    if (tab === "Jobs") return { jobs: results.jobs };
    if (tab === "People") return { people: results.people };
    if (tab === "Companies") return { companies: results.companies };
    if (tab === "Resources") return { resources: results.resources };
    if (tab === "Feed posts") return { posts: results.posts };
    return results;
  };
  const shown = filteredForTab();

  function fallbackCompany() {
    return COMPANIES.find((c) => c.name.toLowerCase().startsWith(query[0]?.toLowerCase())) || COMPANIES[0];
  }

  return (
    <div>
      <h1>Results for "{query}"</h1>
      <p className="jobs-header__count">{total} results</p>

      <div className="jobs-tabs" style={{ marginBottom: "var(--space-6)" }}>
        <div className="jobs-tabs__list">
          {TABS.map((t) => {
            const count =
              t === "All" ? total :
              t === "Jobs" ? results.jobs.length :
              t === "People" ? results.people.length :
              t === "Companies" ? results.companies.length :
              t === "Resources" ? results.resources.length :
              results.posts.length;
            return (
              <button key={t} className={`jobs-tabs__tab${tab === t ? " is-active" : ""}`} onClick={() => setTab(t)}>
                {t} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          {total === 0 ? (
            <div className="no-results">
              <p style={{ fontWeight: 700 }}>No results for "{query}"</p>
              <p className="meta">Closest company match: {fallbackCompany().name}</p>
              <p className="meta">Nearest resource category: Consulting cases</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/feed", { state: { prefill: `Does anyone know anything about "${query}"?` } })}
              >
                Ask the network
              </button>
            </div>
          ) : (
            <>
              {shown.companies?.length > 0 && (
                <div className="search-group">
                  <div className="search-group__header">
                    <h2 style={{ margin: 0 }}>Companies</h2>
                    {tab === "All" && results.companies.length > 3 && (
                      <button className="btn-link" onClick={() => setTab("Companies")}>
                        See all {results.companies.length}
                      </button>
                    )}
                  </div>
                  {(tab === "All" ? shown.companies.slice(0, 3) : shown.companies).map((c) => (
                    <div className="search-result-row" key={c.id}>
                      <div>
                        <strong>{c.name}</strong>
                        <div className="search-result-row__meta">{c.industry}</div>
                      </div>
                      <Link to={`/companies/${c.id}`} className="btn btn-secondary">View company</Link>
                    </div>
                  ))}
                </div>
              )}

              {shown.jobs?.length > 0 && (
                <div className="search-group">
                  <div className="search-group__header">
                    <h2 style={{ margin: 0 }}>Jobs</h2>
                    {tab === "All" && results.jobs.length > 3 && (
                      <button className="btn-link" onClick={() => setTab("Jobs")}>
                        See all {results.jobs.length}
                      </button>
                    )}
                  </div>
                  {(tab === "All" ? shown.jobs.slice(0, 3) : shown.jobs).map((j) => (
                    <div className="search-result-row" key={j.id}>
                      <div>
                        <strong>{j.role}</strong>
                        <div className="search-result-row__meta">{j.company}</div>
                      </div>
                      <Link to={`/jobs/${j.id}`} className="btn btn-secondary">View</Link>
                    </div>
                  ))}
                </div>
              )}

              {shown.people?.length > 0 && (
                <div className="search-group">
                  <div className="search-group__header">
                    <h2 style={{ margin: 0 }}>People</h2>
                    {tab === "All" && results.people.length > 3 && (
                      <button className="btn-link" onClick={() => setTab("People")}>
                        See all {results.people.length}
                      </button>
                    )}
                  </div>
                  {(tab === "All" ? shown.people.slice(0, 3) : shown.people).map((p) => (
                    <div className="search-result-row" key={p.id}>
                      <div>
                        <strong>{p.name}</strong>
                        <div className="search-result-row__meta">{p.role}{p.company ? ` · ${p.company}` : ""}</div>
                      </div>
                      <Link to={`/network/${p.id}`} className="btn btn-secondary">
                        {p.status === "Current member" ? "Message" : "Coffee chat"}
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {shown.resources?.length > 0 && (
                <div className="search-group">
                  <div className="search-group__header">
                    <h2 style={{ margin: 0 }}>Resources</h2>
                    {tab === "All" && results.resources.length > 3 && (
                      <button className="btn-link" onClick={() => setTab("Resources")}>
                        See all {results.resources.length}
                      </button>
                    )}
                  </div>
                  {(tab === "All" ? shown.resources.slice(0, 3) : shown.resources).map((r) => (
                    <div className="search-result-row" key={r.id}>
                      <div>
                        <strong>{r.title}</strong>
                        <div className="search-result-row__meta">{r.category}</div>
                      </div>
                      <Link to={`/resources/${r.id}`} className="btn btn-secondary">View</Link>
                    </div>
                  ))}
                </div>
              )}

              {shown.posts?.length > 0 && (
                <div className="search-group">
                  <div className="search-group__header">
                    <h2 style={{ margin: 0 }}>Feed posts</h2>
                    {tab === "All" && results.posts.length > 3 && (
                      <button className="btn-link" onClick={() => setTab("Feed posts")}>
                        See all {results.posts.length}
                      </button>
                    )}
                  </div>
                  {(tab === "All" ? shown.posts.slice(0, 3) : shown.posts).map((p) => (
                    <div className="search-result-row" key={p.id}>
                      <div>
                        <strong>{p.author}</strong>
                        <div className="search-result-row__meta">{p.body.slice(0, 80)}…</div>
                      </div>
                      <Link to="/feed" className="btn btn-secondary">View</Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="detail-rail">
          <div className="rail-card">
            <div className="rail-card__title">Refine</div>
            <div className="checkbox-row">
              <input type="checkbox" id="actionable" checked={onlyActionable} onChange={() => setOnlyActionable((v) => !v)} />
              <label htmlFor="actionable">Only things I can act on</label>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="onlySaved" checked={onlySaved} onChange={() => setOnlySaved((v) => !v)} />
              <label htmlFor="onlySaved">My saved items</label>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="onlyRecent" checked={onlyRecent} onChange={() => setOnlyRecent((v) => !v)} />
              <label htmlFor="onlyRecent">Added in last 30 days</label>
            </div>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Recent searches</div>
            {recentSearches.length === 0 && <p className="meta" style={{ margin: 0 }}>No recent searches.</p>}
            {recentSearches.map((q) => (
              <div key={q} className="resource-row">
                <Link to={`/search?q=${encodeURIComponent(q)}`}>{q}</Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
