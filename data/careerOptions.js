// Static reference data for onboarding, profile preferences, and (later)
// Jobs/Companies filtering. Counts are illustrative mock data.
export const INDUSTRIES = [
  { name: "Management consulting", members: 101, alumni: 61 },
  { name: "Investment banking", members: 74, alumni: 48 },
  { name: "Tech / product strategy", members: 54, alumni: 22 },
  { name: "Private equity", members: 38, alumni: 19 },
  { name: "Marketing & brand strategy", members: 26, alumni: 14 },
  { name: "Nonprofit / public sector", members: 18, alumni: 9 },
  { name: "Healthcare", members: 15, alumni: 8 },
  { name: "Real estate", members: 11, alumni: 6 },
  { name: "Still figuring it out", members: 0, alumni: 0 },
];

export const ROLES = [
  "Consultant",
  "Investment Banking Analyst",
  "Product Manager",
  "Strategy Associate",
  "Data Analyst",
  "Private Equity Analyst",
  "Marketing Associate",
  "Operations Associate",
  "Business Development",
  "Program Manager",
];

export const LOCATIONS = ["Chicago", "New York", "Los Angeles", "San Francisco", "Remote", "Hybrid"];

export const COMPANIES = [
  { name: "Bain & Company", alumni: 22, openRoles: 6 },
  { name: "McKinsey & Company", alumni: 19, openRoles: 5 },
  { name: "Deloitte", alumni: 17, openRoles: 9 },
  { name: "Stripe", alumni: 6, openRoles: 3 },
  { name: "Goldman Sachs", alumni: 11, openRoles: 4 },
  { name: "BCG", alumni: 14, openRoles: 4 },
  { name: "EY-Parthenon", alumni: 9, openRoles: 5 },
  { name: "Accenture", alumni: 8, openRoles: 7 },
];

export const RECRUITING_CYCLES = [
  "Summer 2027 internships",
  "Fall 2026 full-time",
  "Off-cycle / rolling",
  "Not actively recruiting",
];

export const HELP_OPTIONS = [
  "Case practice",
  "Resume review",
  "Behavioral prep",
  "Technical skills & certifications",
  "Alumni intros",
  "Deciding between industries",
];

// Rough mock "how many roles/alumni match" heuristic for the onboarding
// live-payoff card. Not real matching logic -- just something that visibly
// responds to selections for the prototype.
export function computeMatches({ industries = [], roles = [], locations = [] }) {
  const matchedRoles = 8 + industries.length * 9 + roles.length * 5 + locations.length * 4;
  const matchedAlumni = Math.round(matchedRoles * 0.5);
  return { roles: matchedRoles, alumni: matchedAlumni };
}
