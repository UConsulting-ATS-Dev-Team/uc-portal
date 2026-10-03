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
  archiveConversation,
  unarchiveConversation,
  fetchPendingForPerson,
  sendPendingMessage,
  cancelPendingMessage,
  fetchPendingConversations,
} from "../data/messagesSync.js";
import { fetchMemberAvatars } from "../data/avatarSync.js";
import Modal from "../components/Modal.jsx";
import Avatar from "../components/Avatar.jsx";

const TABS = ["All", "Unread", "Archived"];
const SWIPE_ARCHIVE_PX = 70;

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

// Its own component (not inlined in a .map()) since it needs its own
// pointer-gesture state per row -- React hooks can't be called inside a
// loop. Real per-row swipe-to-archive, same simple "decide on release,
// no live drag-following" approach as data/useSwipeTabs.js -- mouse
// excluded, swiping isn't a mouse gesture. The button next to it is the
// primary, always-visible, fully accessible way to do the same thing;
// the swipe is a convenience on top, not a replacement.
function ConversationRow({ conversation, isActive, onOpen, onArchive, onUnarchive }) {
  const dragRef = useRef(null);

  function handlePointerDown(e) {
    if (e.pointerType === "mouse") return;
    dragRef.current = { startX: e.clientX, startY: e.clientY };
  }

  function handlePointerUp(e) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (dx < -SWIPE_ARCHIVE_PX && Math.abs(dx) > Math.abs(dy)) {
      conversation.archived ? onUnarchive(conversation.counterpartId) : onArchive(conversation.counterpartId);
    }
  }

  return (
    <div
      className="conversation-row-wrap"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => (dragRef.current = null)}
    >
      <button
        className={`conversation-row${isActive ? " is-active" : ""}`}
        onClick={() => onOpen(conversation)}
      >
        <div className="conversation-row__top">
          <span>{conversation.counterpartName}</span>
          <span className="conversation-row__time">{relativeTime(conversation.lastMessage.created_at)}</span>
        </div>
        <div className="conversation-row__preview">
          {conversation.lastMessage.sender_id === conversation.counterpartId ? "" : "You: "}
          {conversation.lastMessage.body}
        </div>
      </button>
      <button
        className="conversation-row__archive-btn btn-link"
        onClick={(e) => {
          e.stopPropagation();
          conversation.archived ? onUnarchive(conversation.counterpartId) : onArchive(conversation.counterpartId);
        }}
      >
        {conversation.archived ? "Unarchive" : "Archive"}
      </button>
    </div>
  );
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
  // A directory person with no account yet -- messages to them wait in
  // pending_messages and are delivered when they sign up. { id, name, hasEmail }
  const [pendingPerson, setPendingPerson] = useState(null);
  const [pendingThread, setPendingThread] = useState([]);
  const [pendingConversations, setPendingConversations] = useState([]);
  const [thread, setThread] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewPicker, setShowNewPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
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
    // Degrades to "none" if the pending_messages table isn't there yet.
    fetchPendingConversations().then(setPendingConversations).catch(() => setPendingConversations([]));
  }

  // Archiving the thread you're currently looking at closes it back to
  // the list view -- staying open on a conversation you just tucked away
  // would be a confusing dead end.
  function handleArchive(counterpartId) {
    archiveConversation(counterpartId)
      .then(loadConversations)
      .then(() => {
        if (activeId === counterpartId) {
          setActiveId(null);
          setMobileView("list");
        }
      })
      .catch((err) => setError(err.message));
  }

  function handleUnarchive(counterpartId) {
    unarchiveConversation(counterpartId).then(loadConversations).catch((err) => setError(err.message));
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
      if (!person) return;
      if (!person.email) {
        // Nothing to deliver to later -- no email on file to match a future account against.
        openPending({ id: person.id, name: person.name, hasEmail: false });
        return;
      }
      findMemberByEmail(person.email).then((memberId) => {
        if (memberId) {
          setActiveId(memberId);
          setActiveName(person.name);
          setPendingPerson(null);
          setMobileView("thread");
        } else {
          openPending({ id: person.id, name: person.name, hasEmail: true });
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

  function openPending(person) {
    setActiveId(null);
    setPendingPerson(person);
    setPendingThread([]);
    setMobileView("thread");
    fetchPendingForPerson(person.id).then(setPendingThread).catch(() => {});
  }

  function openConversation(c) {
    setActiveId(c.counterpartId);
    setActiveName(c.counterpartName);
    setPendingPerson(null);
    setMobileView("thread");
  }

  function openNewPicker() {
    setError(null);
    listMessageableMembers().then(setMessageable).catch((err) => setError(err.message));
    setPickerSearch("");
    setShowNewPicker(true);
  }

  function startConversation(member) {
    setShowNewPicker(false);
    setActiveId(member.member_id);
    setActiveName(member.display_name);
    setPendingPerson(null);
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

  async function handleSendPending() {
    if (!draft.trim() || sending || !pendingPerson) return;
    setSending(true);
    setError(null);
    try {
      await sendPendingMessage(pendingPerson.id, draft.trim());
      setDraft("");
      setPendingThread(await fetchPendingForPerson(pendingPerson.id));
      loadConversations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleCancelPending(id) {
    setError(null);
    try {
      await cancelPendingMessage(id);
      setPendingThread(await fetchPendingForPerson(pendingPerson.id));
      loadConversations();
    } catch (err) {
      setError(err.message);
    }
  }

  const showPendingRows = tab === "All";
  const visiblePending = showPendingRows
    ? pendingConversations.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  const filtered = conversations.filter((c) => {
    if (tab === "Archived") return c.archived;
    if (c.archived) return false; // All/Unread never show an archived thread
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
            const count =
              t === "All"
                ? conversations.filter((c) => !c.archived).length + pendingConversations.length
                : t === "Archived"
                ? conversations.filter((c) => c.archived).length
                : conversations.filter((c) => !c.archived && c.unreadCount > 0).length;
            return (
              <button key={t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
                {t} ({count})
              </button>
            );
          })}
        </div>
        <div className="conversation-list__rows">
          {conversationsLoading && <p className="meta" style={{ padding: "var(--space-4)" }}>Loading…</p>}
          {!conversationsLoading && filtered.length === 0 && visiblePending.length === 0 && (
            <p className="meta" style={{ padding: "var(--space-4)" }}>
              {conversations.length === 0 && pendingConversations.length === 0 ? "No conversations yet — start one with \"New.\"" : "Nothing here."}
            </p>
          )}
          {visiblePending.map((c) => (
            <div className="conversation-row-wrap" key={`pending-${c.personId}`}>
              <button
                className={`conversation-row${pendingPerson?.id === c.personId && !activeId ? " is-active" : ""}`}
                onClick={() => openPending({ id: c.personId, name: c.name, hasEmail: true })}
              >
                <div className="conversation-row__top">
                  <span>{c.name}</span>
                  <span className="conversation-row__time">{relativeTime(c.lastMessage.created_at)}</span>
                </div>
                <div className="conversation-row__preview">Waiting for them to join · You: {c.lastMessage.body}</div>
              </button>
            </div>
          ))}
          {filtered.map((c) => (
            <ConversationRow
              key={c.counterpartId}
              conversation={c}
              isActive={c.counterpartId === activeId}
              onOpen={openConversation}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
            />
          ))}
        </div>
      </div>

      {pendingPerson && !activeId && (
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
            <div style={{ fontWeight: 700 }}>{pendingPerson.name}</div>
          </div>

          <div className="thread-pane__messages">
            <p className="meta">
              {pendingPerson.hasEmail
                ? `${pendingPerson.name} hasn't joined UC Portal yet. Write a message now and it will be delivered to them the moment they sign up. Only you can see it until then.`
                : `${pendingPerson.name} doesn't have an email on file in the directory, so there's no way to deliver a message to them when they join.`}
            </p>
            {pendingThread.map((m) => (
              <div className="message-bubble-row is-outgoing" key={m.id}>
                <div className="message-bubble">
                  <p style={{ margin: 0 }}>{m.body}</p>
                  <div className="message-bubble__meta">
                    You · {relativeTime(m.created_at)} · Waiting to be delivered{" "}
                    <button className="btn-link" onClick={() => handleCancelPending(m.id)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="meta" style={{ color: "var(--color-danger)", padding: "0 var(--space-4)" }}>
              {error}
            </p>
          )}

          {pendingPerson.hasEmail && (
            <div className="composer-row">
              <textarea
                rows={1}
                placeholder="Write a message to deliver when they join…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPending();
                  }
                }}
              />
              <button className="btn btn-primary" onClick={handleSendPending} disabled={sending || !draft.trim()}>
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          )}
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
            <p className="meta" style={{ color: "var(--color-danger)", padding: "0 var(--space-4)" }}>
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
          {messageable.length > 8 && (
            <input
              type="text"
              placeholder="Search by name"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              style={{ width: "100%", marginBottom: "var(--space-3)" }}
            />
          )}
          {messageable
            .filter((m) => !pickerSearch.trim() || m.display_name.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
            .sort((a, b) => a.display_name.localeCompare(b.display_name))
            .map((m) => (
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
