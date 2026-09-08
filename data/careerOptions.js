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

export const LOCATIONS = [
  "New York",
  "Chicago",
  "Los Angeles",
  "San Francisco",
  "Boston",
  "Washington DC",
  "Seattle",
  "Austin",
  "Dallas",
  "Houston",
  "Atlanta",
  "Miami",
  "Denver",
  "Philadelphia",
  "San Diego",
  "Charlotte",
  "Minneapolis",
  "Phoenix",
  "Nashville",
  "Detroit",
  "Remote",
  "Hybrid",
  "International",
];

// Part 10 / US-26 -- the exact vocabulary supabase/functions/_shared/
// pipeline/taxonomy/occupationTaxonomy.ts's skillsForOccupation() actually
// populates on real jobs (required_skills), deduplicated across all 6
// occupation buckets there. Deliberately a closed list matching that
// taxonomy, not free text -- data/jobMatch.js's skill matching (like
// server/src/match.ts's) is an exact case-insensitive string match, so a
// member typing "excel" instead of "Microsoft Excel" would never match
// anything. If the taxonomy above ever grows, this list needs the same
// additions to stay matchable.
//
// The last 6 entries (Administration and Management through Engineering
// and Technology) were added for Part 7 Stage 5's preferred_skills fix --
// occupationTaxonomy.ts's `knowledge` field, mapped onto preferred_skills
// via the taxonomy's new preferredSkillsForOccupation(). Same closed-list
// reasoning applies: populating preferred_skills with terms outside this
// list would mean a member could never actually select them, so
// preferred_skills would stay functionally unmatchable regardless of what
// the database holds.
export const SKILLS = [
  "Critical Thinking",
  "Complex Problem Solving",
  "Active Listening",
  "Judgment and Decision Making",
  "Mathematics",
  "Coordination",
  "Systems Analysis",
  "Systems Evaluation",
  "Persuasion",
  "Social Perceptiveness",
  "Programming",
  "Microsoft Excel",
  "Microsoft PowerPoint",
  "SQL",
  "Bloomberg Terminal",
  "Financial Modeling Software",
  "Project Management Software",
  "Python",
  "Git",
  "Adobe Creative Suite",
  "Marketing Analytics Platforms",
  "Statistical Analysis Software",
  "Administration and Management",
  "Economics and Accounting",
  "Sales and Marketing",
  "Communications and Media",
  "Computers and Electronics",
  "Engineering and Technology",
];

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
