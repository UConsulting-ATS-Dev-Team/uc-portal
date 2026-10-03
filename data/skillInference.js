// Skills a job's TITLE implies, for matching the Skills a member picks on My Profile.
//
// The ingestion taxonomy (occupationTaxonomy.ts) fills `required_skills` for only a handful of
// occupations (~33% of live jobs) and only from a 28-word vocabulary, so a member picking "Tableau"
// or "Salesforce" could never match anything. This adds the same kind of occupation-typical
// guess for far more roles. Like the stored skills it is INFERRED from the occupation, not what
// the posting says -- the checklist lists them as "relevant skills" exactly as it does the stored
// ones. Only the title is read (the board list doesn't fetch descriptions, and matchJob() has to
// score a job identically on every page).
//
// Every skill named here is in data/careerOptions.js's SKILLS, and every SKILLS entry from
// "Tableau" on is named here: a skill no title implies is not offered, since it could never match.

const FAMILIES = [
  {
    // Any software-developer title.
    test: /software|\bswe\b|developer|programmer|(back|front)[- ]?end|full[- ]?stack|(web|mobile|platform|infrastructure|cloud|devops|systems|security|firmware|embedded|api|application|machine learning|data|ml|ai) engineer/i,
    skills: ["Programming", "Git", "Agile / Scrum", "Complex Problem Solving", "Systems Analysis"],
  },
  { test: /front[- ]?end|\bui engineer|\bweb (developer|engineer)|\breact\b|javascript|typescript/i, skills: ["JavaScript", "TypeScript", "React"] },
  { test: /back[- ]?end|\bjava\b|\bapi\b|server/i, skills: ["Java", "Node.js"] },
  { test: /\bpython\b/i, skills: ["Python"] },
  { test: /c\+\+/i, skills: ["C++"] },
  { test: /cloud|infrastructure|devops|\bsre\b|site reliability|platform engineer|\baws\b/i, skills: ["AWS", "Docker & Kubernetes"] },
  {
    test: /data (analy|scien|engineer)|analytics|business intelligence|\bbi\b|\binsights?\b|decision science/i,
    skills: ["SQL", "Microsoft Excel", "Tableau", "Power BI", "Data Visualization", "Statistics", "Data Modeling", "Python", "R", "Statistical Analysis Software"],
  },
  { test: /machine learning|\bml\b|\bai\b|data scien|applied scientist|research scientist|\bllm\b/i, skills: ["Machine Learning", "Python", "Statistics", "Programming"] },
  {
    test: /financial analyst|investment|banking|private equity|\bfp&a\b|corporate finance|valuation|\bm&a\b|equity research|portfolio|venture|credit analyst|\bfinance\b/i,
    skills: ["Financial Modeling Software", "Microsoft Excel", "Valuation", "Financial Reporting", "Budgeting & Forecasting", "Economics and Accounting", "Mathematics"],
  },
  { test: /investment bank|private equity|\bibd\b|\bm&a\b|leveraged|restructuring|transaction (advisory|services)/i, skills: ["LBO Modeling", "Due Diligence", "Valuation", "Bloomberg Terminal"] },
  { test: /accounting|\baudit|accountant|controller|\btax\b|bookkeep|\bcpa\b/i, skills: ["Accounting", "Financial Reporting", "Microsoft Excel", "Regulatory Compliance", "Economics and Accounting"] },
  { test: /\brisk\b|compliance|\bkyc\b|\baml\b|anti[- ]money|regulatory/i, skills: ["Risk Management", "Regulatory Compliance", "Due Diligence"] },
  { test: /quant|\btrader\b|trading/i, skills: ["Mathematics", "Statistics", "Python", "Financial Modeling Software", "Risk Management"] },
  { test: /research|economist|economic/i, skills: ["Statistics", "Market Research", "Statistical Analysis Software", "Business Writing"] },
  {
    test: /consult|strateg|business analyst|management analyst|chief of staff|business operations|\bbizops\b/i,
    skills: ["Microsoft PowerPoint", "Microsoft Excel", "Competitive Analysis", "Market Research", "Stakeholder Management", "Business Writing", "Critical Thinking", "Complex Problem Solving", "Process Improvement"],
  },
  {
    test: /marketing|brand|growth|content|\bseo\b|social media|communications?|\bpr\b|public relations/i,
    skills: ["Market Research", "Brand Strategy", "Content Strategy", "Google Analytics", "Marketing Analytics Platforms", "Social Media", "Sales and Marketing", "Communications and Media", "Adobe Creative Suite"],
  },
  { test: /\bseo\b|search engine|growth|performance marketing|digital marketing/i, skills: ["SEO"] },
  { test: /communications?|public relations|\bpr\b|media relations|speechwriter/i, skills: ["Business Writing", "Public Speaking"] },
  {
    test: /sales|account (executive|manager|management)|business development|\bsdr\b|\bbdr\b|territory|client (partner|solutions)|enterprise (account|sales)/i,
    skills: ["Salesforce", "CRM", "Negotiation", "Account Management", "Persuasion", "Sales and Marketing"],
  },
  { test: /sales development|\bsdr\b|\bbdr\b|business development|territory|inside sales|lead gen/i, skills: ["Prospecting & Lead Generation"] },
  { test: /customer success|client (success|relations|service)|customer experience|account manage/i, skills: ["CRM", "Account Management", "Stakeholder Management", "Salesforce"] },
  {
    test: /product (manager|management|analyst|owner|operations|strategy)|\bpm\b|\btpm\b/i,
    skills: ["Product Roadmapping", "A/B Testing", "SQL", "Agile / Scrum", "Jira", "Stakeholder Management", "Competitive Analysis"],
  },
  { test: /designer|\bux\b|\bui\b|user experience|product design|visual design|creative/i, skills: ["Figma", "Adobe Creative Suite"] },
  { test: /\bux\b.*research|user research|design research|researcher/i, skills: ["UX Research"] },
  { test: /program manage|project manage|\bpmo\b|delivery manager|scrum master|technical program/i, skills: ["Project Management Software", "Agile / Scrum", "Jira", "Stakeholder Management", "Coordination", "Process Improvement"] },
  {
    test: /operations|supply chain|logistics|procurement|sourcing|purchasing|vendor|planner|fulfillment|category manager/i,
    skills: ["Process Improvement", "Supply Chain Planning", "Vendor Management", "Microsoft Excel", "Coordination", "Systems Evaluation"],
  },
  { test: /legal|counsel|attorney|paralegal|\blaw\b|litigation|privacy|contracts?\b/i, skills: ["Contract Review", "Legal Research", "Regulatory Compliance"] },
  { test: /recruit|talent|\bhr\b|human resources|people (operations|partner|team)/i, skills: ["Recruiting", "Stakeholder Management", "Active Listening", "Social Perceptiveness"] },
  { test: /security|cyber|infosec/i, skills: ["Risk Management", "Systems Analysis"] },
];

// Every skill some title can imply -- lets a test confirm no skill is offered that could never match.
export function inferableSkills() {
  return new Set(FAMILIES.flatMap((f) => f.skills));
}

// Skills implied by a title, in a stable order, without duplicates.
export function skillsFromTitle(title) {
  if (!title) return [];
  const out = new Set();
  for (const family of FAMILIES) {
    if (family.test.test(title)) family.skills.forEach((s) => out.add(s));
  }
  return [...out];
}
