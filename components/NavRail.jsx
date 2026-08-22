import { NavLink } from "react-router-dom";
import { currentUser, navCounts, clubStats } from "../data/mockUser.js";

const MAIN_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Jobs", to: "/jobs" },
  { label: "Applications", to: "/applications", badge: () => navCounts.applications },
  { label: "Network", to: "/network" },
  { label: "Feed", to: "/feed" },
  { label: "Companies", to: "/companies" },
  { label: "Career Resources", to: "/resources" },
  { label: "My Profile", to: "/profile" },
];

const LEADERSHIP_ITEMS = [
  { label: "Admin Dashboard", to: "/admin" },
  { label: "Job sources", to: "/admin/opportunities" },
  { label: "Members", to: "/admin/members" },
  { label: "Content", to: "/admin/content" },
];

const LEADERSHIP_ROLES = ["exec", "careers-committee"];

function RailLink({ label, to, badge }) {
  return (
    <li>
      <NavLink to={to} end={to === "/"} className={({ isActive }) => `rail__link${isActive ? " is-active" : ""}`}>
        <span>{label}</span>
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
        {clubStats.members} members · {clubStats.alumni} alumni · {clubStats.tagline}
      </div>
    </nav>
  );
}
