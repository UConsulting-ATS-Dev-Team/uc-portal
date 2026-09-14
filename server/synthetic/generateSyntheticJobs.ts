import type { RawJob } from "../src/types.js";

// Stage 1 synthetic dataset (JOB_ENGINE_ARCHITECTURE.md Part 7): 100-500
// jobs, deliberately duplicated and malformed, so the pipeline can be proven
// against known-bad input before any real source exists. Seeded PRNG so the
// same seed always produces the same dataset -- reproducible test failures,
// not a moving target.

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Template {
  company: string;
  titleVariants: string[];
  employmentTypeText: string;
  locationText: string;
  compensationText: string;
  qualificationsText: string;
  urlBase: string;
}

const TEMPLATES: Template[] = [
  {
    company: "Bain & Company",
    titleVariants: ["Associate Consultant Intern", "Summer Associate Consultant", "AC Internship"],
    employmentTypeText: "Internship",
    locationText: "Chicago, IL",
    compensationText: "$45/hour",
    qualificationsText: "Currently pursuing a degree, graduating 2027 or 2028. Strong interest in management consulting.",
    urlBase: "https://jobs.bain.com/consultant-intern",
  },
  {
    company: "McKinsey & Company",
    titleVariants: ["Business Analyst Intern", "Summer Business Analyst", "BA Internship"],
    employmentTypeText: "Internship",
    locationText: "New York, NY",
    compensationText: "$48/hour",
    qualificationsText: "Rising junior or senior, strong analytical skills.",
    urlBase: "https://jobs.mckinsey.com/business-analyst",
  },
  {
    company: "Deloitte",
    // Third variant deliberately a 1-word extension of the first (adds
    // "Program"): jaccard("human capital consulting intern", "human
    // capital consulting intern program") = 4/5 = 0.8, landing in the
    // review band raised 2026-09-12 (server/src/dedupe.ts's
    // REVIEW_TITLE_SIMILARITY) -- exercises that band with a real,
    // plausible near-duplicate title pair rather than the two shorter,
    // lower-overlap variants below (which only ever reach 0.5-0.667,
    // below the raised threshold; kept as-is since they still exercise
    // the "distinct, no signal" path below review).
    titleVariants: ["Human Capital Consulting Intern", "HC Summer Intern", "Human Capital Consulting Intern Program"],
    employmentTypeText: "Internship",
    locationText: "Chicago, IL",
    compensationText: "$38/hour",
    qualificationsText: "Class of 2027, interest in organizational strategy.",
    urlBase: "https://jobs.deloitte.com/human-capital-intern",
  },
  {
    company: "Stripe",
    titleVariants: ["Strategy & Ops Intern", "Strategy and Operations Internship"],
    employmentTypeText: "Internship",
    locationText: "San Francisco, CA (Hybrid)",
    compensationText: "$42/hour",
    qualificationsText: "Rising senior, comfortable with ambiguity.",
    urlBase: "https://stripe.com/jobs/strategy-ops-intern",
  },
  {
    company: "Goldman Sachs",
    titleVariants: ["Investment Banking Summer Analyst", "IBD Summer Analyst"],
    employmentTypeText: "Internship",
    locationText: "New York, NY",
    compensationText: "$45-50/hour",
    qualificationsText: "Graduating 2027, strong quantitative background.",
    urlBase: "https://www.goldmansachs.com/careers/ibd-summer-analyst",
  },
  {
    company: "BCG",
    titleVariants: ["Summer Associate", "Consulting Summer Associate"],
    employmentTypeText: "Internship",
    locationText: "Los Angeles, CA",
    compensationText: "$46/hour",
    qualificationsText: "Rising senior, management consulting interest.",
    urlBase: "https://careers.bcg.com/summer-associate",
  },
  {
    company: "EY-Parthenon",
    titleVariants: ["Strategy Spring Week", "Strategy Spring Program"],
    employmentTypeText: "Externship",
    locationText: "Chicago, IL",
    compensationText: "Unpaid",
    qualificationsText: "Class of 2028, freshman or sophomore standing.",
    urlBase: "https://careers.ey.com/strategy-spring-week",
  },
  {
    company: "Accenture",
    titleVariants: ["Strategy & Consulting Analyst", "Full-Time Strategy Analyst"],
    employmentTypeText: "Full-time",
    locationText: "New York, NY",
    compensationText: "$85,000/year",
    qualificationsText: "Class of 2026, graduating senior.",
    urlBase: "https://careers.accenture.com/strategy-analyst",
  },
];

function pick<T>(arr: T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)];
}

export interface SyntheticDatasetOptions {
  count?: number; // total records, including deliberate duplicates/malformed
  seed?: number;
  exactDuplicateRate?: number; // fraction of base records that get an exact-URL duplicate
  nearDuplicateRate?: number; // fraction that get a near-duplicate variant
  malformedRate?: number; // fraction that get corrupted into an invalid record
}

// Generates a synthetic RawJob dataset with deliberately injected exact
// duplicates (US-16), near-duplicates (US-17), and malformed records (US-14)
// mixed in among clean, unique postings.
export function generateSyntheticJobs(options: SyntheticDatasetOptions = {}): RawJob[] {
  const {
    count = 200,
    seed = 42,
    exactDuplicateRate = 0.15,
    nearDuplicateRate = 0.15,
    malformedRate = 0.1,
  } = options;

  const random = mulberry32(seed);
  const jobs: RawJob[] = [];
  let sourceCounter = 0;

  function nextSourceJobId(): string {
    sourceCounter += 1;
    return `synthetic-${sourceCounter}`;
  }

  function baseJob(template: Template, titleIndex = 0): RawJob {
    const title = template.titleVariants[titleIndex % template.titleVariants.length];
    const sourceJobId = nextSourceJobId();
    return {
      source: { sourceId: "synthetic-source", sourceJobId, sourceUrl: `${template.urlBase}/${sourceJobId}`, isPrimary: true },
      company: template.company,
      title,
      employmentTypeText: template.employmentTypeText,
      locationText: template.locationText,
      compensationText: template.compensationText,
      qualificationsText: template.qualificationsText,
      postedDate: new Date(2026, 6, 1 + Math.floor(random() * 45)).toISOString().slice(0, 10),
      applicationDeadlineText: new Date(2026, 8, 1 + Math.floor(random() * 30)).toISOString().slice(0, 10),
      applicationUrl: `${template.urlBase}/${sourceJobId}`,
    };
  }

  while (jobs.length < count) {
    const template = pick(TEMPLATES, random);
    const clean = baseJob(template);
    jobs.push(clean);
    if (jobs.length >= count) break;

    if (random() < exactDuplicateRate) {
      // Exact duplicate: identical application URL, different source_job_id
      // (as if two feeds both surfaced the same posting) -- US-16.
      jobs.push({
        ...clean,
        source: { ...clean.source, sourceJobId: nextSourceJobId() },
      });
      if (jobs.length >= count) break;
    }

    if (random() < nearDuplicateRate) {
      // Near-duplicate: same company/location, a different title variant and
      // a different URL -- should land in the 70-89 review band, not
      // auto-merge and not be ignored as distinct -- US-17/18.
      const variantIndex = Math.floor(random() * template.titleVariants.length);
      const nearDup = baseJob(template, variantIndex);
      jobs.push(nearDup);
      if (jobs.length >= count) break;
    }

    if (random() < malformedRate) {
      // Malformed: one required field corrupted per record, rotating which
      // field so the validation pipeline (US-14) sees a mix of failure modes.
      const malformType = Math.floor(random() * 4);
      const malformed = baseJob(template);
      if (malformType === 0) malformed.company = "";
      else if (malformType === 1) malformed.title = "";
      else if (malformType === 2) malformed.applicationUrl = "not a real url";
      else malformed.employmentTypeText = "???"; // unclassifiable
      jobs.push(malformed);
    }
  }

  return jobs.slice(0, count);
}
