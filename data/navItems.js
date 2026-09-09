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
import { navCounts } from "./mockUser.js";

// Extracted out of components/NavRail.jsx so components/BottomTabBar.jsx
// (the phone-width nav pattern) can reuse the exact same destinations/
// icons/badges rather than a second hand-maintained copy that could drift.
export const MAIN_ITEMS = [
  { label: "Home", to: "/", icon: Home },
  { label: "Jobs", to: "/jobs", icon: Briefcase },
  { label: "Applications", to: "/applications", icon: ClipboardList, badge: () => navCounts.applications },
  { label: "Network", to: "/network", icon: Users },
  { label: "Feed", to: "/feed", icon: Rss },
  { label: "Companies", to: "/companies", icon: Building2 },
  { label: "Career Resources", to: "/resources", icon: GraduationCap },
  { label: "My Profile", to: "/profile", icon: CircleUserRound },
];

export const LEADERSHIP_ITEMS = [
  { label: "Admin Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Job sources", to: "/admin/opportunities", icon: Database },
  { label: "Members", to: "/admin/members", icon: UserCog },
  { label: "Content", to: "/admin/content", icon: FileText },
];

export const LEADERSHIP_ROLES = ["exec", "careers-committee"];

// The 4 highest-priority destinations for the phone-width bottom tab bar
// (native mobile convention: ~4 primary slots + one "More"), rather than
// squeezing all 8 MAIN_ITEMS into a cramped bar. Picked per CLAUDE.md's
// own stated priorities -- Jobs is explicitly named the single highest-
// priority screen, Applications is the other P1 core loop, Network is
// the next-most-central recurring destination. Everything else (Feed,
// Companies, Career Resources, My Profile, and Leadership when
// applicable) lives behind "More".
export const BOTTOM_BAR_PRIMARY_KEYS = ["/", "/jobs", "/applications", "/network"];
