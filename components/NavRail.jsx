import { NavLink } from "react-router-dom";
import { currentUser, clubStats } from "../data/mockUser.js";
import { MAIN_ITEMS, LEADERSHIP_ITEMS, LEADERSHIP_ROLES } from "../data/navItems.js";

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
        {badge && <span className="rail__badge">{badge()}</span>}
      </NavLink>
    </li>
  );
}

export default function NavRail() {
  const isLeadership = LEADERSHIP_ROLES.includes(currentUser.role);

  return (
    <nav className="rail">
      <ul className="rail__items">
        {MAIN_ITEMS.map((item) => (
          <RailLink key={item.to} {...item} />
        ))}
      </ul>

      {isLeadership && (
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
