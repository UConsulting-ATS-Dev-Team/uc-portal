import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { currentUser } from "../data/mockUser.js";
import { useAppState } from "../data/store.jsx";
import { supabase } from "../data/supabaseClient.js";
import { fetchUnreadCount } from "../data/messagesSync.js";
import { countNewSignupsSince } from "../data/adminNotificationsSync.js";
import { displayName, initialsFromName } from "../data/profileUtils.js";
import RequestFeatureModal from "./modals/RequestFeatureModal.jsx";
import bearMark from "../assets/uc-bear-mark-navy.png";

const SIGNUPS_LAST_SEEN_KEY = "uc-portal-admin-signups-last-seen";

export default function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRequestFeature, setShowRequestFeature] = useState(false);
  const { profileOverrides, needsActionCount, isAdmin } = useAppState();
  // Was CONVERSATIONS.filter(c => c.unread).length -- a fixed mock count
  // shown to every signed-in user regardless of their real inbox, same
  // bug class as the notification bell's old navCounts.notificationsUnread.
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  useEffect(() => {
    fetchUnreadCount().then(setUnreadMessageCount).catch(() => {});
  }, []);

  // Real admin-only "new signups" badge -- closes the "Notify admin on new
  // signups" quick win (in-app only; email waits on SES). "Last seen" is a
  // per-browser localStorage convenience (like recentSearches), not synced
  // state -- there's nothing to mark read server-side, this just avoids
  // re-showing the same count every page load once an admin has clicked
  // through. Defaults to 14 days back the first time an admin ever sees
  // this (same window list_recent_signups()'s own default uses), not "all
  // time," so a long-tenured admin's badge doesn't open at some enormous
  // historical count.
  const [newSignupsCount, setNewSignupsCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    const lastSeen = localStorage.getItem(SIGNUPS_LAST_SEEN_KEY) || new Date(Date.now() - 14 * 86400000).toISOString();
    countNewSignupsSince(lastSeen).then(setNewSignupsCount).catch(() => {});
  }, [isAdmin]);

  function handleSignupsBadgeClick() {
    localStorage.setItem(SIGNUPS_LAST_SEEN_KEY, new Date().toISOString());
    setNewSignupsCount(0);
  }
  const initials = initialsFromName(displayName(currentUser, profileOverrides));
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminMode = location.pathname.startsWith("/admin");

  function handleSearchSubmit(event) {
    event.preventDefault();
    const query = new FormData(event.target).get("q");
    navigate(`/search?q=${encodeURIComponent(query || "")}`);
  }

  // Was a plain <Link to="/sign-in"> -- looked like it worked (it does
  // land back on the sign-in screen) but never actually called
  // supabase.auth.signOut() anywhere, so the real session stayed valid.
  // On a shared/public computer, anyone hitting "back" (or just / again)
  // would land right back in signed in as the previous person -- "Sign
  // out" doing nothing real is worse than no button at all. Also clears
  // this browser's own uc-portal-state cache, same privacy reasoning --
  // leaving a signed-out session's preferences/tracked applications
  // sitting in localStorage for the next person on that device isn't
  // "signed out" either.
  async function handleSignOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    localStorage.removeItem("uc-portal-state");
    navigate("/sign-in");
  }

  return (
    <header className="topbar">
      <Link className="topbar__brand" to="/">
        <img className="topbar__mark" src={bearMark} alt="" />
        <span className="topbar__wordmark">
          <span className="topbar__wordmark-u">U</span>C Portal
        </span>
      </Link>

      {isAdminMode && <span className="chip chip-accent">Admin mode</span>}

      <form className="topbar__search" onSubmit={handleSearchSubmit}>
        <input type="search" name="q" placeholder="Search jobs, people, companies…" />
      </form>

      <div className="topbar__spacer" />

      <div className="topbar__actions">
        {isAdmin && (
          <Link className="topbar__notifications" to="/admin" aria-label="New signups" onClick={handleSignupsBadgeClick}>
            👥
            {newSignupsCount > 0 && <span className="topbar__notifications-count">{newSignupsCount}</span>}
          </Link>
        )}

        <Link className="topbar__notifications" to="/messages" aria-label="Messages">
          ✉️
          {unreadMessageCount > 0 && <span className="topbar__notifications-count">{unreadMessageCount}</span>}
        </Link>

        <Link className="topbar__notifications" to="/notifications" aria-label="Notifications">
          🔔
          {needsActionCount > 0 && <span className="topbar__notifications-count">{needsActionCount}</span>}
        </Link>

        <div>
          <button
            type="button"
            className="topbar__avatar"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {initials}
          </button>
          {menuOpen && (
            <div className="topbar__menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
              <Link to="/profile" role="menuitem" onClick={() => setMenuOpen(false)}>
                Profile
              </Link>
              <Link to="/profile" role="menuitem" onClick={() => setMenuOpen(false)}>
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setShowRequestFeature(true);
                }}
              >
                Request a feature
              </button>
              <button type="button" role="menuitem" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {showRequestFeature && <RequestFeatureModal onClose={() => setShowRequestFeature(false)} />}
    </header>
  );
}
