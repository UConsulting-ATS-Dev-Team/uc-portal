// US-10 (title crosswalk) / US-26 (skill enrichment) via O*NET, per
// JOB_ENGINE_ARCHITECTURE.md Part 10. Ported unchanged from
// server/src/taxonomy/occupationTaxonomy.ts -- see that file for the full
// STUB rationale. Swapping this module's two functions for real fetch()
// calls to services.onetcenter.org is the only change a real O*NET
// integration needs; this Edge Function only depends on the shape below.

export interface OnetOccupation {
  code: string; // O*NET-SOC code, e.g. "13-1111.00"
  title: string; // the occupation's canonical title
  jobFunction: string; // mapped onto UC's own job_function taxonomy, not O*NET's raw category
  relevantIndustries: string[];
  relevantRoles: string[];
  skills: string[];
  knowledge: string[];
  technologySkills: string[];
}

const OCCUPATIONS: Array<{ patterns: RegExp[]; occupation: OnetOccupation }> = [
  {
    patterns: [/business analyst/i, /^ba\b/i, /management (analyst|consultant)/i, /consulting/i, /strategy/i],
    occupation: {
      code: "13-1111.00",
      title: "Management Analysts",
      jobFunction: "Consulting",
      relevantIndustries: ["Management consulting"],
      relevantRoles: ["Consultant", "Strategy Associate"],
      skills: ["Critical Thinking", "Complex Problem Solving", "Active Listening", "Judgment and Decision Making"],
      knowledge: ["Administration and Management", "Economics and Accounting"],
      technologySkills: ["Microsoft Excel", "Microsoft PowerPoint", "SQL"],
    },
  },
  {
    patterns: [/investment banking/i, /\bibd\b/i, /private equity/i, /securities/i, /financial analyst/i],
    occupation: {
      code: "13-2051.00",
      title: "Financial and Investment Analysts",
      jobFunction: "Investment Banking",
      relevantIndustries: ["Investment banking", "Private equity"],
      relevantRoles: ["Investment Banking Analyst", "Private Equity Analyst"],
      skills: ["Mathematics", "Critical Thinking", "Complex Problem Solving"],
      knowledge: ["Economics and Accounting", "Mathematics"],
      technologySkills: ["Microsoft Excel", "Bloomberg Terminal", "Financial modeling software"],
    },
  },
  {
    patterns: [/product manager/i, /product management/i, /^pm\b/i],
    occupation: {
      code: "11-2021.00",
      title: "Marketing Managers", // O*NET's closest general category -- see Part 10's noted coverage gap for product-specific roles
      jobFunction: "Product Management",
      relevantIndustries: ["Tech / product strategy"],
      relevantRoles: ["Product Manager", "Program Manager"],
      skills: ["Coordination", "Judgment and Decision Making", "Active Listening"],
      knowledge: ["Sales and Marketing", "Administration and Management"],
      technologySkills: ["Project management software", "SQL"],
    },
  },
  {
    patterns: [/software engineer/i, /software developer/i, /\bswe\b/i],
    occupation: {
      code: "15-1252.00",
      title: "Software Developers",
      jobFunction: "Software Engineering",
      relevantIndustries: ["Tech / product strategy"],
      relevantRoles: ["Data Analyst"],
      skills: ["Programming", "Complex Problem Solving", "Systems Analysis"],
      knowledge: ["Computers and Electronics", "Engineering and Technology"],
      technologySkills: ["Python", "SQL", "Git"],
    },
  },
  {
    patterns: [/marketing/i, /brand/i],
    occupation: {
      code: "11-2021.00",
      title: "Marketing Managers",
      jobFunction: "Marketing",
      relevantIndustries: ["Marketing & brand strategy"],
      relevantRoles: ["Marketing Associate"],
      skills: ["Coordination", "Persuasion", "Social Perceptiveness"],
      knowledge: ["Sales and Marketing", "Communications and Media"],
      technologySkills: ["Adobe Creative Suite", "Marketing analytics platforms"],
    },
  },
  {
    patterns: [/operations/i],
    occupation: {
      code: "13-1111.01",
      title: "Operations Research Analysts",
      jobFunction: "Operations",
      relevantIndustries: ["Tech / product strategy"],
      relevantRoles: ["Operations Associate", "Business Development"],
      skills: ["Mathematics", "Complex Problem Solving", "Systems Evaluation"],
      knowledge: ["Mathematics", "Administration and Management"],
      technologySkills: ["Microsoft Excel", "SQL", "Statistical analysis software"],
    },
  },
];

// Deterministic title -> occupation classification (US-10). Returns null
// rather than a low-confidence guess when nothing matches -- callers should
// leave job_function/skills unset in that case, not fabricate a mapping.
export function classifyTitleToOccupation(title: string): OnetOccupation | null {
  for (const { patterns, occupation } of OCCUPATIONS) {
    if (patterns.some((p) => p.test(title))) return occupation;
  }
  return null;
}

// US-26 -- pulls the occupation's skill profile as the job's *inferred*
// skill set. Callers must tag this classification_method: "onet_occupation",
// never "source_stated" -- this is occupation-typical, not what the specific
// posting itself said (US-28, and Part 10's first honest limitation).
export function skillsForOccupation(occupation: OnetOccupation): string[] {
  return [...occupation.skills, ...occupation.technologySkills];
}
