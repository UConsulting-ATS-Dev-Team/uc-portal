import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchRealPeople } from "../data/realPeople.js";
import { useAppState } from "../data/store.jsx";
import { fetchMemberAvatars } from "../data/avatarSync.js";
import RequestCoffeeChatModal from "../components/modals/RequestCoffeeChatModal.jsx";
import DemoDataBadge from "../components/DemoDataBadge.jsx";
import Avatar from "../components/Avatar.jsx";
import "../styles/jobDetail.css";
import "../styles/network.css";
import "../styles/home.css";

const AUDIENCES = ["All", "Alumni", "Current members"];

function uniqueValues(people, key) {
  return [...new Set(people.map((p) => p[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// Default is alphabetical by name; grad year sorts put people with no
// known class year last either way, then fall back to name so ties (and
// the unknowns) stay in a stable alphabetical order.
const SORTS = [
  { value: "name", label: "Sort: Name (A–Z)" },
  { value: "gradNewest", label: "Sort: Grad year (newest)" },
  { value: "gradOldest", label: "Sort: Grad year (oldest)" },
];

function compareByName(a, b) {
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}

function sortPeople(people, sort) {
  const sorted = [...people];
  if (sort === "name") return sorted.sort(compareByName);
  const dir = sort === "gradNewest" ? -1 : 1;
  return sorted.sort((a, b) => {
    const ay = Number(a.classYear) || null;
    const by = Number(b.classYear) || null;
    if (ay == null && by == null) return compareByName(a, b);
    if (ay == null) return 1;
    if (by == null) return -1;
    return ay !== by ? (ay - by) * dir : compareByName(a, b);
  });
}

// Real network/coffee-chat export -- direct ask, same client-side Blob
// download pattern Applications.jsx's tracker CSV export already
// established (no backend needed for a CSV, same as that one). Unions
// savedConnections and coffeeChatStatus into one row per person rather
// than two separate exports, since "who's in my network" and "who I've
// coffee-chatted with" overlap heavily and a member asking for "my
// network export" almost certainly wants both in one file.
function networkToCsv(personIds, savedConnections, coffeeChatStatus, findPerson) {
  const header = ["Name", "Company", "Role", "Saved to network", "Coffee chat status"];
  const rows = [...personIds]
    .map((id) => {
      const person = findPerson(id);
      if (!person) return null;
      return [
        person.name,
        person.company ?? "",
        person.role ?? "",
        savedConnections.includes(id) ? "Yes" : "No",
        coffeeChatStatus[id] ?? "",
      ];
    })
    .filter(Boolean);
  return [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Network() {
  const { preferences, savedConnections, coffeeChatStatus, toggleSavedConnection } = useAppState();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("All");
  // Reads a ?company= param so "See all N UC members" links (Job detail,
  // Company page) land here pre-filtered instead of on a dead button --
  // those had no onClick at all before this. Only seeded from the URL on
  // mount, same as every other filter here (this page doesn't reflect
  // filters back into the URL as they change, so this stays a one-way
  // "arrived here about X" entry point, not full deep-linking).
  const [company, setCompany] = useState(() => searchParams.get("company") || "All");
  const [location, setLocation] = useState("All");
  const [gradYear, setGradYear] = useState("All");
  const [audience, setAudience] = useState("All");
  const [sort, setSort] = useState("name");
  const [browseAnyway, setBrowseAnyway] = useState(false);
  const [chatModalPerson, setChatModalPerson] = useState(null);

  // Real UConsulting Directory data (current members + alumni) -- see
  // JOB_ENGINE_ARCHITECTURE.md's Stage 5 entry.
  const [PEOPLE, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [avatarsByEmail, setAvatarsByEmail] = useState(new Map());

  useEffect(() => {
    fetchRealPeople()
      .then(setPeople)
      .finally(() => setPeopleLoading(false));
    fetchMemberAvatars().then(({ byEmail }) => setAvatarsByEmail(byEmail));
  }, []);

  function findPerson(id) {
    return PEOPLE.find((p) => p.id === id);
  }

  const alumniCount = PEOPLE.filter((p) => p.status !== "Current member").length;
  const memberCount = PEOPLE.filter((p) => p.status === "Current member").length;
  const pendingRequests = Object.values(coffeeChatStatus).filter((s) => s === "Request sent").length;

  const filtered = useMemo(() => {
    const matches = PEOPLE.filter((p) => {
      if (audience === "Alumni" && p.status === "Current member") return false;
      if (audience === "Current members" && p.status !== "Current member") return false;
      if (industry !== "All" && p.industry !== industry) return false;
      if (company !== "All" && p.company !== company) return false;
      if (location !== "All" && p.location !== location) return false;
      if (gradYear !== "All" && String(p.classYear) !== gradYear) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.company || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
    return sortPeople(matches, sort);
  }, [PEOPLE, search, industry, company, location, gradYear, audience, sort]);

  const suggested = useMemo(() => {
    return PEOPLE.filter((p) => !savedConnections.includes(p.id))
      .map((p) => {
        let reason = "Similar career interests";
        if (preferences.followedCompanies.includes(p.company)) reason = "Alumni at companies you track";
        else if (preferences.industries.includes(p.industry)) reason = "In your target industry";
        return { ...p, reason };
      })
      .slice(0, 3);
  }, [PEOPLE, savedConnections, preferences]);

  const companyCounts = useMemo(() => {
    const counts = {};
    PEOPLE.forEach((p) => {
      if (p.company) counts[p.company] = (counts[p.company] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [PEOPLE]);

  if (peopleLoading) {
    return <p className="meta">Loading the UC network…</p>;
  }

  return (
    <div>
      <div className="network-header">
        <div>
          <h1>Network</h1>
          <p className="network-header__stat">
            {alumniCount} alumni · {memberCount} current members
          </p>
        </div>
        <div className="network-header__counts">
          <span className="chip">My connections ({savedConnections.length})</span>
          <span className="chip chip-accent">Chat requests ({pendingRequests})</span>
        </div>
      </div>

      <div className="network-filters">
        <input type="text" placeholder="Search name or company" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="All">Industry</option>
          {uniqueValues(PEOPLE, "industry").map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="All">Company</option>
          {uniqueValues(PEOPLE, "company").map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="All">Location</option>
          {uniqueValues(PEOPLE, "location").map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <select aria-label="Grad year" value={gradYear} onChange={(e) => setGradYear(e.target.value)}>
          <option value="All">Grad year</option>
          {[...new Set(PEOPLE.map((p) => p.classYear).filter(Boolean))].sort().map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select aria-label="Sort order" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="network-audience-toggle">
          {AUDIENCES.map((a) => (
            <button key={a} className={audience === a ? "is-active" : ""} onClick={() => setAudience(a)}>
              {a}
            </button>
          ))}
        </div>
        <span className="meta">{filtered.length} results</span>
      </div>

      <div className="network-layout">
        <div className="network-main">
          {savedConnections.length === 0 && !browseAnyway ? (
            <div className="empty-state">
              <h1 style={{ fontSize: "var(--text-title-min)" }}>You haven't met anyone here yet</h1>
              <p>
                {alumniCount} UC alumni are in the directory. The Networking track walks you through sending your
                first message if that feels intimidating.
              </p>
              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", marginTop: "var(--space-5)" }}>
                <button className="btn btn-primary" onClick={() => setBrowseAnyway(true)}>
                  Browse alumni open to chats
                </button>
                <Link to="/resources" className="btn btn-secondary">
                  Start the Networking track
                </Link>
              </div>
            </div>
          ) : (
          <div className="network-grid">
            {filtered.map((p) => {
              const isMember = p.status === "Current member";
              const chatStatus = coffeeChatStatus[p.id];
              // Only render lines that have real content -- real people
              // often lack role/company/location/industry, which used to
              // leave an empty row or a stray " · " dot on the card.
              const statusLine = isMember ? "Current member" : [p.status, p.classYear ? `Class of ${p.classYear}` : null].filter(Boolean).join(" · ");
              const roleLine = [p.role, p.company].filter(Boolean).join(" · ");
              const metaLine = [p.location, p.industry].filter(Boolean).join(" · ");
              return (
                <div className="person-card" key={p.id}>
                  <div className="person-card__avatar">
                    <Avatar name={p.name} url={(p.email && avatarsByEmail.get(p.email.toLowerCase())) || p.avatarUrl} />
                  </div>
                  <div className="person-card__name">{p.name}</div>
                  {statusLine && <div className="person-card__status">{statusLine}</div>}
                  {roleLine && <div className="person-card__role">{roleLine}</div>}
                  {metaLine && <div className="person-card__meta">{metaLine}</div>}
                  <div className="person-card__actions">
                    {isMember ? (
                      // Messages.jsx's own ?personId= handling now resolves
                      // this for real (a real account -> opens a real
                      // thread; no account yet -> an honest "hasn't joined
                      // UC Portal yet" state) -- no need to pre-check for an
                      // existing conversation here anymore.
                      <Link to={`/messages?personId=${p.id}`} className="btn btn-primary">Message</Link>
                    ) : (
                      <button
                        className="btn btn-primary"
                        disabled={!!chatStatus}
                        onClick={() => setChatModalPerson(p)}
                      >
                        {chatStatus ? chatStatus : "Request coffee chat"}
                      </button>
                    )}
                    <Link to={`/network/${p.id}`} className="btn btn-secondary">
                      Profile
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        <div className="network-rail">
          <div className="rail-card is-accent">
            <div className="rail-card__title">Suggested for you</div>
            {suggested.map((p) => (
              <div className="suggested-row" key={p.id}>
                <div>
                  <div className="suggested-row__reason">{p.reason}</div>
                  <Link to={`/network/${p.id}`} style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}>
                    {p.name}
                  </Link>
                </div>
                <button className="suggested-row__add" onClick={() => toggleSavedConnection(p.id)} aria-label={`Add ${p.name}`}>
                  +
                </button>
              </div>
            ))}
          </div>

          <div className="rail-card">
            <div className="rail-card__title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Your coffee chats</span>
              {(savedConnections.length > 0 || Object.keys(coffeeChatStatus).length > 0) && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    const ids = new Set([...savedConnections, ...Object.keys(coffeeChatStatus)]);
                    downloadCsv(networkToCsv(ids, savedConnections, coffeeChatStatus, findPerson), "uc-portal-network.csv");
                  }}
                >
                  Export CSV
                </button>
              )}
            </div>
            {Object.keys(coffeeChatStatus).length === 0 && <p className="meta" style={{ margin: 0 }}>No coffee chats yet.</p>}
            {Object.entries(coffeeChatStatus).map(([personId, status]) => {
              const person = findPerson(personId);
              if (!person) return null;
              return (
                <div className="chat-status-row" key={personId}>
                  <span>
                    {person.name}
                  </span>
                  <span className="chat-status-row__status">{status}</span>
                </div>
              );
            })}
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Where UC alumni work</div>
            {companyCounts.map(([name, count]) => (
              <div className="company-count-row" key={name}>
                <span>{name}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {chatModalPerson && (
        <RequestCoffeeChatModal person={chatModalPerson} onClose={() => setChatModalPerson(null)} />
      )}
    </div>
  );
}
