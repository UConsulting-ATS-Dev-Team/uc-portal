import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PEOPLE, findPerson } from "../data/mockPeople.js";
import { capabilitiesFor } from "../data/peopleUtils.js";
import { useAppState } from "../data/store.jsx";
import "../styles/jobDetail.css";
import "../styles/network.css";

const AUDIENCES = ["All", "Alumni", "Current members"];

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("");
}

function uniqueValues(key) {
  return ["All", ...new Set(PEOPLE.map((p) => p[key]).filter(Boolean))];
}

export default function Network() {
  const { preferences, savedConnections, coffeeChatStatus, requestCoffeeChat, toggleSavedConnection } = useAppState();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("All");
  const [company, setCompany] = useState("All");
  const [location, setLocation] = useState("All");
  const [gradYear, setGradYear] = useState("All");
  const [audience, setAudience] = useState("All");

  const alumniCount = PEOPLE.filter((p) => p.status !== "Current member").length;
  const memberCount = PEOPLE.filter((p) => p.status === "Current member").length;
  const openCount = PEOPLE.filter((p) => p.openToCoffeeChats).length;
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
  }, [search, industry, company, location, gradYear, audience]);

  const suggested = useMemo(() => {
    return PEOPLE.filter((p) => !savedConnections.includes(p.id))
      .map((p) => {
        let reason = "Similar career interests";
        if (preferences.followedCompanies.includes(p.company)) reason = "Alumni at companies you track";
        else if (preferences.industries.includes(p.industry)) reason = "In your target industry";
        return { ...p, reason };
      })
      .slice(0, 3);
  }, [savedConnections, preferences]);

  const companyCounts = useMemo(() => {
    const counts = {};
    PEOPLE.forEach((p) => {
      if (p.company) counts[p.company] = (counts[p.company] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, []);

  return (
    <div>
      <div className="network-header">
        <div>
          <h1>Network</h1>
          <p className="network-header__stat">
            {alumniCount} alumni · {memberCount} current members · {openCount} open to coffee chats this month
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
          {uniqueValues("industry").map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={company} onChange={(e) => setCompany(e.target.value)}>
          {uniqueValues("company").map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          {uniqueValues("location").map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={gradYear} onChange={(e) => setGradYear(e.target.value)}>
          <option>All</option>
          {[...new Set(PEOPLE.map((p) => p.classYear))].sort().map((y) => (
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
                  <div className="chip-row" style={{ marginBottom: "var(--space-3)" }}>
                    {capabilitiesFor(p).map((c) => (
                      <span className="chip" key={c}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="person-card__actions">
                    {isMember ? (
                      <button className="btn btn-primary">Message</button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        disabled={!!chatStatus}
                        onClick={() => requestCoffeeChat(p.id)}
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
    </div>
  );
}
