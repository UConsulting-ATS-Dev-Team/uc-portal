import { JOBS } from "./mockJobs.js";

export function jobsAt(companyName) {
  return JOBS.filter((j) => j.company === companyName);
}

// Anti-domination cap: one company (e.g. Databricks/Carvana with hundreds+
// of real postings) shouldn't fill an entire list of cards. Read by
// pages/Jobs.jsx's whole-array capPerCompany(). (Used to also be shared
// with components/ContinuousJobFeed.jsx's incremental per-batch version,
// US-58 -- that component/tab was removed Sept 2026 as redundant with
// "All jobs"; left this constant in its own file rather than moving it
// back into Jobs.jsx in case a future incremental-load feature wants it
// again.)
export const CAP_PER_COMPANY = 3;

// Deadline math shared by the Jobs board's filter and its job cards.
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr) - new Date();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function deadlineLabel(job) {
  if (job.rolling) return "Rolling";
  const days = daysUntil(job.deadlineDate);
  if (days === null) return "No deadline listed";
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days <= 14) return `${days}d left`;
  return new Date(job.deadlineDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isUrgent(job) {
  if (job.rolling) return false;
  const days = daysUntil(job.deadlineDate);
  return days !== null && days >= 0 && days <= 7;
}

export function matchesDeadlineBucket(job, bucket) {
  if (bucket === "Rolling") return !!job.rolling;
  const days = daysUntil(job.deadlineDate);
  if (days === null || days < 0) return false;
  if (bucket === "This week") return days <= 7;
  if (bucket === "This month") return days <= 30;
  return false;
}

// Generated role copy -- templated rather than hand-authored per job, since
// this is mock data standing in for a real job description.
export function descriptionFor(job) {
  return `${job.company} is hiring for ${job.role.toLowerCase()} on its ${job.industry.toLowerCase()} team in ${job.location}. You'll work directly with client teams, contribute to deliverables under partner/manager guidance, and get exposure to the kind of work that shapes a ${job.type.toLowerCase()} offer decision. UC members have a track record at ${job.company} — see the recruiting intelligence below before you apply.`;
}

export function qualificationsFor(job) {
  return [
    `Currently pursuing a degree, graduating ${job.classYears.join(" or ")}`,
    `Strong interest in ${job.industry.toLowerCase()}`,
    "Comfortable working with ambiguity and tight deadlines",
    job.workMode === "Remote" ? "Reliable home office setup" : `Able to work ${job.workMode.toLowerCase()} in ${job.location}`,
  ];
}

const WRITEUP_POOL = [
  { author: "Sana Liu", classYear: 2019, outcome: "Offer", cycle: "Fall 2025", body: "Case rounds leaned heavily on market-sizing — UC's case guide framework carried me through both rounds." },
  { author: "Marcus Webb", classYear: 2021, outcome: "Final round", cycle: "Spring 2025", body: "Behavioral questions focused on team conflict examples. Wish I'd prepped more stories in advance." },
  { author: "Priya Nair", classYear: 2022, outcome: "Offer", cycle: "Fall 2025", body: "First round was a fit interview, second was a full case with a partner. Very conversational, not adversarial." },
  { author: "Grace Kim", classYear: 2023, outcome: "No offer", cycle: "Fall 2024", body: "Got dinged on quantitative speed under pressure — practicing mental math would have helped a lot." },
];

export function writeupsFor(job) {
  const start = job.id.length % WRITEUP_POOL.length;
  return [WRITEUP_POOL[start], WRITEUP_POOL[(start + 1) % WRITEUP_POOL.length]];
}
