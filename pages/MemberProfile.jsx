import { Link, useParams } from "react-router-dom";
import { findPerson } from "../data/mockPeople.js";
import {
  capabilitiesFor,
  happyToHelpFor,
  skillsFor,
  educationFor,
  experienceFor,
  ucExperienceFor,
  contributionsFor,
  yearsExperienceFor,
} from "../data/peopleUtils.js";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
import Placeholder from "./Placeholder.jsx";
import "../styles/jobDetail.css";
import "../styles/memberProfile.css";

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("");
}

export default function MemberProfile() {
  const { personId } = useParams();
  const person = findPerson(personId);
  const { preferences, savedConnections, coffeeChatStatus, requestCoffeeChat, toggleSavedConnection } = useAppState();

  if (!person) {
    return <Placeholder title="Member not found" />;
  }

  const isMember = person.status === "Current member";
  const chatStatus = coffeeChatStatus[person.id];
  const isSaved = savedConnections.includes(person.id);
  const ucExperience = ucExperienceFor(person);
  const contributions = contributionsFor(person);
  const help = happyToHelpFor(person);

  const sharedContext = [];
  if (ucExperience[0].role === currentUser.ucCommittee) sharedContext.push(`Both on ${currentUser.ucCommittee}`);
  if (person.mutualConnections > 0) sharedContext.push(`${person.mutualConnections} mutual UC connections`);
  if (preferences.industries.includes(person.industry)) sharedContext.push("Same target industry");
  if (preferences.followedCompanies.includes(person.company)) sharedContext.push("Works at a company you track");
  if (sharedContext.length === 0) sharedContext.push("No shared context yet — update your preferences in My Profile.");

  return (
    <div>
      <div className="profile-header">
        <div className="profile-header__main">
          <div className="profile-header__top">
            <div className="profile-header__avatar">{initials(person.name)}</div>
            <div>
              <div className="profile-header__name-row">
                <h1>{person.name}</h1>
                {!isMember && <span className="chip chip-accent">{person.status} '{String(person.classYear).slice(2)}</span>}
                {person.openToCoffeeChats && <span className="chip">Open to coffee chats</span>}
              </div>
              <p className="profile-header__role">
                {person.role}
                {person.company ? ` at ${person.company}` : ""} · {person.location}
              </p>
            </div>
          </div>
          <p className="profile-header__meta">
            {person.industry} · {yearsExperienceFor(person)} yrs experience · UC class of {person.classYear}
          </p>
          <div className="profile-header__actions">
            <button
              className="btn btn-primary"
              disabled={!!chatStatus}
              onClick={() => requestCoffeeChat(person.id)}
            >
              {chatStatus ? chatStatus : "Request coffee chat"}
            </button>
            <button className="btn btn-secondary">Ask for advice</button>
            <Link to="/messages" className="btn btn-secondary">Message</Link>
            <button className="btn btn-secondary" onClick={() => toggleSavedConnection(person.id)}>
              {isSaved ? "Saved to network ✓" : "Save to my network"}
            </button>
          </div>
        </div>

        <div className="profile-shared-context">
          <div className="profile-shared-context__title">Your shared UC context</div>
          <ul>
            {sharedContext.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-section">
            <h2 className="detail-section__title">Experience</h2>
            {experienceFor(person).map((e, i) => (
              <div className="experience-row" key={i}>
                <div className="experience-row__logo">{person.company ? person.company.slice(0, 3).toUpperCase() : "UC"}</div>
                <div>
                  <div className="experience-row__title">
                    {e.title} · {e.company}
                  </div>
                  <div className="experience-row__meta">
                    {e.dates} · {e.location}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">UC experience</h2>
            {ucExperience.map((e, i) => (
              <div className="experience-row" key={i}>
                <div>
                  <div className="experience-row__title">
                    {e.role} · {e.years}
                  </div>
                  <div className="experience-row__meta">{e.contribution}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="detail-section">
            <h2 className="detail-section__title">Contributions to UC</h2>
            <div className="contributions-grid">
              <div className="contributions-grid__cell">
                <div className="stat-strip__number">{contributions.resourcesAuthored}</div>
                <div className="stat-strip__label">Resources authored</div>
              </div>
              <div className="contributions-grid__cell">
                <div className="stat-strip__number">{contributions.writeups}</div>
                <div className="stat-strip__label">Interview write-ups</div>
              </div>
              <div className="contributions-grid__cell">
                <div className="stat-strip__number">{contributions.jobPostings}</div>
                <div className="stat-strip__label">Job postings</div>
              </div>
              <div className="contributions-grid__cell">
                <div className="stat-strip__number">{contributions.coffeeChatsHeld}</div>
                <div className="stat-strip__label">Coffee chats held</div>
              </div>
            </div>
          </div>
        </div>

        <div className="detail-rail">
          <div className="rail-card">
            <div className="rail-card__title">Education</div>
            <p style={{ margin: 0 }}>{educationFor(person)}</p>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Skills & focus</div>
            <div className="chip-row" style={{ marginBottom: 0 }}>
              {skillsFor(person).map((s) => (
                <span className="chip" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Happy to help with</div>
            <ul className="checklist-simple">
              {help.map((h) => (
                <li key={h.label} className={h.checked ? "is-checked" : ""}>
                  <span>{h.checked ? "✓" : "✕"}</span>
                  <span>{h.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rail-card">
            <div className="rail-card__title">Mutual UC connections</div>
            <p style={{ margin: 0 }}>{person.mutualConnections}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
