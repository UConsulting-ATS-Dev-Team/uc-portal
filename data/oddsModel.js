import { JOBS } from "./mockJobs.js";
import { daysUntil } from "./jobUtils.js";
import { hashString } from "./hash.js";

// The odds model (wireframe 1e, "the product's signature feature").
// The spec fixes the 5 factors, their weights, and the presentation, but
// explicitly leaves the functional form open ("a product/data decision").
// This implementation:
//   - normalizes each factor's raw signal to a 0-1 "strength" score against
//     a defensible ceiling (documented per-factor below)
//   - takes a weighted sum of those as a 0-1 "candidate quality index"
//   - scales the UC-applicant base rate for this company (or the industry
//     rate, when company data is thin) by that index, so a stronger
//     candidate profile pushes the estimate above the average UC
//     applicant's rate at that company, and a weaker one pulls it below
// Every number is traceable: profile fit reuses the job's own match score,
// track record reuses the job's own past-cycle applicants/offers, timing
// reuses the same deadline math as the job cards.
const WEIGHTS = {
  trackRecord: 0.3,
  prep: 0.25,
  networking: 0.2,
  profileFit: 0.15,
  timing: 0.1,
};

const SPARSE_DATA_THRESHOLD = 5;
const OFFER_MEDIAN_HOURS = 26; // prep-hours ceiling a factor score of 1.0 represents
const TRACK_RECORD_CEILING = 0.35; // a 35% company offer rate reads as maximum strength
const TIMING_CEILING_DAYS = 30;

// Deterministic mock "logged prep hours" / "coffee chats completed" seeds
// per job, standing in for real data from prep-logging (3c/3d/2e) and
// coffee chats (1h) once those are built.
export function seededPrepHours(job) {
  return hashString(job.id) % 16;
}

export function seededChats(job) {
  if (job.ucConnections <= 0) return 0;
  return hashString(job.id + "c") % (job.ucConnections + 1);
}

function industryBaseRate(job) {
  const peers = JOBS.filter((j) => j.industry === job.industry && j.pastCycleApplicants > 0);
  const applicants = peers.reduce((sum, j) => sum + j.pastCycleApplicants, 0);
  const offers = peers.reduce((sum, j) => sum + j.pastCycleOffers, 0);
  return applicants > 0 ? offers / applicants : 0.08;
}

export function computeOdds(job, { extraPrepHours = 0 } = {}) {
  const prepHours = seededPrepHours(job) + extraPrepHours;
  const chats = seededChats(job);

  const isSparse = job.pastCycleApplicants < SPARSE_DATA_THRESHOLD;
  const companyRate =
    job.pastCycleApplicants > 0 ? job.pastCycleOffers / job.pastCycleApplicants : industryBaseRate(job);

  const days = daysUntil(job.deadlineDate);
  const timingScore = job.rolling ? 0.6 : days === null ? 0.4 : Math.max(0, Math.min(1, days / TIMING_CEILING_DAYS));

  const factors = [
    {
      key: "trackRecord",
      label: "UC track record here",
      weight: WEIGHTS.trackRecord,
      signal:
        job.pastCycleApplicants > 0
          ? `${job.pastCycleOffers} offers / ${job.pastCycleApplicants} applicants`
          : "No UC applicants on record yet",
      score: Math.max(0, Math.min(1, companyRate / TRACK_RECORD_CEILING)),
      lowConfidence: isSparse,
    },
    {
      key: "prep",
      label: "Preparation logged",
      weight: WEIGHTS.prep,
      signal: `${prepHours} hrs · offer median ${OFFER_MEDIAN_HOURS} hrs`,
      score: Math.max(0, Math.min(1, prepHours / OFFER_MEDIAN_HOURS)),
    },
    {
      key: "networking",
      label: "Networking depth",
      weight: WEIGHTS.networking,
      signal:
        job.ucConnections > 0
          ? `${chats} of ${job.ucConnections} UC connections chatted`
          : "No UC connections here yet",
      score: job.ucConnections > 0 ? chats / job.ucConnections : 0,
    },
    {
      key: "profileFit",
      label: "Profile & resume fit",
      weight: WEIGHTS.profileFit,
      signal: `${job.matchScore}% match to posting`,
      score: job.matchScore / 100,
    },
    {
      key: "timing",
      label: "Timing of application",
      weight: WEIGHTS.timing,
      signal: job.rolling ? "Rolling deadline" : days === null ? "No deadline listed" : `${Math.max(days, 0)} days before deadline`,
      score: timingScore,
    },
  ];

  const qualityIndex = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
  const headline = Math.round(Math.max(1, Math.min(95, companyRate * (0.5 + qualityIndex) * 100)));
  const openMarketBaseline = Math.max(1, Math.round(companyRate * 0.12 * 1000) / 10);
  const pastUCRate = Math.round(companyRate * 100);
  const percentile = Math.max(5, Math.min(95, Math.round(qualityIndex * 100)));

  // Biggest lever: the actionable factor (prep or networking -- the two a
  // member can actually move) with the most marginal value if maxed out.
  const actionable = factors.filter((f) => f.key === "prep" || f.key === "networking");
  const lever = actionable.reduce((best, f) => {
    const gain = f.weight * (1 - f.score);
    return gain > best.gain ? { factor: f, gain } : best;
  }, { factor: actionable[0], gain: -1 });

  const projectedQuality = qualityIndex + lever.gain;
  const projectedEstimate = Math.round(Math.max(1, Math.min(95, companyRate * (0.5 + projectedQuality) * 100)));

  return {
    headline,
    openMarketBaseline,
    pastUCRate,
    percentile,
    factors,
    lever: {
      key: lever.factor.key,
      projectedEstimate,
    },
    prepHours,
  };
}
