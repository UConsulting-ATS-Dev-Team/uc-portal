import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchRealPersonById } from "../data/realPeople.js";
import {
  listMessageableMembers,
  findMemberByEmail,
  fetchConversations,
  fetchThread,
  sendMessage,
  markThreadRead,
} from "../data/messagesSync.js";
import { fetchMemberAvatars } from "../data/avatarSync.js";
import Modal from "../components/Modal.jsx";
import Avatar from "../components/Avatar.jsx";

const TABS = ["All", "Unread"];

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Real 1:1 messaging (see the real_messages migration for the full
// rationale). Every conversation here is a real, delivered message
// between two real signed-in accounts -- unlike the old mock version,
// there's no concept of a "request" (that was tied to coffee-chat mock
// data), no scheduled-chat origin banner, and no shared-resource
// attachments, since none of those have a real backing yet; dropped
// rather than faked. A real account also has no reliable role/company to
// show in the thread header (that lives on the still-unlinked `people`
// directory, not on a real account) -- just its real display name.
export default function Messages() {
  const [searchParams] = useSearchParams();
  const requestedPersonId = searchParams.get("personId");
  // A real-account deep link (Home.jsx's "Meet X" nudge, Feed.jsx's
  // "Alumni active this week" rail) -- these already resolved to a real
  // auth.users id via list_open_to_coffee_chat_members(), so there's no
  // people.id/email resolution needed the way ?personId= requires.
  const requestedAccountId = searchParams.get("accountId");
  const requestedAccountName = searchParams.get("accountName");

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [activeName, setActiveName] = useState(null);
  const [notOnPortalName, setNotOnPortalName] = useState(null);
  const [thread, setThread] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewPicker, setShowNewPicker] = useState(false);
  const [messageable, setMessageable] = useState([]);
  const [mobileView, setMobileView] = useState("list");
  const [avatarsById, setAvatarsById] = useState(new Map());

  // Edge-swipe-back on the thread pane, real gesture nav (2026-09-14 mobile
  // QA pass) -- only the "← Back" button existed before. Deliberately an
  // edge swipe (must start within 24px of the pane's own left edge, the
  // same pattern iOS's own system back-swipe uses) rather than "swipe
  // starting anywhere in the thread" -- a swipe from the middle of the
  // screen would fight vertical scrolling through message history and
  // horizontal text selection/dragging inside the composer's textarea. No
  // viewport check needed: mobileView only has any visual effect inside
  // the phone-width media query (styles/messages.css), so this is a no-op
  // everywhere else.
  const swipeRef = useRef({ active: false, startX: 0, startY: 0 });
  const SWIPE_EDGE_PX = 24;
  const SWIPE_COMMIT_PX = 60;

  function handleThreadPointerDown(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX - rect.left > SWIPE_EDGE_PX) return; // not an edge touch -- ignore
    swipeRef.current = { active: true, startX: event.clientX, startY: event.clientY };
  }

  function handleThreadPointerMove(event) {
    const swipe = swipeRef.current;
    if (!swipe.active) return;
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    // Mostly-horizontal, mostly-rightward, past the commit threshold.
    if (dx > SWIPE_COMMIT_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipe.active = false;
      setMobileView("list");
    }
  }

  function handleThreadPointerEnd() {
    swipeRef.current.active = false;
  }

  function loadConversations() {
    setConversationsLoading(true);
    fetchConversations()
      .then(setConversations)
      .catch((err) => setError(err.message))
      .finally(() => setConversationsLoading(false));
  }

  useEffect(() => {
    loadConversations();
    fetchMemberAvatars().then(({ byId }) => setAvatarsById(byId));
  }, []);

  useEffect(() => {
    if (!requestedAccountId) return;
    setActiveId(requestedAccountId);
    setActiveName(requestedAccountName ? decodeURIComponent(requestedAccountName) : "Member");
    setMobileView("thread");
  }, [requestedAccountId, requestedAccountName]);

  // A "Message" link elsewhere (Network.jsx, MemberProfile.jsx) still
  // passes ?personId=<people.id> -- a real directory record, not
  // necessarily a real account. Resolves that person's real email, then
  // checks whether it matches a real signed-in account -- opens a real
  // thread if so, otherwise shows an honest "hasn't joined yet" state
  // instead of a broken/blank thread.
  useEffect(() => {
    if (!requestedPersonId) return;
    fetchRealPersonById(requestedPersonId).then((person) => {
      if (!person?.email) return;
      findMemberByEmail(person.email).then((memberId) => {
        if (memberId) {
          setActiveId(memberId);
          setActiveName(person.name);
          setMobileView("thread");
        } else {
          setNotOnPortalName(person.name);
          setMobileView("thread");
        }
      });
    });
  }, [requestedPersonId]);

  useEffect(() => {
    if (!activeId) return;
    setThreadLoading(true);
    fetchThread(activeId)
      .then(setThread)
      .then(() => markThreadRead(activeId))
      .then(loadConversations)
      .catch((err) => setError(err.message))
      .finally(() => setThreadLoading(false));
  }, [activeId]);

  function openConversation(c) {
    setActiveId(c.counterpartId);
    setActiveName(c.counterpartName);
    setNotOnPortalName(null);
    setMobileView("thread");
  }

  function openNewPicker() {
    setError(null);
    listMessageableMembers().then(setMessageable).catch((err) => setError(err.message));
    setShowNewPicker(true);
  }

  function startConversation(member) {
    setShowNewPicker(false);
    setActiveId(member.member_id);
    setActiveName(member.display_name);
    setNotOnPortalName(null);
    setMobileView("thread");
  }

  async function handleSend() {
    if (!draft.trim() || sending || !activeId) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(activeId, draft.trim());
      setDraft("");
      const rows = await fetchThread(activeId);
      setThread(rows);
      loadConversations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const filtered = conversations.filter((c) => {
    if (tab === "Unread" && c.unreadCount === 0) return false;
    if (search && !c.counterpartName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className={`messages-layout${mobileView === "thread" ? " is-thread-view" : " is-list-view"}`}>
      <div className="conversation-list">
        <div className="conversation-list__header">
          <strong>Messages</strong>
          <button className="btn btn-secondary" onClick={openNewPicker}>
            New
          </button>
        </div>
        <div className="conversation-list__search">
          <input type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="conversation-list__tabs">
          {TABS.map((t) => {
            const count = t === "All" ? conversations.length : conversations.filter((c) => c.unreadCount > 0).length;
            return (
              <button key={t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
                {t} ({count})
              </button>
            );
          })}
        </div>
        <div className="conversation-list__rows">
          {conversationsLoading && <p className="meta" style={{ padding: "var(--space-4)" }}>Loading…</p>}
          {!conversationsLoading && filtered.length === 0 && (
            <p className="meta" style={{ padding: "var(--space-4)" }}>
              {conversations.length === 0 ? "No conversations yet — start one with \"New.\"" : "Nothing here."}
            </p>
          )}
          {filtered.map((c) => (
            <button
              key={c.counterpartId}
              className={`conversation-row${c.counterpartId === activeId ? " is-active" : ""}`}
              onClick={() => openConversation(c)}
            >
              <div className="conversation-row__top">
                <span>{c.counterpartName}</span>
                <span className="conversation-row__time">{relativeTime(c.lastMessage.created_at)}</span>
              </div>
              <div className="conversation-row__preview">
                {c.lastMessage.sender_id === activeId ? "" : "You: "}
                {c.lastMessage.body}
              </div>
            </button>
          ))}
        </div>
      </div>

      {notOnPortalName && !activeId && (
        <div
          className="thread-pane"
          onPointerDown={handleThreadPointerDown}
          onPointerMove={handleThreadPointerMove}
          onPointerUp={handleThreadPointerEnd}
          onPointerCancel={handleThreadPointerEnd}
        >
          <div className="thread-pane__header">
            <button className="thread-pane__back" onClick={() => setMobileView("list")} aria-label="Back to conversations">
              ← Back
            </button>
            <div style={{ fontWeight: 700 }}>{notOnPortalName}</div>
          </div>
          <p className="meta" style={{ padding: "var(--space-6)" }}>
            {notOnPortalName} hasn't joined UC Portal yet, so there's no real account to message. You'll be able to
            message them here once they sign up.
          </p>
        </div>
      )}

      {activeId && (
        <div
          className="thread-pane"
          onPointerDown={handleThreadPointerDown}
          onPointerMove={handleThreadPointerMove}
          onPointerUp={handleThreadPointerEnd}
          onPointerCancel={handleThreadPointerEnd}
        >
          <div className="thread-pane__header">
            <button className="thread-pane__back" onClick={() => setMobileView("list")} aria-label="Back to conversations">
              ← Back
            </button>
            <div className="post-card__avatar">
              <Avatar name={activeName || "?"} url={avatarsById.get(activeId)} />
            </div>
            <div style={{ fontWeight: 700 }}>{activeName}</div>
          </div>

          <div className="thread-pane__messages">
            {threadLoading && <p className="meta">Loading…</p>}
            {!threadLoading && thread.length === 0 && <p className="meta">No messages yet — say hello.</p>}
            {thread.map((m) => (
              <div className={`message-bubble-row${m.sender_id !== activeId ? " is-outgoing" : ""}`} key={m.id}>
                <div className="message-bubble">
                  <p style={{ margin: 0 }}>{m.body}</p>
                  <div className="message-bubble__meta">
                    {m.sender_id !== activeId ? "You" : activeName} · {relativeTime(m.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="meta" style={{ color: "#B3261E", padding: "0 var(--space-4)" }}>
              {error}
            </p>
          )}

          <div className="composer-row">
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
            <button className="btn btn-primary" onClick={handleSend} disabled={sending || !draft.trim()}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}

      {showNewPicker && (
        <Modal title="New conversation" onClose={() => setShowNewPicker(false)} width={420}>
          {messageable.length === 0 && <p className="meta">No other real UC Portal accounts exist yet to message.</p>}
          {messageable.map((m) => (
            <button
              key={m.member_id}
              className="conversation-row"
              onClick={() => startConversation(m)}
              style={{ width: "100%", textAlign: "left" }}
            >
              {m.display_name}
            </button>
          ))}
        </Modal>
      )}
    </div>
  );
}
