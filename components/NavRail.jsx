import { NavLink } from "react-router-dom";
import { clubStats } from "../data/mockUser.js";
import { MAIN_ITEMS, LEADERSHIP_ITEMS } from "../data/navItems.js";
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
  return (
    <li>
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

export default function NavRail() {
  // Real profiles.role, not the disconnected mock data/mockUser.js#
  // currentUser.role every session used to see the exact same hardcoded
  // "member" for regardless of who was actually signed in.
  const { isAdmin, trackedJobs } = useAppState();

  return (
    <nav className="rail">
      <ul className="rail__items">
        {MAIN_ITEMS.map((item) => (
          <RailLink key={item.to} {...item} badge={item.badge ? () => item.badge(trackedJobs) : undefined} />
        ))}
      </ul>

      {isAdmin && (
        <div className="rail__section">
          <div className="rail__kicker">Leadership</div>
          <ul className="rail__items">
            {LEADERSHIP_ITEMS.map((item) => (
              <RailLink key={item.to} {...item} />
            ))}
          </ul>
        </div>
      )}

      <div className="rail__spacer" />

      <div className="rail__stats">
        {clubStats.members} members · {clubStats.alumni} alumni
      </div>
    </nav>
  );
}
