import { useState } from "react";
import { Link } from "react-router-dom";
import { CONVERSATIONS } from "../data/mockMessages.js";
import { findPerson } from "../data/mockPeople.js";
import "../styles/feed.css";
import "../styles/notifications.css";
import "../styles/messages.css";

const TABS = ["All", "Requests", "Unread"];

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("");
}

export default function Messages() {
  const [conversations, setConversations] = useState(CONVERSATIONS);
  const [activeId, setActiveId] = useState(CONVERSATIONS[0].id);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  // Phone-UX pass: only meaningful below the 640px tier (styles/
  // messages.css's is-list-view/is-thread-view rules are scoped to that
  // media query -- at every wider width both panes show side by side
  // regardless of this state, unaffected). Replaces the old "stack both
  // panes, cap the list to a scrollable 240px" compromise CLAUDE.md
  // called out as the one deliberate non-toggle exception to the
  // responsive pass -- a real toggle was possible all along, there was
  // just no state to swap on yet.
  const [mobileView, setMobileView] = useState("list");

  const filtered = conversations.filter((c) => {
    if (tab === "Requests" && !c.isRequest) return false;
    if (tab === "Unread" && !c.unread) return false;
    if (search) {
      const person = findPerson(c.personId);
      if (!person?.name.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const active = conversations.find((c) => c.id === activeId);
  const activePerson = active ? findPerson(active.personId) : null;

  function handleSend() {
    if (!draft.trim()) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: [...c.messages, { id: `local-${Date.now()}`, author: "me", body: draft.trim(), timestamp: "Just now" }] }
          : c
      )
    );
    setDraft("");
  }

  return (
    <div className={`messages-layout${mobileView === "thread" ? " is-thread-view" : " is-list-view"}`}>
      <div className="conversation-list">
        <div className="conversation-list__header">
          <strong>Messages</strong>
          {/* No compose-new-conversation flow exists -- every real
              conversation here originates from a coffee-chat request or
              a "Message" button elsewhere (Network/Member profile),
              never started fresh from this page. */}
          <button className="btn btn-secondary" disabled title="Not built yet -- start a conversation from Network or a member's profile instead">
            New
          </button>
        </div>
        <div className="conversation-list__search">
          <input type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="conversation-list__tabs">
          {TABS.map((t) => {
            const count =
              t === "All" ? conversations.length : t === "Requests" ? conversations.filter((c) => c.isRequest).length : conversations.filter((c) => c.unread).length;
            return (
              <button key={t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
                {t} ({count})
              </button>
            );
          })}
        </div>
        <div className="conversation-list__rows">
          {filtered.map((c) => {
            const person = findPerson(c.personId);
            const lastMessage = c.messages[c.messages.length - 1];
            const preview = c.isRequest && c.messages.length === 1
              ? "Coffee chat request · pending"
              : `${lastMessage.author === "me" ? "You: " : ""}${lastMessage.body}`;
            return (
              <button
                key={c.id}
                className={`conversation-row${c.id === activeId ? " is-active" : ""}`}
                onClick={() => {
                  setActiveId(c.id);
                  setMobileView("thread");
                }}
              >
                <div className="conversation-row__top">
                  <span>{person.name}</span>
                  <span className="conversation-row__time">{lastMessage.timestamp}</span>
                </div>
                <div className="conversation-row__preview">{preview}</div>
              </button>
            );
          })}
        </div>
      </div>

      {active && activePerson && (
        <div className="thread-pane">
          <div className="thread-pane__header">
            {/* Only rendered/visible via CSS at the phone tier -- see
                messages.css's is-thread-view rule. At every wider width
                both panes already show side by side, so there's nothing
                to "go back" to. */}
            <button className="thread-pane__back" onClick={() => setMobileView("list")} aria-label="Back to conversations">
              ← Back
            </button>
            <div className="post-card__avatar">{initials(activePerson.name)}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{activePerson.name}</div>
              <div className="thread-pane__context">
                {activePerson.role}{activePerson.company ? `, ${activePerson.company}` : ""}
                {activePerson.office ? ` — ${activePerson.office}` : ""}
                {active.scheduledChat ? ` · ${active.scheduledChat}` : ""}
              </div>
            </div>
            <div className="thread-pane__header-actions">
              <Link to={`/network/${activePerson.id}`} className="btn btn-secondary">View profile</Link>
              {/* No specific job is attached to a generic message thread
                  to add -- real "Add to tracker" entry points (Job
                  detail, the Applications modal) always have one. */}
              <button className="btn btn-secondary" disabled title="Not wired up here -- add a job to your tracker from its own listing instead">
                Add to tracker
              </button>
            </div>
          </div>

          <div className="thread-pane__messages">
            <div className="thread-origin">{active.originLabel}</div>
            {active.messages.map((m) => (
              <div className={`message-bubble-row${m.author === "me" ? " is-outgoing" : ""}`} key={m.id}>
                <div className="message-bubble">
                  <p style={{ margin: 0 }}>{m.body}</p>
                  {m.sharedResource && (
                    <div className="shared-resource-card">
                      <span className="notif-icon">{m.sharedResource.logo}</span>
                      <span>{m.sharedResource.title}</span>
                      {/* m.sharedResource (data/mockMessages.js) is a
                          standalone illustrative title/logo, not tied to
                          a real RESOURCES id -- nothing real to open. */}
                      <button
                        className="btn btn-secondary"
                        style={{ marginLeft: "auto" }}
                        disabled
                        title="Not wired up -- this shared file isn't tied to a real resource in this prototype"
                      >
                        Open
                      </button>
                    </div>
                  )}
                  <div className="message-bubble__meta">
                    {m.author === "me" ? "You" : activePerson.name} · {m.timestamp}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="composer-row">
            {/* No file attachment, real-resource-sharing, or scheduling
                flow exists behind any of these three -- honestly inert
                rather than dead clicks next to a working Send below. */}
            <div className="composer-row__tools">
              <button className="btn btn-secondary" disabled title="Not built yet -- no file attachments in this prototype">
                Attach
              </button>
              <button className="btn btn-secondary" disabled title="Not built yet -- no resource-sharing flow in this prototype">
                Share a resource
              </button>
              <button className="btn btn-secondary" disabled title="Not built yet -- no scheduling flow in this prototype">
                Propose a time
              </button>
            </div>
            <textarea
              rows={1}
              placeholder="Write a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button className="btn btn-primary" onClick={handleSend}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
