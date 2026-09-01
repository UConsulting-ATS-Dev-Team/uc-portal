import { supabase } from "./supabaseClient.js";
import { daysUntil } from "./jobUtils.js";
import { industryBaselineForJob } from "./industryBaseRates.js";

// The odds model (wireframe 1e) for REAL job postings (pages/RealJobDetail.jsx),
// see JOB_ENGINE_ARCHITECTURE.md's odds-model entry for the full design
// writeup. Deliberately a separate module from data/oddsModel.js rather than
// overloading it -- the mock version reads static fields straight off
// data/mockJobs.js; this one sources every factor from real, structurally
// different places (a Supabase RPC, the real people/network data, the real
// application-tracker store) and keeps the mock path's data untouched.
//
// The 5 factors/weights/sparse-data rule are the same fixed product spec
// CLAUDE.md defines (not re-derived here) -- WEIGHTS below intentionally
// mirrors data/oddsModel.js's WEIGHTS constant. If that product decision
// ever changes, update both.
const WEIGHTS = {
  trackRecord: 0.3,
  prep: 0.25,
  networking: 0.2,
  profileFit: 0.15,
  timing: 0.1,
};

const SPARSE_DATA_THRESHOLD = 5;
// Same normalization ceiling data/oddsModel.js uses -- there's no real
// "median hours logged by members who got an offer" dataset either place
// (no real job tracks an offer outcome at all, see the track-record note
// below), so this stays a shared, documented scoring constant, not a
// fabricated real statistic. The number actually displayed next to it (the
// member's own logged hours) is always real.
const OFFER_MEDIAN_HOURS = 26;
// Real track record measures "reached an interview," a structurally easier
// bar than the mock model's "received an offer" (see below) -- ceiling set
// higher than oddsModel.js's 0.35 offer-rate ceiling accordingly: a 50%
// interview-reach rate reads as maximum strength here.
const TRACK_RECORD_CEILING = 0.5;
// DEFAULT_BASE_RATE (the old flat 8% fallback) is gone -- see
// data/industryBaseRates.js's industryBaselineForJob() for what replaced
// it: a tiered, honestly-labeled prior (named-company research for ~20
// famous firms, an industry-classification heuristic for everyone else)
// used ONLY when there is genuinely zero real UC applicant data at either
// the job or the company scope. Real data, even n=1, always wins over
// this -- see the isSparse/hasNoRealData split in computeRealOdds() below.
const TIMING_CEILING_DAYS = 30;

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

// tracked_applications' stage taxonomy (data/trackerUtils.js) has no
// "received an offer" outcome -- "Closed" is ambiguous (offer-and-accepted,
// rejected, or withdrawn all look identical). Treating "Closed" as a stand-in
// for "offer" would fabricate data that doesn't exist, which is exactly what
// CLAUDE.md's "every number traceable" principle rules out. "Reached an
// interview stage" (First round or Final round) is the closest real,
// non-fabricated signal tracked_applications actually has -- job_track_record
// _report() (migration 20260831230000) computes it as a privacy-safe
// aggregate (security definer, counts only, no member identity ever
// returned), falling back from job-level to company-level when the specific
// posting has zero tracked applicants of its own (the common case for a
// single real listing).
export async function fetchTrackRecord(job) {
  const { data, error } = await supabase.rpc("job_track_record_report", {
    target_job_id: job.id,
    target_company: job.company,
  });
  if (error || !data || data.length === 0) {
    return { scope: "job", applicantCount: 0, interviewCount: 0 };
  }
  const row = data[0];
  return {
    scope: row.scope,
    applicantCount: Number(row.applicant_count) || 0,
    interviewCount: Number(row.interview_count) || 0,
  };
}

// Gathers everything computeRealOdds() needs. The one async piece is the
// track-record RPC; matchScore/people/savedConnections/coffeeChatStatus are
// already fetched/held by RealJobDetail.jsx for its own checklist and "UC
// members at {company}" rail, so this doesn't re-fetch them -- it's handed
// what's already on the page.
export async function fetchRealOddsInputs(job, { matchScore, people, savedConnections, coffeeChatStatus }) {
  const trackRecord = await fetchTrackRecord(job);
  return { job, matchScore, people: people ?? [], savedConnections: savedConnections ?? [], coffeeChatStatus: coffeeChatStatus ?? {}, trackRecord };
}

// Pure and synchronous, same shape data/oddsModel.js's computeOdds()
// returns, so components/OddsModel.jsx can render either one unmodified.
// extraPrepHours here is NOT added on top of a seeded baseline the way the
// mock model's seededPrepHours() is -- a real job's prep hours start
// genuinely at 0 until a member actually logs time, since inventing a
// baseline for real data would violate the same traceability principle the
// track-record factor above is built around.
export function computeRealOdds(inputs, { extraPrepHours = 0 } = {}) {
  const { job, matchScore, people, savedConnections, coffeeChatStatus, trackRecord } = inputs;
  const { scope, applicantCount, interviewCount } = trackRecord;

  const prepHours = extraPrepHours;
  // Two distinct "not much data" states, deliberately not collapsed into
  // one -- see CLAUDE.md's sparse-data rule (thin-but-real data still
  // wins and gets the existing "n=N - limited data" flag) vs. this
  // session's new no-real-data-at-all case (gets a differently-worded
  // "industry-typical, not UC-specific" flag instead -- see
  // industryBaselineNote below and OddsModel.jsx's rendering of it).
  const hasNoRealData = applicantCount === 0;
  const isSparse = applicantCount > 0 && applicantCount < SPARSE_DATA_THRESHOLD;
  const industryBaseline = hasNoRealData ? industryBaselineForJob(job) : null;
  const companyRate = hasNoRealData ? industryBaseline.rate : interviewCount / applicantCount;

  const connectedIds = new Set([...(savedConnections || []), ...Object.keys(coffeeChatStatus || {})]);
  const peopleAtCompany = people || [];
  const connectedCount = peopleAtCompany.filter((p) => connectedIds.has(p.id)).length;

  const days = daysUntil(job.application_deadline);
  const timingScore = days === null ? 0.4 : clamp01(days / TIMING_CEILING_DAYS);

  let trackRecordSignal;
  if (applicantCount === 0) {
    trackRecordSignal = "No UC applicants on record yet";
  } else if (scope === "job") {
    trackRecordSignal = `${interviewCount} of ${applicantCount} UC applicant${applicantCount === 1 ? "" : "s"} to this exact posting reached an interview`;
  } else {
    trackRecordSignal = `${interviewCount} of ${applicantCount} UC applicant${applicantCount === 1 ? "" : "s"} to ${job.company} roles reached an interview (company-wide, not this posting)`;
  }

  const factors = [
    {
      key: "trackRecord",
      label: "UC track record here",
      weight: WEIGHTS.trackRecord,
      signal: trackRecordSignal,
      score: clamp01(companyRate / TRACK_RECORD_CEILING),
      lowConfidence: isSparse,
      lowConfidenceNote: isSparse ? `n=${applicantCount} · limited data` : undefined,
      // Distinct from lowConfidence above -- that flag means "some real
      // UC data exists, but it's thin." This means "zero real UC data
      // exists at all, so the number above is a researched industry
      // baseline standing in for it" -- must never be visually or
      // textually confusable with real UC-specific data (CLAUDE.md's
      // odds-model decision + this session's brief). See
      // components/OddsModel.jsx for how the two render differently.
      industryBaseline: hasNoRealData,
      industryBaselineNote: hasNoRealData
        ? `Industry-typical rate for ${industryBaseline.tierLabel} — not based on UC applicants yet`
        : undefined,
    },
    {
      key: "prep",
      label: "Preparation logged",
      weight: WEIGHTS.prep,
      signal: `${prepHours} hrs · offer median ${OFFER_MEDIAN_HOURS} hrs`,
      score: clamp01(prepHours / OFFER_MEDIAN_HOURS),
    },
    {
      key: "networking",
      label: "Networking depth",
      weight: WEIGHTS.networking,
      signal:
        peopleAtCompany.length > 0
          ? `${connectedCount} of ${peopleAtCompany.length} UC connections at ${job.company}`
          : `No UC members on record at ${job.company} yet`,
      score: peopleAtCompany.length > 0 ? connectedCount / peopleAtCompany.length : 0,
    },
    {
      key: "profileFit",
      label: "Profile & resume fit",
      weight: WEIGHTS.profileFit,
      signal: `${matchScore ?? 0}% match to posting`,
      score: clamp01((matchScore ?? 0) / 100),
    },
    {
      key: "timing",
      label: "Timing of application",
      weight: WEIGHTS.timing,
      signal: days === null ? "No deadline listed" : `${Math.max(days, 0)} days before deadline`,
      score: timingScore,
    },
  ];

  const qualityIndex = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
  const headline = Math.round(Math.max(1, Math.min(95, companyRate * (0.5 + qualityIndex) * 100)));
  const openMarketBaseline = Math.max(1, Math.round(companyRate * 0.12 * 1000) / 10);
  const pastUCRate = Math.round(companyRate * 100);
  const percentile = Math.max(5, Math.min(95, Math.round(qualityIndex * 100)));

  // Same "biggest lever" logic as data/oddsModel.js's computeOdds() --
  // prep and networking are the two factors a member can actually move.
  const actionable = factors.filter((f) => f.key === "prep" || f.key === "networking");
  const lever = actionable.reduce(
    (best, f) => {
      const gain = f.weight * (1 - f.score);
      return gain > best.gain ? { factor: f, gain } : best;
    },
    { factor: actionable[0], gain: -1 }
  );

  const projectedQuality = qualityIndex + lever.gain;
  const projectedEstimate = Math.round(Math.max(1, Math.min(95, companyRate * (0.5 + projectedQuality) * 100)));

  return {
    headline,
    headlineLabel: "Estimated likelihood of reaching an interview",
    // hasNoRealData gets an honest methodology note instead of the
    // default one, which would otherwise claim "based on real UC
    // applicants" while there are none -- the same
    // never-confusable-with-real-data requirement as the factor-level
    // industryBaselineNote above.
    methodologyNote: hasNoRealData
      ? "No UC applicants are on record for this company yet, so the estimate below uses a researched industry-typical baseline instead of real UC outcomes — see the \"UC track record\" factor for what that baseline is."
      : "Based on real UC applicants who reached an interview stage — the tracker doesn't record final offer outcomes yet, so this measures interview-stage progress rather than offers.",
    openMarketBaseline,
    pastUCRate,
    // "Past UC applicants" is only an honest label when pastUCRate is
    // actually derived from real UC applicants -- OddsModel.jsx renders
    // this instead of the hardcoded default label when set.
    pastUCRateLabel: hasNoRealData ? "Industry-typical rate (no UC data yet)" : undefined,
    percentile,
    factors,
    lever: {
      key: lever.factor.key,
      projectedEstimate,
    },
    prepHours,
  };
}
