import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, MoreHorizontal, X } from "lucide-react";
import { LEADERSHIP_SECTIONS, BOTTOM_BAR_PRIMARY_KEYS, mainItemsFor, mainSectionsFor } from "../data/navItems.js";
import { useAppState } from "../data/store.jsx";
import { useCollapsedGroups } from "./useCollapsedGroups.js";

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
  const { isAdmin, isAlumni, isIntern, trackedJobs } = useAppState();

  const availableItems = mainItemsFor({ isIntern, isAlumni, isAdmin });
  // BOTTOM_BAR_PRIMARY_KEYS was picked around current-member priorities
  // (Jobs/Applications are two of its four slots) -- meaningless for
  // alumni/interns, who don't have those routes at all. Alumni's whole
  // available set (Network, Feed, Companies, My Profile) happens to be
  // exactly 4, and an intern's (Accelerator, My Profile) is only 2 -- both
  // fit directly as primary tabs with no "More" overflow needed.
  const noOverflow = isAlumni || isIntern;
  const primaryItems = noOverflow ? availableItems : availableItems.filter((item) => BOTTOM_BAR_PRIMARY_KEYS.includes(item.to));
  // Everything that isn't a tab, under the same group headings (and the same fold-away behavior) as the desktop rail.
  const moreSections = noOverflow
    ? []
    : mainSectionsFor({ isIntern, isAlumni, isAdmin })
        .map((group) => ({ ...group, items: group.items.filter((item) => !BOTTOM_BAR_PRIMARY_KEYS.includes(item.to)) }))
        .filter((group) => group.items.length > 0);
  const sheetSections = isAdmin ? [...moreSections, ...LEADERSHIP_SECTIONS] : moreSections;
  const { collapsed, toggle } = useCollapsedGroups(sheetSections, "uc-portal-sheet-collapsed");
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
            {sheetSections.map((group) => {
              const isCollapsed = collapsed.has(group.section);
              return (
                <div key={group.section}>
                  <button type="button" className="bottom-tab-bar__more-kicker bottom-tab-bar__more-kicker--toggle" onClick={() => toggle(group.section)} aria-expanded={!isCollapsed}>
                    <ChevronDown size={12} strokeWidth={1.5} className={`rail__chevron${isCollapsed ? " is-collapsed" : ""}`} aria-hidden="true" />
                    {group.section}
                  </button>
                  {!isCollapsed && (
                    <ul className="bottom-tab-bar__more-list">
                      {group.items.map(({ label, to, icon: Icon, badge }) => (
                        <li key={to}>
                          <NavLink to={to} end={to === "/"} role="menuitem" onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? "is-active" : "")}>
                            <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                            <span>{label}</span>
                            {badge && badge(trackedJobs) > 0 && <span className="bottom-tab-bar__badge">{badge(trackedJobs)}</span>}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
