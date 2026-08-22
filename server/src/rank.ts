import type { MatchResult, MemberProfile, NormalizedJob } from "./types.js";
import { matchJob } from "./match.js";

// US-40/41/42/43 -- ranking formula from §3.9:
//   Final Score = w1*Relevance + w2*MemberMatch + w3*Freshness
//               + w4*Quality + w5*DeadlineUrgency + w6*UCRelevance
export interface RankWeights {
  relevance: number;
  memberMatch: number;
  ucRelevance: number;
  deadlineUrgency: number;
  freshness: number;
  quality: number;
}

// Starting weights from §3.9 -- config values, not hardcoded assumptions;
// tune from real engagement data once there is any.
export const DEFAULT_WEIGHTS: RankWeights = {
  relevance: 0.3,
  memberMatch: 0.3,
  ucRelevance: 0.15,
  deadlineUrgency: 0.15,
  freshness: 0.05,
  quality: 0.05,
};

export interface RankedJob {
  job: NormalizedJob;
  match: MatchResult;
  finalScore: number;
  componentScores: RankWeights;
}

// US-43 anti-domination cap -- "max N per company in the top 20," per §3.9.
const MAX_PER_COMPANY_IN_TOP_WINDOW = 3;
const TOP_WINDOW_SIZE = 20;

function textRelevance(job: NormalizedJob, query: string | undefined): number {
  if (!query?.trim()) return 0.5; // neutral when browsing without a query, not 0
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0.5;
  const haystack = `${job.title} ${job.company} ${job.qualificationsText ?? ""}`.toLowerCase();
  const hits = tokens.filter((t) => haystack.includes(t)).length;
  return hits / tokens.length;
}

// US-41 -- mild decay so old postings fade naturally rather than needing
// to be deleted; full score at <=7 days, tapering to 0 by 90 days.
function freshnessScore(job: NormalizedJob, now: Date): number {
  if (!job.postedDate) return 0.5;
  const days = (now.getTime() - new Date(job.postedDate).getTime()) / 86400000;
  return Math.max(0, Math.min(1, 1 - days / 90));
}

function deadlineUrgencyScore(job: NormalizedJob, now: Date): number {
  if (!job.applicationDeadline) return 0.3; // no deadline listed -- mildly deprioritized vs. a real one, never 0
  const days = (new Date(job.applicationDeadline).getTime() - now.getTime()) / 86400000;
  if (days < 0) return 0;
  return Math.max(0, Math.min(1, 1 - days / 30));
}

// US-42 -- stand-in for the real CRM-backed signal (§3.6). Stage 1 has no
// mocked alumni-count data at this layer, so this only reads what's already
// on the profile (followed company) -- swapping in a real CRM read is a
// Stage 2+ change to this one function, nothing else.
function ucRelevanceScore(job: NormalizedJob, profile: MemberProfile): number {
  return profile.followedCompanies.includes(job.company) ? 1 : 0.3;
}

export function rankJobs(
  jobs: NormalizedJob[],
  profile: MemberProfile,
  options: { query?: string; weights?: RankWeights; now?: Date } = {}
): RankedJob[] {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const now = options.now ?? new Date();

  const scored = jobs
    .map((job): RankedJob | null => {
      const match = matchJob(job, profile);
      if (!match.eligible) return null; // hard constraints remove entirely, US-33

      const componentScores: RankWeights = {
        relevance: textRelevance(job, options.query),
        memberMatch: match.score / 100,
        ucRelevance: ucRelevanceScore(job, profile),
        deadlineUrgency: deadlineUrgencyScore(job, now),
        freshness: freshnessScore(job, now),
        quality: job.qualityScore ?? 0.5,
      };

      const finalScore =
        weights.relevance * componentScores.relevance +
        weights.memberMatch * componentScores.memberMatch +
        weights.ucRelevance * componentScores.ucRelevance +
        weights.deadlineUrgency * componentScores.deadlineUrgency +
        weights.freshness * componentScores.freshness +
        weights.quality * componentScores.quality;

      return { job, match, finalScore, componentScores };
    })
    .filter((r): r is RankedJob => r !== null)
    .sort((a, b) => b.finalScore - a.finalScore);

  return applyCompanyCap(scored);
}

// Demotes (never drops) results past the per-company cap, so one large
// employer's volume can't crowd out everything else in the top 20. Walks
// the FULL ranked list once -- demoted items must land after position
// TOP_WINDOW_SIZE in the final order, not just after the cap within a
// pre-sliced window (which doesn't actually remove them from "the top 20"
// when the whole list is shorter than the window).
function applyCompanyCap(ranked: RankedJob[]): RankedJob[] {
  const counts = new Map<string, number>();
  const primary: RankedJob[] = [];
  const demoted: RankedJob[] = [];

  for (const item of ranked) {
    const count = counts.get(item.job.company) ?? 0;
    if (primary.length < TOP_WINDOW_SIZE && count < MAX_PER_COMPANY_IN_TOP_WINDOW) {
      primary.push(item);
      counts.set(item.job.company, count + 1);
    } else {
      demoted.push(item);
    }
  }

  return [...primary, ...demoted];
}
