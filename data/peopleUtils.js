import { hashString } from "./hash.js";

// Profile-page detail (experience, education, contributions, skills) is
// generated from each person's core fields rather than hand-authored for
// all ~14 mock people -- same approach as data/jobUtils.js's
// descriptionFor/qualificationsFor for job listings.
const CAPABILITY_POOL = ["Case coach", "Offers referrals", "Ex-committee director", "Resume reviewer", "Mock interviewer"];
const HELP_POOL = ["Case practice", "Resume review", "Referrals", "Behavioral prep", "Full-time recruiting"];
const SKILL_POOL = {
  "Management consulting": ["Case interviews", "Market sizing", "Client communication"],
  "Investment banking": ["Financial modeling", "Valuation", "Pitch decks"],
  "Tech / product strategy": ["Product sense", "SQL", "Roadmapping"],
  "Private equity": ["LBO modeling", "Diligence", "Deal sourcing"],
};
const SCHOOLS = ["University of California, Los Angeles"];
const MAJORS = ["Business Economics", "Data Theory", "Political Science", "Statistics", "Communication"];

function pick(pool, seed, count = 2) {
  const start = seed % pool.length;
  const out = [];
  for (let i = 0; i < count; i++) out.push(pool[(start + i) % pool.length]);
  return out;
}

export function capabilitiesFor(person) {
  const seed = hashString(person.id);
  const chips = pick(CAPABILITY_POOL, seed, 2);
  if (person.mutualConnections > 0) chips.push(`${person.mutualConnections} mutual`);
  return chips;
}

export function happyToHelpFor(person) {
  const seed = hashString(person.id + "help");
  const picked = new Set(pick(HELP_POOL, seed, 3));
  return HELP_POOL.map((label) => ({ label, checked: picked.has(label) }));
}

export function skillsFor(person) {
  return SKILL_POOL[person.industry] || SKILL_POOL["Management consulting"];
}

export function educationFor(person) {
  const seed = hashString(person.id + "edu");
  return `B.A. ${MAJORS[seed % MAJORS.length]}, ${SCHOOLS[0]}`;
}

export function experienceFor(person) {
  if (!person.company) {
    return [{ title: person.role, company: "UConsulting", dates: `Class of ${person.classYear}`, location: person.location }];
  }
  return [
    { title: person.role, company: person.company, dates: "2023–present", location: person.office },
    { title: "Summer Analyst", company: person.company, dates: "2022", location: person.office },
  ];
}

export function ucExperienceFor(person) {
  const seed = hashString(person.id + "uc");
  const roles = ["Careers Committee", "Marketing Committee", "Recruitment Committee", "Alumni Relations"];
  return [
    {
      role: roles[seed % roles.length],
      years: `Class of ${person.classYear}`,
      contribution: "Helped run recruiting prep sessions for underclassmen.",
    },
  ];
}

export function contributionsFor(person) {
  const seed = hashString(person.id + "contrib");
  return {
    resourcesAuthored: seed % 4,
    writeups: (seed >> 2) % 3,
    jobPostings: (seed >> 4) % 3,
    coffeeChatsHeld: (seed >> 6) % 20,
  };
}

export function yearsExperienceFor(person) {
  return Math.max(0, 2026 - person.classYear);
}
