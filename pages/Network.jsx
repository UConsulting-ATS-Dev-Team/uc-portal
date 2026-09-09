import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { findPerson as findMockPerson } from "../data/mockPeople.js";
import { fetchRealPeople } from "../data/realPeople.js";
import { findConversationByPersonId } from "../data/mockMessages.js";
import { capabilitiesFor } from "../data/peopleUtils.js";
import { useAppState } from "../data/store.jsx";
import RequestCoffeeChatModal from "../components/modals/RequestCoffeeChatModal.jsx";
import "../styles/jobDetail.css";
import "../styles/network.css";
import "../styles/home.css";

const AUDIENCES = ["All", "Alumni", "Current members"];

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("");
}

function uniqueValues(people, key) {
  return ["All", ...new Set(people.map((p) => p[key]).filter(Boolean))];
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
  const [browseAnyway, setBrowseAnyway] = useState(false);
  const [chatModalPerson, setChatModalPerson] = useState(null);

  // Real UConsulting Directory data (150 active members + alumni) replaces
  // the 13 fictional mock people as of this integration -- see
  // JOB_ENGINE_ARCHITECTURE.md's Stage 5 entry. findPerson still checks the
  // mock roster too (below) since a few other still-mock screens link to
  // those ids and shouldn't 404.
  const [PEOPLE, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);

  useEffect(() => {
    fetchRealPeople()
      .then(setPeople)
      .finally(() => setPeopleLoading(false));
  }, []);

  function findPerson(id) {
    return PEOPLE.find((p) => p.id === id) ?? findMockPerson(id);
  }

  const alumniCount = PEOPLE.filter((p) => p.status !== "Current member").length;
  const memberCount = PEOPLE.filter((p) => p.status === "Current member").length;
  const pendingRequests = Object.values(coffeeChatStatus).filter((s) => s === "Request sent").length;

  const filtered = useMemo(() => {
    return PEOPLE.filter((p) => {
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
  }, [PEOPLE, search, industry, company, location, gradYear, audience]);

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
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          {uniqueValues(PEOPLE, "industry").map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={company} onChange={(e) => setCompany(e.target.value)}>
          {uniqueValues(PEOPLE, "company").map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          {uniqueValues(PEOPLE, "location").map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={gradYear} onChange={(e) => setGradYear(e.target.value)}>
          <option>All</option>
          {[...new Set(PEOPLE.map((p) => p.classYear).filter(Boolean))].sort().map((y) => (
            <option key={y}>{y}</option>
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
                {alumniCount} UC alumni are in the directory — the Networking track walks you through sending your
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
              return (
                <div className="person-card" key={p.id}>
                  <div className="person-card__avatar">{initials(p.name)}</div>
                  <div className="person-card__name">{p.name}</div>
                  <div className="person-card__status">
                    {isMember ? "Current member" : `${p.status} · Class of ${p.classYear}`}
                  </div>
                  <div className="person-card__role">
                    {p.role}
                    {p.company ? ` · ${p.company}` : ""}
                  </div>
                  <div className="person-card__meta">
                    {p.location} · {p.industry}
                  </div>
                  {/* capabilitiesFor() is generated/seeded, not a real claim
                      about this person -- fine for the remaining fictional
                      mock people, not appropriate to show as fact on a real,
                      named member or alum. */}
                  {!p.isReal && (
                    <div className="chip-row" style={{ marginBottom: "var(--space-3)" }}>
                      {capabilitiesFor(p).map((c) => (
                        <span className="chip" key={c}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="person-card__actions">
                    {isMember ? (
                      findConversationByPersonId(p.id) ? (
                        <Link to={`/messages?personId=${p.id}`} className="btn btn-primary">Message</Link>
                      ) : (
                        // No seeded conversation exists for this person yet
                        // (real "Message" only ever reaches an existing
                        // thread -- no compose-new-conversation flow exists,
                        // same limitation Messages.jsx's own "New" button
                        // documents). Honestly inert rather than a button
                        // that looks live but lands on someone else's thread.
                        <button className="btn btn-primary" disabled title="No conversation with this person yet -- messaging starts from a coffee chat">
                          Message
                        </button>
                      )
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
            <div className="rail-card__title">Your coffee chats</div>
            {Object.keys(coffeeChatStatus).length === 0 && <p className="meta" style={{ margin: 0 }}>No coffee chats yet.</p>}
            {Object.entries(coffeeChatStatus).map(([personId, status]) => {
              const person = findPerson(personId);
              if (!person) return null;
              return (
                <div className="chat-status-row" key={personId}>
                  <span>{person.name}</span>
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
