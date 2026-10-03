// Static reference data for onboarding, profile preferences, and
// Jobs/Companies filtering. These are option lists only -- any member /
// alumni / open-role counts shown next to them come from real directory and
// job data (data/onboardingStats.js), not from this file.
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
  { name: "Management consulting" },
  { name: "Strategy consulting" },
  { name: "Technology consulting" },
  { name: "Human capital consulting" },

  // --- Finance ---
  { name: "Investment banking" },
  { name: "Private equity" },
  { name: "Venture capital" },
  { name: "Hedge funds / asset management" },
  { name: "Corporate finance / FP&A" },
  { name: "Commercial & retail banking" },
  { name: "Fintech" },
  { name: "Insurance & actuarial" },

  // --- Business & corporate ---
  { name: "Marketing & brand strategy" },
  { name: "Corporate strategy & business development" },
  { name: "Product management" },
  { name: "Operations & supply chain" },
  { name: "Sales & business development" },
  { name: "Human resources / people operations" },

  // --- Tech ---
  { name: "Tech / product strategy" },
  { name: "Data & analytics" },
  { name: "Software engineering" },
  { name: "Cybersecurity" },

  // --- Other consulting/finance/business-adjacent ---
  { name: "Consumer goods & retail" },
  { name: "Media & entertainment" },
  { name: "Energy & sustainability" },
  { name: "Healthcare" },
  { name: "Real estate" },
  { name: "Nonprofit / public sector" },

  // --- Added 2026-10-03: the list had 29 rows while the live board spans far more. Each one is
  // recognised from job titles by data/industryPatterns.js, so picking it actually changes the
  // member's matches. Consulting / advisory ---
  { name: "Economic consulting" },
  { name: "Healthcare consulting" },
  { name: "Financial advisory & restructuring" },
  { name: "Public sector consulting" },

  // --- Finance ---
  { name: "Quantitative trading" },
  { name: "Sales & trading" },
  { name: "Equity research" },
  { name: "Wealth management" },
  { name: "Credit & lending" },
  { name: "Accounting & audit" },
  { name: "Tax" },
  { name: "Risk & compliance" },
  { name: "Crypto & digital assets" },

  // --- Business & corporate ---
  { name: "Legal & regulatory" },
  { name: "Public relations & communications" },
  { name: "Customer success & account management" },
  { name: "Procurement & sourcing" },
  { name: "Entrepreneurship / startups" },
  { name: "Education & edtech" },
  { name: "Design & UX" },
  { name: "Program & project management" },
  { name: "Business operations & chief of staff" },

  // --- Tech ---
  { name: "AI & machine learning" },
  { name: "Cloud & infrastructure" },
  { name: "Hardware & semiconductors" },
  { name: "Robotics & automation" },
  { name: "Gaming" },

  // --- Other sectors ---
  { name: "Aerospace & defense" },
  { name: "Automotive & mobility" },
  { name: "Biotech & pharma" },
  { name: "Manufacturing & industrial" },
  { name: "Travel & hospitality" },
  { name: "Telecommunications" },
  { name: "Logistics & transportation" },
  { name: "Food & agriculture" },
  { name: "Fashion & luxury" },
  { name: "Government & policy" },
  { name: "Sports & fitness" },

  { name: "Still figuring it out" },
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

  // Added 2026-10-03. A role matches a job whose title contains it (case-insensitive), so every
  // entry reads like a real posting title.
  "Software Engineer",
  "Data Scientist",
  "Machine Learning Engineer",
  "Business Analyst",
  "Management Analyst",
  "Associate Consultant",
  "Financial Analyst",
  "Research Analyst",
  "Quantitative Analyst",
  "Risk Analyst",
  "Compliance Analyst",
  "Audit Associate",
  "Tax Associate",
  "Trader",
  "Product Analyst",
  "Product Designer",
  "UX Designer",
  "Project Manager",
  "Technical Program Manager",
  "Chief of Staff",
  "Business Operations",
  "Corporate Development",
  "Account Executive",
  "Account Manager",
  "Customer Success Manager",
  "Sales Development Representative",
  "Solutions Engineer",
  "Growth Marketing",
  "Brand Manager",
  "Communications Associate",
  "Policy Analyst",
  "Recruiter",
  "People Operations",
  "Supply Chain Analyst",
  "Procurement Analyst",
  "Paralegal",
];

// Cities and metros members can pick. A city matches a job open there; a metro ("San Francisco Bay
// Area") matches any of its member cities too (data/locationUtils.js holds the membership). Jobs
// carry every place their posting lists (jobs.locations, see server/src/taxonomy/locations.ts).
// Expanded 2026-10-03 from 20 cities to cover where the live board actually is.
export const LOCATIONS = [
  // --- Major US markets ---
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

  // --- Metros: the city plus the suburbs most employers actually list ---
  "San Francisco Bay Area",
  "New York Metro",
  "Greater Los Angeles",
  "Greater Boston",
  "Washington DC Area",
  "Seattle Area",
  "Dallas-Fort Worth",

  // --- More US cities ---
  "San Jose",
  "Oakland",
  "Palo Alto",
  "Cambridge",
  "Pittsburgh",
  "Raleigh",
  "Durham",
  "Columbus",
  "Cleveland",
  "Cincinnati",
  "Indianapolis",
  "Milwaukee",
  "Kansas City",
  "St. Louis",
  "Salt Lake City",
  "Las Vegas",
  "Tampa",
  "Orlando",
  "Baltimore",
  "Boulder",
  "Sacramento",
  "San Antonio",
  "Stamford",
  "Hartford",
  "Providence",
  "Princeton",
  "Honolulu",
  "New Orleans",
  "Louisville",
  "Ann Arbor",

  // --- Work mode ---
  "Remote",
  "Hybrid",

  // --- International ---
  "International",
  "London",
  "Toronto",
  "Vancouver",
  "Montreal",
  "Dublin",
  "Paris",
  "Berlin",
  "Munich",
  "Frankfurt",
  "Amsterdam",
  "Zurich",
  "Madrid",
  "Milan",
  "Stockholm",
  "Singapore",
  "Hong Kong",
  "Tokyo",
  "Seoul",
  "Shanghai",
  "Bengaluru",
  "Mumbai",
  "Delhi",
  "Sydney",
  "Tel Aviv",
  "Dubai",
  "Mexico City",
  "São Paulo",
  "Canada",
  "United Kingdom",
  "India",
];

// Part 10 / US-26 -- the first 28 entries are the exact vocabulary supabase/functions/_shared/
// pipeline/taxonomy/occupationTaxonomy.ts's skillsForOccupation() actually
// populates on real jobs (the rest, from "Tableau" on, are matched by data/skillInference.js) (required_skills), deduplicated across all 6
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

  // Added 2026-10-03. Each is inferred from a job's title by data/skillInference.js (a Data Analyst
  // role implies SQL, Tableau, ...), so a pick can actually match; a skill no title implies is not
  // listed, since it could never match anything.
  "Tableau",
  "Power BI",
  "R",
  "Java",
  "JavaScript",
  "TypeScript",
  "C++",
  "React",
  "Node.js",
  "AWS",
  "Docker & Kubernetes",
  "Machine Learning",
  "Statistics",
  "Data Visualization",
  "Data Modeling",
  "A/B Testing",
  "Valuation",
  "LBO Modeling",
  "Accounting",
  "Budgeting & Forecasting",
  "Due Diligence",
  "Risk Management",
  "Financial Reporting",
  "Salesforce",
  "CRM",
  "Prospecting & Lead Generation",
  "Negotiation",
  "Account Management",
  "SEO",
  "Google Analytics",
  "Content Strategy",
  "Social Media",
  "Brand Strategy",
  "Market Research",
  "Competitive Analysis",
  "Figma",
  "UX Research",
  "Product Roadmapping",
  "Agile / Scrum",
  "Jira",
  "Process Improvement",
  "Supply Chain Planning",
  "Vendor Management",
  "Contract Review",
  "Legal Research",
  "Regulatory Compliance",
  "Recruiting",
  "Public Speaking",
  "Business Writing",
  "Stakeholder Management",
];

export const COMPANIES = [
  { name: "Bain & Company" },
  { name: "McKinsey & Company" },
  { name: "Deloitte" },
  { name: "Stripe" },
  { name: "Goldman Sachs" },
  { name: "BCG" },
  { name: "EY-Parthenon" },
  { name: "Accenture" },
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
