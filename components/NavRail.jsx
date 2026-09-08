import { NavLink } from "react-router-dom";
import {
  Home,
  Briefcase,
  ClipboardList,
  Users,
  Rss,
  Building2,
  GraduationCap,
  CircleUserRound,
  LayoutDashboard,
  Database,
  UserCog,
  FileText,
} from "lucide-react";
import { currentUser, navCounts, clubStats } from "../data/mockUser.js";

// Lucide, stroke-width 1.5, per CLAUDE.md's icon spec ("wireframes use text
// labels as stand-ins; target system is Lucide"). Only actually needed once
// the rail collapses to icon-only below 1100px (see styles/shell.css) --
// full-width rail still shows the label text right next to the icon, same
// as before, so this isn't a visual change at desktop widths.
const MAIN_ITEMS = [
  { label: "Home", to: "/", icon: Home },
  { label: "Jobs", to: "/jobs", icon: Briefcase },
  { label: "Applications", to: "/applications", icon: ClipboardList, badge: () => navCounts.applications },
  { label: "Network", to: "/network", icon: Users },
  { label: "Feed", to: "/feed", icon: Rss },
  { label: "Companies", to: "/companies", icon: Building2 },
  { label: "Career Resources", to: "/resources", icon: GraduationCap },
  { label: "My Profile", to: "/profile", icon: CircleUserRound },
];

const LEADERSHIP_ITEMS = [
  { label: "Admin Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Job sources", to: "/admin/opportunities", icon: Database },
  { label: "Members", to: "/admin/members", icon: UserCog },
  { label: "Content", to: "/admin/content", icon: FileText },
];

const LEADERSHIP_ROLES = ["exec", "careers-committee"];

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
