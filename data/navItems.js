import {
  Home,
  Briefcase,
  ClipboardList,
  Users,
  Rss,
  Building2,
  GraduationCap,
  CircleUserRound,
  Database,
  UserCog,
  FileText,
  Rocket,
  BookOpen,
  Mail,
  MailOpen,
  BarChart3,
  Wrench,
  ScrollText,
  FileSpreadsheet,
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
  // currentMemberOnly -- a real, pre-existing bug this flag itself didn't
  // cover until caught live via the admin "view as" simulation
  // (components/ViewAsMenu.jsx): Accelerator is the freshman onboarding
  // curriculum (see CLAUDE.md's nav shell spec, which never lists it as a
  // current-member destination at all), but had no currentMemberOnly tag,
  // so mainItemsFor's alumni branch (`!item.currentMemberOnly`) never
  // filtered it out -- a real alumni account saw it in their nav the
  // whole time. Tagging it only ever changes what alumni see; the plain
  // current-member fallback below doesn't filter on this flag at all, so
  // real current members and interns (via their own separate INTERN_ITEMS
  // list) are unaffected.
  { label: "Accelerator", to: "/accelerator", icon: Rocket, currentMemberOnly: true },
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

// Shared by NavRail.jsx and BottomTabBar.jsx so the "which main items does
// this account see" logic lives in exactly one place. Admins drop the main
// section's student-facing Accelerator entry (/accelerator) -- they
// already get the real admin-facing one in LEADERSHIP_ITEMS
// (/admin/accelerator), and showing both looked like two different,
// confusing "Accelerator" tabs pointing at two different pages.
export function mainItemsFor({ isIntern, isAlumni, isAdmin }) {
  if (isIntern) return INTERN_ITEMS;
  if (isAlumni) return MAIN_ITEMS.filter((item) => !item.currentMemberOnly);
  if (isAdmin) return MAIN_ITEMS.filter((item) => item.to !== "/accelerator");
  return MAIN_ITEMS;
}

// The main rail is grouped the same way the Leadership menu is, so every heading folds away the same. Each item belongs to
// the group named here; a group with nothing left for this account (e.g. Recruiting for an alumnus) is dropped.
const MAIN_GROUP_ORDER = ["Recruiting", "Community", "Learning", "Account"];
const MAIN_GROUP_OF = {
  "/jobs": "Recruiting",
  "/applications": "Recruiting",
  "/network": "Community",
  "/feed": "Community",
  "/companies": "Community",
  "/resources": "Learning",
  "/accelerator": "Learning",
  "/profile": "Account",
};

// Home stands on its own above the groups, since it is the landing page rather than part of any one of them. (Alumni and interns
// have no Home, so this is undefined for them.)
export function mainHomeItemFor(account) {
  return mainItemsFor(account).find((item) => item.to === "/");
}

export function mainSectionsFor(account) {
  const items = mainItemsFor(account).filter((item) => item.to !== "/");
  return MAIN_GROUP_ORDER.map((section) => ({ section, items: items.filter((item) => MAIN_GROUP_OF[item.to] === section) })).filter(
    (group) => group.items.length > 0
  );
}

// There is no separate admin home: an admin lands on the same Home as everyone else, and these are extra pages only
// admins see. Grouped by what a person is trying to do, with the technical upkeep of the site last and apart.
export const LEADERSHIP_SECTIONS = [
  {
    section: "People",
    items: [
      { label: "User Management", to: "/admin/members", icon: UserCog },
      { label: "Audit Log", to: "/admin/audit-log", icon: ScrollText },
    ],
  },
  {
    section: "Content",
    items: [
      { label: "Content", to: "/admin/content", icon: FileText },
      { label: "Library", to: "/admin/library", icon: BookOpen },
      { label: "Accelerator", to: "/admin/accelerator", icon: Rocket },
    ],
  },
  {
    section: "Communications",
    items: [
      { label: "Master Communications", to: "/admin/communications", icon: Mail },
      { label: "Automatic Emails", to: "/admin/automatic-emails", icon: MailOpen },
    ],
  },
  {
    section: "Insights",
    items: [
      { label: "Site Analytics", to: "/admin/analytics", icon: BarChart3 },
      { label: "Reports", to: "/admin/reports", icon: FileSpreadsheet },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Job Sources", to: "/admin/opportunities", icon: Database },
      { label: "Pipeline and Queues", to: "/admin/system", icon: Wrench },
    ],
  },
];

export const LEADERSHIP_ITEMS = LEADERSHIP_SECTIONS.flatMap((group) => group.items);

// The 4 highest-priority destinations for the phone-width bottom tab bar
// (native mobile convention: ~4 primary slots + one "More"), rather than
// squeezing all 8 MAIN_ITEMS into a cramped bar. Picked per CLAUDE.md's
// own stated priorities -- Jobs is explicitly named the single highest-
// priority screen, Applications is the other P1 core loop, Network is
// the next-most-central recurring destination. Everything else (Feed,
// Companies, Career Resources, My Profile, and Leadership when
// applicable) lives behind "More".
export const BOTTOM_BAR_PRIMARY_KEYS = ["/", "/jobs", "/applications", "/network"];
