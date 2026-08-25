import { useEffect, useRef, useState } from "react";
import JobCard from "./JobCard.jsx";
import ErrorState from "./ErrorState.jsx";
import Skeleton from "./Skeleton.jsx";
import { supabase } from "../data/supabaseClient.js";
import { matchJob, finalScore } from "../data/jobMatch.js";
import { realJobToCardShape } from "../data/realJobAdapter.js";
import { CAP_PER_COMPANY } from "../data/jobUtils.js";

// US-58 -- the "personalized continuous feed." Deliberately a separate fetch
// path from pages/Jobs.jsx's own rawJobs (which loads the *entire* active-jobs
// table via data/fetchAllRows.js so the All/Saved/Recommended tabs' filter
// counts and chip UI have the full set to work with). A continuous feed is
// the one place in this app that must NOT do that -- an endless scroll is
// exactly the shape of feature most likely to keep loading, so front-loading
// ~3280 rows on mount would be the worst version of the fetchAllRows()
// mistake this codebase has already hit once (see that file's own header
// comment). Instead this fetches BATCH_SIZE rows at a time via .range(),
// scores/ranks only the rows it just fetched, and appends -- real cursor-
// based pagination against the live table, growing only as far as the
// member actually scrolls.
const BATCH_SIZE = 60;

// Ordered by quality first (a real, already-computed column, not a proxy
// invented for this feature -- same qualityScore finalScore's own "quality"
// factor reads) so the feed's DB-level ordering is itself a reasonable
// starting tier before per-member ranking narrows it further within each
// batch. `id` is a pure tiebreaker for stable range() pagination -- without
// one, ties on quality_score (many jobs share the same score, many are null)
// could cause postgrest to skip or repeat rows across pages.
function jobsQuery(from, to) {
  return supabase
    .from("jobs")
    .select("*")
    .eq("active", true)
    .order("quality_score", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, to);
}

export default function ContinuousJobFeed({ preferences, classYear, savedJobIds, onToggleSave }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  // Running per-company counts across every batch loaded so far, not just
  // the batch currently in hand -- otherwise a company could still dominate
  // by re-clearing the cap on every new page (the same "global, not per-page"
  // reasoning pages/Jobs.jsx's own capPerCompany() comment already spells
  // out for its whole-array version). A ref, not state, since it's an
  // implementation detail of the fetch loop, not something a render should
  // ever key off of.
  const companyCounts = useRef({});
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);

  async function loadNextBatch() {
    if (loadingRef.current || done) return;
    loadingRef.current = true;
    setLoading(true);

    const from = offsetRef.current;
    const to = from + BATCH_SIZE - 1;
    const { data, error: fetchError } = await jobsQuery(from, to);

    if (fetchError) {
      setError(fetchError.message);
      loadingRef.current = false;
      setLoading(false);
      setInitialLoadDone(true);
      return;
    }

    offsetRef.current = from + BATCH_SIZE;
    if (!data || data.length < BATCH_SIZE) setDone(true);

    // Hard constraints (US-33) -- ineligible jobs (wrong grad year, wrong
    // internship/full-time type) are dropped entirely, same rule
    // data/jobMatch.js's own isEligible() documents, never just down-ranked.
    const eligible = (data ?? [])
      .map((job) => ({ job, match: matchJob(job, preferences, classYear) }))
      .filter(({ match }) => match.eligible)
      .map(({ job, match }) => realJobToCardShape(job, match));

    // Rank this batch by the real §3.9 formula -- the exact same
    // data/jobMatch.js finalScore() pages/Jobs.jsx's "Best match" sort uses,
    // not a parallel scoring path. No keyword query here (this feed has no
    // search box), so textRelevanceScore stays neutral for every job.
    eligible.sort((a, b) => finalScore(b, preferences, "") - finalScore(a, preferences, ""));

    const kept = [];
    for (const job of eligible) {
      const count = companyCounts.current[job.company] ?? 0;
      if (count >= CAP_PER_COMPANY) continue;
      companyCounts.current[job.company] = count + 1;
      kept.push(job);
    }

    setJobs((prev) => [...prev, ...kept]);
    loadingRef.current = false;
    setLoading(false);
    setInitialLoadDone(true);
  }

  // Reset the whole feed if the member's preferences change (e.g. they
  // update onboarding mid-session) -- a stale ranking based on old
  // preferences would silently drift from what "ranked for you" actually
  // means. classYear is effectively static (mock identity, not editable),
  // included for completeness.
  useEffect(() => {
    setJobs([]);
    setDone(false);
    setError(null);
    setInitialLoadDone(false);
    companyCounts.current = {};
    offsetRef.current = 0;
    loadNextBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences, classYear]);

  // Real infinite scroll: an IntersectionObserver on a sentinel element
  // below the last card triggers the next batch once it enters the
  // viewport, instead of a fixed page-number control.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadNextBatch();
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, done]);

  if (error && jobs.length === 0) {
    return (
      <ErrorState
        what="feed"
        onRetry={() => {
          setError(null);
          loadNextBatch();
        }}
      />
    );
  }

  return (
    <div>
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} saved={savedJobIds.includes(job.id)} onToggleSave={onToggleSave} />
      ))}

      {!initialLoadDone && (
        <>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </>
      )}

      {initialLoadDone && jobs.length === 0 && !loading && (
        <div className="no-results">
          <p style={{ fontWeight: 700 }}>No eligible roles found yet</p>
          <p className="meta">
            Nothing in the live jobs table currently matches your graduation year and opportunity-type settings.
            Check My Profile's recruiting settings, or browse "All jobs" to see everything unfiltered.
          </p>
        </div>
      )}

      {loading && initialLoadDone && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}

      {error && jobs.length > 0 && (
        <p className="meta">Couldn't load more roles right now ({error}). Keep scrolling to retry.</p>
      )}

      {done && jobs.length > 0 && !loading && (
        <p className="meta" style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
          You've reached the end of the live feed — {jobs.length} roles shown.
        </p>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
    </div>
  );
}
