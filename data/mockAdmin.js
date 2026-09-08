import { INDUSTRIES } from "./careerOptions.js";

// Admin Dashboard (2h) aggregate data. Unlike Jobs/Companies/Network,
// most of these numbers describe club-wide analytics no single browser
// session could actually compute -- so unlike elsewhere in this app,
// they're illustrative mock figures rather than derived from browsable
// records. Where we *can* derive something real (the industry-interest
// gap below), we do. activeMembers is the one exception: 52 is a real,
// exact count (hand-counted from the club directory Google Sheet, Sept
// 2026 -- same figure data/mockUser.js's clubStats uses), not illustrative.
// Every other figure here is rescaled proportionally from the old
// (fictional, wireframe-placeholder) 142-member baseline to stay
// internally consistent with the real headcount, e.g.
// applicationsPerMember still equals applicationsTracked / activeMembers.
export const KPIS = {
  activeMembers: 52,
  activeMembersChange: 6,
  profilesUpToDatePct: 88,
  staleProfiles: 6,
  applicationsTracked: 225,
  applicationsPerMember: 4.3,
  coffeeChatsBooked: 27,
  coffeeChatsChange: 11,
  offersReported: 11,
  offersInternship: 8,
  offersFullTime: 3,
};

// Reuses the same member/alumni counts onboarding shows per industry, so
// this chart can't drift out of sync with what members see when picking
// industries.
export const INDUSTRY_INTEREST = INDUSTRIES.filter((i) => i.name !== "Still figuring it out")
  .map((i) => ({ industry: i.name, members: i.members, alumni: i.alumni }))
  .sort((a, b) => b.members - a.members);

export function biggestGap() {
  return INDUSTRY_INTEREST.reduce((worst, i) => {
    const ratio = i.alumni > 0 ? i.members / i.alumni : Infinity;
    const worstRatio = worst.alumni > 0 ? worst.members / worst.alumni : Infinity;
    return ratio > worstRatio ? i : worst;
  });
}

// Only 3 active class years right now, not 4 -- the class of 2026 just
// graduated (they're alumni now, no longer in this breakdown) and the
// incoming freshman class hasn't been recruited/onboarded yet. Sums to
// the real 52-member headcount above.
export const CLASS_YEAR_BREAKDOWN = [
  { year: 2029, members: 20, label: "onboarding", profileCompletePct: 62 },
  { year: 2028, members: 18, label: "peak recruiting", profileCompletePct: 79 },
  { year: 2027, members: 14, label: "full-time", profileCompletePct: 91 },
];

export const MOST_TARGETED_COMPANIES = [
  { company: "Bain & Company", members: 12 },
  { company: "McKinsey & Company", members: 11 },
  { company: "Goldman Sachs", members: 8 },
  { company: "Deloitte", members: 7 },
  { company: "BCG", members: 6 },
];

// NOTE: MEMBER_ENGAGEMENT (a mock figure set) used to be exported here but
// was removed -- pages/AdminDashboard.jsx's "Member engagement" section
// reads real data now (member_engagement_report(), a security-definer
// RPC), see that page's own comment and JOB_ENGINE_ARCHITECTURE.md's
// dated entry for the real-feature build. Left no dead export behind.

export const ACCESS_CONTROL = {
  provisioned: "Roster-provisioned",
  autoConversion: "Auto-converts to alumni at commencement",
  pendingRemovals: 3,
};

export const FLAGGED_FEED_POSTS = 2;
