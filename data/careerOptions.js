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
// Grouped so a long dropdown is easy to scan. Every name is recognised from job titles by data/industryPatterns.js
// (a test fails if one is not), so picking one really changes a member's matches. Industries a business student at a
// top university tends to recruit into, consulting and finance first.
export const INDUSTRY_GROUPS = [
  {
    label: "Consulting & advisory",
    names: [
      "Management consulting", "Strategy consulting", "Technology consulting", "Human capital consulting", "Economic consulting",
      "Healthcare consulting", "Financial advisory & restructuring", "Public sector consulting", "Operations consulting",
      "ESG & sustainability consulting",
    ],
  },
  {
    label: "Finance & investing",
    names: [
      "Investment banking", "Private equity", "Venture capital", "Growth equity", "Hedge funds / asset management", "Private credit",
      "Leveraged finance", "Capital markets", "Sales & trading", "Fixed income & currencies (FICC)", "Commodities trading",
      "Quantitative trading", "Equity research", "Structured finance & securitization", "Real estate investing", "Infrastructure investing",
      "Wealth management", "Family office & trust", "Corporate finance / FP&A", "Strategic finance", "Treasury & cash management",
      "Investor relations", "Commercial & retail banking", "Corporate & institutional banking", "Credit & lending", "Insurance & actuarial",
      "Reinsurance", "Accounting & audit", "Internal audit", "Tax", "Risk & compliance", "Fintech", "Crypto & digital assets",
    ],
  },
  {
    label: "Business & corporate",
    names: [
      "Corporate strategy & business development", "Product management", "Operations & supply chain", "Sales & business development",
      "Revenue operations & sales ops", "Pricing & revenue management", "Technical sales & solutions consulting",
      "Customer success & account management", "Business operations & chief of staff", "Program & project management",
      "Process improvement & lean", "Procurement & sourcing", "Business intelligence", "IT management & systems",
      "Human resources / people operations", "Learning & development", "Total rewards & compensation", "Executive search & talent",
      "Leadership development programs", "Legal & regulatory", "Government relations", "ESG & corporate responsibility",
      "Entrepreneurship / startups",
    ],
  },
  {
    label: "Marketing, media & creative",
    names: [
      "Marketing & brand strategy", "Brand management", "Digital marketing & performance", "Product marketing",
      "Market research & insights", "Advertising & media planning", "Social media & content", "Public relations & communications",
      "Media & entertainment", "Film & television", "Publishing & journalism", "Design & UX",
    ],
  },
  {
    label: "Technology",
    names: [
      "Tech / product strategy", "Data & analytics", "Software engineering", "Enterprise software & SaaS", "AI & machine learning",
      "Cloud & infrastructure", "Cybersecurity", "Hardware & semiconductors", "Robotics & automation", "Gaming",
    ],
  },
  {
    label: "Healthcare & life sciences",
    names: ["Healthcare", "Healthcare administration & operations", "Biotech & pharma", "Medical devices", "Digital health"],
  },
  {
    label: "Energy, industrials & real assets",
    names: [
      "Energy & sustainability", "Clean energy & climate tech", "Oil, gas & utilities", "Real estate", "Real estate brokerage & property management",
      "Construction & engineering", "Aerospace & defense", "Airlines & aviation", "Automotive & mobility", "Manufacturing & industrial",
      "Chemicals & materials", "Mining & metals", "Telecommunications", "Logistics & transportation",
    ],
  },
  {
    label: "Consumer, retail & hospitality",
    names: ["Consumer goods & retail", "E-commerce & marketplaces", "Travel & hospitality", "Food & agriculture", "Fashion & luxury", "Sports & fitness"],
  },
  {
    label: "Government, nonprofit & education",
    names: [
      "Nonprofit / public sector", "Government & policy", "Philanthropy & social impact", "International development",
      "Think tanks & policy research", "Education & edtech", "Higher education administration",
    ],
  },
];

export const INDUSTRIES = [...INDUSTRY_GROUPS.flatMap((g) => g.names.map((name) => ({ name, group: g.label }))), { name: "Still figuring it out" }];

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

// Places members can pick, grouped for the dropdown. US places are cities (or a metro area, whose member cities
// data/locationUtils.js holds); outside the US it is a country, except for the big business cities. A city matches a job
// open there, a country matches any job in it. Jobs carry every place their posting lists (jobs.locations, written by
// server/src/taxonomy/locations.ts, whose country names these must follow).
export const LOCATION_GROUPS = [
  { label: "Work mode", names: ["Remote", "Hybrid", "International"] },
  {
    label: "US metro areas",
    names: ["San Francisco Bay Area", "New York Metro", "Greater Los Angeles", "Greater Boston", "Washington DC Area", "Seattle Area", "Dallas-Fort Worth"],
  },
  {
    label: "US cities",
    names: [
      "Albany", "Albuquerque", "Anchorage", "Ann Arbor", "Arlington", "Atlanta", "Austin", "Baltimore", "Baton Rouge", "Birmingham",
      "Boise", "Boston", "Boulder", "Buffalo", "Burlington", "Cambridge", "Charleston", "Charlotte", "Chattanooga", "Chicago",
      "Cincinnati", "Cleveland", "Colorado Springs", "Columbia", "Columbus", "Cupertino", "Dallas", "Denver", "Des Moines", "Detroit",
      "Durham", "El Paso", "Evanston", "Fort Collins", "Fort Lauderdale", "Fort Worth", "Fresno", "Grand Rapids", "Greenville",
      "Hartford", "Honolulu", "Houston", "Huntsville", "Indianapolis", "Irvine", "Jacksonville", "Jersey City", "Kansas City", "Knoxville",
      "Las Vegas", "Lexington", "Lincoln", "Little Rock", "Long Beach", "Los Angeles", "Louisville", "Madison", "Memphis", "Menlo Park",
      "Miami", "Milwaukee", "Minneapolis", "Mountain View", "Nashville", "New Haven", "New Orleans", "New York", "Newark", "Norfolk",
      "Oakland", "Oklahoma City", "Omaha", "Orlando", "Palo Alto", "Pasadena", "Philadelphia", "Phoenix", "Pittsburgh", "Plano",
      "Portland", "Princeton", "Providence", "Raleigh", "Redwood City", "Reno", "Richmond", "Rochester", "Sacramento", "Salt Lake City",
      "San Antonio", "San Diego", "San Francisco", "San Jose", "Santa Barbara", "Santa Monica", "Savannah", "Scottsdale", "Seattle",
      "Sioux Falls", "St. Louis", "St. Paul", "Stamford", "Sunnyvale", "Syracuse", "Tampa", "Tempe", "Tucson", "Tulsa",
      "Virginia Beach", "Washington DC", "Wilmington", "Worcester",
    ],
  },
  {
    label: "International cities",
    names: [
      "London", "Paris", "Amsterdam", "Zurich", "Frankfurt", "Dublin", "Berlin", "Tokyo", "Hong Kong", "Singapore", "Shanghai", "Sydney",
      "Dubai", "Toronto", "Mexico City",
    ],
  },
  {
    label: "Countries",
    names: [
      "United Kingdom", "Canada", "Ireland", "Germany", "France", "Netherlands", "Switzerland", "Spain", "Italy", "Portugal", "Belgium",
      "Luxembourg", "Sweden", "Norway", "Denmark", "Finland", "Austria", "Poland", "Czechia", "Hungary", "Romania", "Greece", "Turkey",
      "Ukraine", "Israel", "United Arab Emirates", "Saudi Arabia", "Qatar", "Egypt", "Nigeria", "Kenya", "South Africa", "India",
      "China", "Japan", "South Korea", "Taiwan", "Thailand", "Vietnam", "Philippines", "Indonesia", "Malaysia", "Australia",
      "New Zealand", "Mexico", "Brazil", "Argentina", "Colombia", "Chile",
    ],
  },
];

export const LOCATIONS = LOCATION_GROUPS.flatMap((g) => g.names);

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
