// Static reference data for onboarding, profile preferences, and (later)
// Jobs/Companies filtering. `alumni` is illustrative mock data (nobody's
// hand-counted alumni by industry). `members` is rescaled to stay
// realistic against the club's real, exact headcount (52, see
// data/mockUser.js's clubStats) -- a member ranks up to 3 industries in
// onboarding/preferences, so no single industry's count can exceed 52,
// and the total across every industry can't meaningfully exceed roughly
// 3x that (156) either.
//
// Expanded twice, Sept 2026: first to 13 (Strategy consulting, Venture
// capital, Data & analytics, Operations & supply chain), then to this
// full 29-row list per direct request for at least 25 options, all
// within consulting/finance/business/tech "and other similar" fields --
// UC members recruit across a wider spread of specific tracks than the
// original 8-9 broad buckets captured (e.g. "hedge funds" and "private
// equity" are genuinely different processes; so are "product management"
// and "tech / product strategy"). Grouped below by rough category for
// readability; the app doesn't render these as sub-grouped, just a flat
// chip list.
//
// Only 5 of these 29 are ever actually applied to a real ingested job by
// server/src/taxonomy/occupationTaxonomy.ts today: Management consulting,
// Investment banking, Private equity, Tech / product strategy, and
// Marketing & brand strategy (Strategy consulting rides along via the
// synonym below). Every other row -- old and new alike -- is a real,
// selectable preference with no real-job coverage yet, same already-
// accepted gap the original Nonprofit/Healthcare/Real estate rows always
// had; added anyway per direct instruction ("even if they don't tag into
// anything yet"), not a mistake. Extending occupationTaxonomy.ts to
// actually classify jobs into more of these is real, separate follow-up
// work (touches the live ingestion pipeline and its tests), not done
// here.
export const INDUSTRIES = [
  // --- Consulting ---
  { name: "Management consulting", members: 24, alumni: 61 },
  { name: "Strategy consulting", members: 8, alumni: 25 },
  { name: "Technology consulting", members: 3, alumni: 6 },
  { name: "Human capital consulting", members: 2, alumni: 4 },

  // --- Finance ---
  { name: "Investment banking", members: 20, alumni: 48 },
  { name: "Private equity", members: 10, alumni: 19 },
  { name: "Venture capital", members: 5, alumni: 8 },
  { name: "Hedge funds / asset management", members: 3, alumni: 9 },
  { name: "Corporate finance / FP&A", members: 3, alumni: 5 },
  { name: "Commercial & retail banking", members: 3, alumni: 6 },
  { name: "Fintech", members: 3, alumni: 7 },
  { name: "Insurance & actuarial", members: 1, alumni: 3 },

  // --- Business & corporate ---
  { name: "Marketing & brand strategy", members: 7, alumni: 14 },
  { name: "Corporate strategy & business development", members: 4, alumni: 6 },
  { name: "Product management", members: 5, alumni: 9 },
  { name: "Operations & supply chain", members: 3, alumni: 5 },
  { name: "Sales & business development", members: 3, alumni: 5 },
  { name: "Human resources / people operations", members: 2, alumni: 3 },

  // --- Tech ---
  { name: "Tech / product strategy", members: 12, alumni: 22 },
  { name: "Data & analytics", members: 6, alumni: 10 },
  { name: "Software engineering", members: 4, alumni: 8 },
  { name: "Cybersecurity", members: 2, alumni: 4 },

  // --- Other consulting/finance/business-adjacent ---
  { name: "Consumer goods & retail", members: 3, alumni: 7 },
  { name: "Media & entertainment", members: 2, alumni: 5 },
  { name: "Energy & sustainability", members: 2, alumni: 4 },
  { name: "Healthcare", members: 4, alumni: 8 },
  { name: "Real estate", members: 3, alumni: 6 },
  { name: "Nonprofit / public sector", members: 3, alumni: 9 },

  { name: "Still figuring it out", members: 0, alumni: 0 },
];

// "Strategy consulting" and "Management consulting" are the same
// real-world work, just named differently depending who you ask (the
// reason it was added in the first place) -- real ingested jobs
// (server/src/taxonomy/occupationTaxonomy.ts) only ever tag
// "Management consulting", so without this a member who prefers
// "Strategy consulting" would see zero real-job matches, which defeats
// the point of adding it. Every industry-equality check against real job
// data (data/jobMatch.js's industry match factor, and any future one)
// should compare canonicalIndustry() output, not raw strings, so a
// preference and a job tag that mean the same thing always match --
// "some roles genuinely do apply to multiple industry filters" in
// practice, without needing every job double-tagged by hand.
const INDUSTRY_SYNONYMS = {
  "Strategy consulting": "Management consulting",
};

export function canonicalIndustry(name) {
  return INDUSTRY_SYNONYMS[name] ?? name;
}

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
