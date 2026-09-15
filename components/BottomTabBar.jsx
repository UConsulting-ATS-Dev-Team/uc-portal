import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, X } from "lucide-react";
import { MAIN_ITEMS, LEADERSHIP_ITEMS, BOTTOM_BAR_PRIMARY_KEYS } from "../data/navItems.js";
import { useAppState } from "../data/store.jsx";

// Phone-UX pass: below 640px (styles/shell.css's phone tier), this
// replaces the persistent icon-only .rail entirely -- live-audited at
// 375px, that rail permanently occupied ~15% of the screen width just to
// show 8 unlabeled icons, on every single page, whether or not phone nav
// was ever the point of that screen. A fixed bottom bar is the standard
// mobile-web pattern instead: thumb-reachable, and (unlike the side rail)
// this component is entirely inert -- zero layout presence -- above
// 640px, via CSS alone (styles/shell.css's .bottom-tab-bar rule), so
// desktop/tablet nav is completely unaffected.
//
// Only 4 primary destinations fit a legible bottom bar (BOTTOM_BAR_PRIMARY_
// KEYS, data/navItems.js -- picked from CLAUDE.md's own stated priorities),
// plus a 5th "More" slot opening every other destination (the rest of
// MAIN_ITEMS, and LEADERSHIP_ITEMS when applicable) in a dismissible sheet
// anchored above the bar -- same "small overlay menu" pattern TopBar.jsx's
// avatar menu already uses, just anchored at the bottom instead of the top.
export default function BottomTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  // Real profiles.role, not the disconnected mock data/mockUser.js#
  // currentUser.role -- same fix as NavRail.jsx's identical check.
  const { isAdmin, isAlumni, trackedJobs } = useAppState();

  const availableItems = isAlumni ? MAIN_ITEMS.filter((item) => !item.currentMemberOnly) : MAIN_ITEMS;
  // BOTTOM_BAR_PRIMARY_KEYS was picked around current-member priorities
  // (Jobs/Applications are two of its four slots) -- meaningless for
  // alumni, who don't have those routes at all. Alumni's whole available
  // set (Network, Feed, Companies, My Profile) happens to be exactly 4,
  // so it fits directly as primary tabs with no "More" overflow needed.
  const primaryItems = isAlumni ? availableItems : availableItems.filter((item) => BOTTOM_BAR_PRIMARY_KEYS.includes(item.to));
  const moreItems = isAlumni ? [] : availableItems.filter((item) => !BOTTOM_BAR_PRIMARY_KEYS.includes(item.to));
  // "More" itself reads as active on any route not covered by a primary
  // tab (e.g. a job/company/resource detail page, or any /admin/* route)
  // so the bar always shows *something* selected instead of going blank.
  const isMoreActive = !primaryItems.some((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)));

  return (
    <>
      <nav className="bottom-tab-bar">
        {primaryItems.map(({ label, to, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `bottom-tab-bar__tab${isActive ? " is-active" : ""}`}
            onClick={() => setMoreOpen(false)}
          >
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>{label}</span>
            {badge && badge(trackedJobs) > 0 && <span className="bottom-tab-bar__badge">{badge(trackedJobs)}</span>}
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-tab-bar__tab${isMoreActive && !moreOpen ? " is-active" : ""}`}
          onClick={() => setMoreOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
        >
          {moreOpen ? <X size={20} strokeWidth={1.5} aria-hidden="true" /> : <MoreHorizontal size={20} strokeWidth={1.5} aria-hidden="true" />}
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          {/* Full-bleed tap-to-dismiss backdrop, same intent as clicking
              outside TopBar's avatar menu -- that one relies on
              onMouseLeave (fine for a mouse-driven desktop dropdown, not
              for touch), so this gets an explicit backdrop instead. */}
          <button
            type="button"
            className="bottom-tab-bar__backdrop"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="bottom-tab-bar__more-panel" role="menu">
            <ul className="bottom-tab-bar__more-list">
              {moreItems.map(({ label, to, icon: Icon, badge }) => (
                <li key={to}>
                  <NavLink to={to} role="menuitem" onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? "is-active" : "")}>
                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                    <span>{label}</span>
                    {badge && badge(trackedJobs) > 0 && <span className="bottom-tab-bar__badge">{badge(trackedJobs)}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>

            {isAdmin && (
              <>
                <div className="bottom-tab-bar__more-kicker">Leadership</div>
                <ul className="bottom-tab-bar__more-list">
                  {LEADERSHIP_ITEMS.map(({ label, to, icon: Icon }) => (
                    <li key={to}>
                      <NavLink to={to} role="menuitem" onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? "is-active" : "")}>
                        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                        <span>{label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
