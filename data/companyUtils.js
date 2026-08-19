import { jobsAt } from "./jobUtils.js";
import { peopleAt } from "./mockPeople.js";
import { hashString } from "./hash.js";

// Company-level stats aggregated from the same job/people records shown
// elsewhere (Jobs board, Job detail, Network) -- not separately authored
// numbers, so a company page can't drift out of sync with the rest of
// the app.
export function statsFor(company) {
  const jobs = jobsAt(company.name);
  const people = peopleAt(company.name);
  const applicants = jobs.reduce((sum, j) => sum + j.pastCycleApplicants, 0);
  const offers = jobs.reduce((sum, j) => sum + j.pastCycleOffers, 0);
  const finalRounds = Math.round(applicants * 0.4);
  const offerRate = applicants > 0 ? Math.round((offers / applicants) * 100) : 0;
  const medianPrepHours = 14 + (hashString(company.id + "prep") % 12);
  return { openRoles: jobs.length, ucAlumni: people.length, ucApplicants: applicants, finalRounds, offers, offerRate, medianPrepHours };
}

const QUOTE_POOL = [
  { author: "Sana Liu", classYear: 2019, body: "The people here actually want you to succeed — every UC alum I reached out to made time for a call." },
  { author: "Marcus Webb", classYear: 2021, body: "Interview process moves fast once you're in it. Have your stories ready before you apply, not after." },
  { author: "Priya Nair", classYear: 2022, body: "Culture is more collaborative than I expected going in — less \"sink or swim\" than the reputation suggests." },
  { author: "Grace Kim", classYear: 2023, body: "Recruiters were transparent about timeline and next steps the whole way through, which I didn't expect." },
];

export function quotesFor(company) {
  const start = hashString(company.id) % QUOTE_POOL.length;
  return [QUOTE_POOL[start], QUOTE_POOL[(start + 1) % QUOTE_POOL.length]];
}

const ACTIVITY_TEMPLATES = [
  (person) => `${person.name} posted a referral for an open role.`,
  (person) => `${person.name} was promoted to ${person.role}.`,
  (person) => `${person.name} has 2 coffee-chat slots open this week.`,
];

export function activityFor(company) {
  const people = peopleAt(company.name);
  if (people.length === 0) return [];
  return people.slice(0, 3).map((person, i) => ({
    person,
    text: ACTIVITY_TEMPLATES[i % ACTIVITY_TEMPLATES.length](person),
  }));
}
