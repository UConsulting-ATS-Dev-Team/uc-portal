import { NavLink } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { clubStats } from "../data/mockUser.js";
import { LEADERSHIP_SECTIONS, mainHomeItemFor, mainSectionsFor } from "../data/navItems.js";
import { useAppState } from "../data/store.jsx";
import { useCollapsedGroups } from "./useCollapsedGroups.js";

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

// Each menu keeps its own remembered folds, so the two never overwrite each other. (The Leadership key keeps its original name.)
const MAIN_KEY = "uc-portal-nav-collapsed";
const LEADERSHIP_KEY = "uc-portal-leadership-collapsed";

// A rail of grouped links. Each group collapses on its own and the choice is remembered, so the rail stays as short as the work
// in front of you. Used for both the everyday links and the Leadership menu.
function GroupedLinks({ sections, badgeFor, storageKey }) {
  const { collapsed, toggle } = useCollapsedGroups(sections, storageKey);

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
  const home = mainHomeItemFor({ isIntern, isAlumni, isAdmin });
  const sections = mainSectionsFor({ isIntern, isAlumni, isAdmin });
  const badgeFor = (item) => (item.badge ? () => item.badge(trackedJobs) : undefined);

  return (
    <nav className="rail">
      {home && (
        <ul className="rail__items rail__home">
          <RailLink {...home} />
        </ul>
      )}
      <GroupedLinks sections={sections} badgeFor={badgeFor} storageKey={MAIN_KEY} />

      {isAdmin && (
        <div className="rail__section">
          <GroupedLinks sections={LEADERSHIP_SECTIONS} storageKey={LEADERSHIP_KEY} />
        </div>
      )}

      <div className="rail__spacer" />

      <div className="rail__stats">
        {clubStats.members} members · {clubStats.alumni} alumni
      </div>
    </nav>
  );
}
