import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRealPersonById } from "../data/realPeople.js";
import { fetchMemberAvatars } from "../data/avatarSync.js";
import { useAppState } from "../data/store.jsx";
import Placeholder from "./Placeholder.jsx";
import Skeleton from "../components/Skeleton.jsx";
import Avatar from "../components/Avatar.jsx";
import RequestCoffeeChatModal from "../components/modals/RequestCoffeeChatModal.jsx";
import "../styles/jobDetail.css";
import "../styles/memberProfile.css";

// Real member/alumni profile (from the UConsulting Directory import -- see
// JOB_ENGINE_ARCHITECTURE.md's Stage 5 entry). Deliberately a separate,
// simpler component from MemberProfile.jsx rather than a shared one with
// conditionals sprinkled through it: that component's rich sections
// (Experience with specific fabricated date ranges, Education with a
// randomly-picked major, "Happy to help with" as a checked/unchecked
// checklist, Contributions with specific stats) are all generated per
// data/peopleUtils.js for the 13 fictional mock people. Rendering that same
// machinery for a real, named person would mean displaying invented
// specifics -- a fake employment history, a fabricated consent checklist --
// attached to someone who never provided them. This page shows only fields
// that trace directly to the source spreadsheet, and says so explicitly
// wherever something isn't known rather than inventing it.
export default function RealMemberProfile({ personId }) {
  const [person, setPerson] = useState(undefined); // undefined = loading, null = not found
  const { savedConnections, coffeeChatStatus, toggleSavedConnection } = useAppState();
  const [showChatModal, setShowChatModal] = useState(false);
  const [avatarsByEmail, setAvatarsByEmail] = useState(new Map());

  useEffect(() => {
    let cancelled = false;
    fetchRealPersonById(personId).then((p) => {
      if (!cancelled) setPerson(p);
    });
    fetchMemberAvatars().then(({ byEmail }) => {
      if (!cancelled) setAvatarsByEmail(byEmail);
    });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  if (person === undefined) {
    return <Skeleton />;
  }
  if (person === null) {
    return <Placeholder title="Member not found" />;
  }

  const isMember = person.status === "Current member";
  const chatStatus = coffeeChatStatus[person.id];
  const isSaved = savedConnections.includes(person.id);

  const knownFacts = [
    person.major && { label: "Major", value: person.major },
    person.admitClass && { label: "Admitted", value: person.admitClass },
    person.graduatingClass && { label: "Graduated", value: person.graduatingClass },
    person.mentor && { label: "UC mentor", value: person.mentor },
  ].filter(Boolean);

  return (
    <div>
      <div className="profile-header">
        <div className="profile-header__main">
          <div className="profile-header__top">
            <div className="profile-header__avatar">
              <Avatar
                name={person.name}
                url={(person.email && avatarsByEmail.get(person.email.toLowerCase())) || person.avatarUrl}
              />
            </div>
            <div>
              <div className="profile-header__name-row">
                <h1>{person.name}</h1>
                {!isMember && person.classYear && (
                  <span className="chip chip-accent">{person.status} '{String(person.classYear).slice(2)}</span>
                )}
                {isMember && <span className="chip chip-accent">Current member</span>}
              </div>
              <p className="profile-header__role">
                {person.role || person.status}
                {person.company ? ` at ${person.company}` : ""}
                {person.location ? ` · ${person.location}` : ""}
              </p>
            </div>
          </div>
          <div className="profile-header__actions">
            <button className="btn btn-primary" disabled={!!chatStatus} onClick={() => setShowChatModal(true)}>
              {chatStatus ? chatStatus : "Request coffee chat"}
            </button>
            {/* Was missing entirely -- caught by an actual live
                click-through, not a code read. pages/Network.jsx's card
                grid already linked here correctly (fixed earlier the same
                day), but this page, the one a Network card's own name
                link lands on, never had a Message action at all. Same
                real-account resolution as everywhere else this button
                appears -- pages/Messages.jsx's own ?personId= handling
                opens a real thread if this person has signed up, or says
                so honestly if they haven't. */}
            <Link to={`/messages?personId=${person.id}`} className="btn btn-secondary">
              Message
            </Link>
            {person.email && (
              <a className="btn btn-secondary" href={`mailto:${person.email}`}>
                Email
              </a>
            )}
            {person.linkedin && (
              <a className="btn btn-secondary" href={person.linkedin} target="_blank" rel="noreferrer">
                LinkedIn ↗
              </a>
            )}
            <button className="btn btn-secondary" onClick={() => toggleSavedConnection(person.id)}>
              {isSaved ? "Saved to network ✓" : "Save to my network"}
            </button>
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-section">
            <h2 className="detail-section__title">What UC knows</h2>
            {knownFacts.length === 0 ? (
              <p className="meta">
                No further detail on file for {person.name.split(" ")[0]} yet beyond what's shown above.
              </p>
            ) : (
              knownFacts.map((f) => (
                <div className="experience-row" key={f.label}>
                  <div>
                    <div className="experience-row__title">{f.label}</div>
                    <div className="experience-row__meta">{f.value}</div>
                  </div>
                </div>
              ))
            )}
            <p className="meta" style={{ marginTop: "var(--space-5)" }}>
              This profile is built from UConsulting's own member/alumni directory, not a generated bio — it only
              shows what the club actually has on file.
            </p>
          </div>
        </div>

        <div className="detail-rail">
          <div className="rail-card">
            <div className="rail-card__title">Directory source</div>
            <p className="meta" style={{ margin: 0 }}>
              UConsulting Directory {isMember ? "(Active tab)" : "(Alumni tab)"}
            </p>
          </div>
        </div>
      </div>

      {showChatModal && <RequestCoffeeChatModal person={person} onClose={() => setShowChatModal(false)} />}
    </div>
  );
}
