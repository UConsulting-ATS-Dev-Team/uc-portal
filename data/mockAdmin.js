import { INDUSTRIES } from "./careerOptions.js";

// Admin Dashboard (2h) aggregate data. Unlike Jobs/Companies/Network,
// these numbers describe club-wide analytics no single browser session
// could actually compute (survey responses across ~142 members) -- so
// unlike elsewhere in this app, they're illustrative mock figures rather
// than derived from browsable records. Where we *can* derive something
// real (the industry-interest gap below), we do.
export const KPIS = {
  activeMembers: 142,
  activeMembersChange: 16,
  profilesUpToDatePct: 88,
  staleProfiles: 17,
  applicationsTracked: 614,
  applicationsPerMember: 4.3,
  coffeeChatsBooked: 73,
  coffeeChatsChange: 31,
  offersReported: 29,
  offersInternship: 21,
  offersFullTime: 8,
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

export const CLASS_YEAR_BREAKDOWN = [
  { year: 2029, members: 38, label: "onboarding", profileCompletePct: 62 },
  { year: 2028, members: 41, label: "peak recruiting", profileCompletePct: 79 },
  { year: 2027, members: 35, label: "peak recruiting", profileCompletePct: 91 },
  { year: 2026, members: 28, label: "full-time", profileCompletePct: 95 },
];

export const MOST_TARGETED_COMPANIES = [
  { company: "Bain & Company", members: 34 },
  { company: "McKinsey & Company", members: 29 },
  { company: "Goldman Sachs", members: 22 },
  { company: "Deloitte", members: 19 },
  { company: "BCG", members: 17 },
];

export const MEMBER_ENGAGEMENT = {
  loggedInThisWeek: 98,
  trackingAtLeastOne: 87,
  bookedCoffeeChat: 41,
  contributedResource: 12,
  neverOpened: 9,
};

export const ACCESS_CONTROL = {
  provisioned: "Roster-provisioned",
  autoConversion: "Auto-converts to alumni at commencement",
  pendingRemovals: 3,
};

export const FLAGGED_FEED_POSTS = 2;
