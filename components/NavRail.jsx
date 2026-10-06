import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { clubStats } from "../data/mockUser.js";
import { LEADERSHIP_SECTIONS, mainSectionsFor } from "../data/navItems.js";
import { useAppState } from "../data/store.jsx";

// Lucide, stroke-width 1.5, per CLAUDE.md's icon spec ("wireframes use text
// labels as stand-ins; target system is Lucide"). Only actually needed once
// the rail collapses to icon-only below 1100px (see styles/shell.css) --
// full-width rail still shows the label text right next to the icon, same
// as before, so this isn't a visual change at desktop widths. Item lists
// moved to data/navItems.js so components/BottomTabBar.jsx (the phone-UX
// pass's bottom tab bar) can share the exact same destinations/icons/
// badges instead of a second hand-maintained copy.

function RailLink({ label, to, icon: Icon, badge }) {
  // NavLink's default (non-"end") matching is a path-prefix match -- fine
  // for every item here except "/admin" itself, which is a real prefix of
  // every other Leadership route (/admin/opportunities, /admin/members,
  // etc.), so without "end" it stayed highlighted on every one of them
  // even when you weren't actually on the dashboard.
  return (
    <li data-tour-nav={to}>
      <NavLink
        to={to}
        end={to === "/"}
        className={({ isActive }) => `rail__link${isActive ? " is-active" : ""}`}
        title={label}
      >
        <Icon className="rail__icon" size={18} strokeWidth={1.5} aria-hidden="true" />
        <span className="rail__label">{label}</span>
        {badge && badge() > 0 && <span className="rail__badge">{badge()}</span>}
      </NavLink>
    </li>
  );
}

const COLLAPSED_KEY = "uc-portal-leadership-collapsed";

function readCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

// A rail of grouped links. Each group collapses on its own and the choice is remembered, so the rail stays as short as the work
// in front of you. Going to a page inside a collapsed group opens it. Used for both the everyday links and the Leadership menu.
function GroupedLinks({ sections, badgeFor }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {
      // storage unavailable: the menu still works, it just won't remember
    }
  }, [collapsed]);

  useEffect(() => {
    const owner = sections.find((g) => g.items.some((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to))));
    if (!owner) return;
    setCollapsed((prev) => {
      if (!prev.has(owner.section)) return prev;
      const next = new Set(prev);
      next.delete(owner.section);
      return next;
    });
    // only when the page changes: depending on `sections` would reopen a group the moment someone folds the one they are on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function toggle(section) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  return (
    <>
      {sections.map((group) => {
        const isCollapsed = collapsed.has(group.section);
        return (
          <div className="rail__group" key={group.section}>
            <button type="button" className="rail__kicker rail__kicker--toggle" onClick={() => toggle(group.section)} aria-expanded={!isCollapsed}>
              <ChevronDown size={12} strokeWidth={1.5} className={`rail__chevron${isCollapsed ? " is-collapsed" : ""}`} aria-hidden="true" />
              {group.section}
            </button>
            {/* Folded with CSS rather than left out, so the icon-only rail (no headings to unfold from) still shows every link. */}
            <ul className={`rail__items${isCollapsed ? " is-folded" : ""}`}>
              {group.items.map((item) => (
                <RailLink key={item.to} {...item} badge={badgeFor?.(item)} />
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

export default function NavRail() {
  // Real profiles.role, not the disconnected mock data/mockUser.js#
  // currentUser.role every session used to see the exact same hardcoded
  // "member" for regardless of who was actually signed in.
  const { isAdmin, isAlumni, isIntern, trackedJobs } = useAppState();
  const sections = mainSectionsFor({ isIntern, isAlumni, isAdmin });
  const badgeFor = (item) => (item.badge ? () => item.badge(trackedJobs) : undefined);

  return (
    <nav className="rail">
      <GroupedLinks sections={sections} badgeFor={badgeFor} />

      {isAdmin && (
        <div className="rail__section">
          <GroupedLinks sections={LEADERSHIP_SECTIONS} />
        </div>
      )}

      <div className="rail__spacer" />

      <div className="rail__stats">
        {clubStats.members} members · {clubStats.alumni} alumni
      </div>
    </nav>
  );
}
