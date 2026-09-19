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
  Rocket,
} from "lucide-react";

// Extracted out of components/NavRail.jsx so components/BottomTabBar.jsx
// (the phone-width nav pattern) can reuse the exact same destinations/
// icons/badges rather than a second hand-maintained copy that could drift.
//
// Applications' badge used to be the hardcoded mock data/mockUser.js
// navCounts.applications (always "5", regardless of who was actually
// signed in or how many applications they'd really tracked) -- takes the
// real trackedJobs object now instead, same "active, not Closed" count
// Home.jsx's own stat strip already uses.
// currentMemberOnly items are about active job-searching (Home's own
// recruiting dashboard included -- see pages/Home.jsx) -- hidden from the
// nav, and route-guarded (components/RequireCurrentMember.jsx), for real
// alumni accounts, which get a Feed/Network-focused experience instead
// (direct product decision, see CLAUDE.md's dated "Real alumni accounts"
// entry). Home isn't even alumni's landing route -- RequireCurrentMember
// redirects "/" itself to "/feed" for them, so Feed effectively becomes
// the alumni Home.
export const MAIN_ITEMS = [
  { label: "Home", to: "/", icon: Home, currentMemberOnly: true },
  { label: "Jobs", to: "/jobs", icon: Briefcase, currentMemberOnly: true },
  {
    label: "Applications",
    to: "/applications",
    icon: ClipboardList,
    badge: (trackedJobs) => Object.values(trackedJobs ?? {}).filter((info) => info.stage !== "Closed").length,
    currentMemberOnly: true,
  },
  { label: "Network", to: "/network", icon: Users },
  { label: "Feed", to: "/feed", icon: Rss },
  { label: "Companies", to: "/companies", icon: Building2 },
  { label: "Career Resources", to: "/resources", icon: GraduationCap, currentMemberOnly: true },
  { label: "Accelerator", to: "/accelerator", icon: Rocket },
  { label: "My Profile", to: "/profile", icon: CircleUserRound },
];

// A signed-in account with member_status = 'intern' sees only this --
// essentially just the accelerator program, per direct ask ("essentially
// only has this education function until they finish"). Route-guarded
// too (components/RequireNotIntern.jsx), not just hidden from nav -- same
// "guard the route, don't just hide the link" principle
// RequireCurrentMember.jsx already established for alumni.
export const INTERN_ITEMS = [
  { label: "Accelerator", to: "/accelerator", icon: Rocket },
  { label: "My Profile", to: "/profile", icon: CircleUserRound },
];

export const LEADERSHIP_ITEMS = [
  { label: "Admin Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Job sources", to: "/admin/opportunities", icon: Database },
  { label: "Members", to: "/admin/members", icon: UserCog },
  { label: "Content", to: "/admin/content", icon: FileText },
  { label: "Accelerator", to: "/admin/accelerator", icon: Rocket },
];

// The 4 highest-priority destinations for the phone-width bottom tab bar
// (native mobile convention: ~4 primary slots + one "More"), rather than
// squeezing all 8 MAIN_ITEMS into a cramped bar. Picked per CLAUDE.md's
// own stated priorities -- Jobs is explicitly named the single highest-
// priority screen, Applications is the other P1 core loop, Network is
// the next-most-central recurring destination. Everything else (Feed,
// Companies, Career Resources, My Profile, and Leadership when
// applicable) lives behind "More".
export const BOTTOM_BAR_PRIMARY_KEYS = ["/", "/jobs", "/applications", "/network"];
