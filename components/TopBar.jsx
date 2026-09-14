import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { currentUser } from "../data/mockUser.js";
import { CONVERSATIONS } from "../data/mockMessages.js";
import { useAppState } from "../data/store.jsx";
import { supabase } from "../data/supabaseClient.js";
import { displayName, initialsFromName } from "../data/profileUtils.js";
import RequestFeatureModal from "./modals/RequestFeatureModal.jsx";
import bearMark from "../assets/uc-bear-mark-navy.png";

const unreadMessageCount = CONVERSATIONS.filter((c) => c.unread).length;

export default function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showRequestFeature, setShowRequestFeature] = useState(false);
  const { profileOverrides, needsActionCount } = useAppState();
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
