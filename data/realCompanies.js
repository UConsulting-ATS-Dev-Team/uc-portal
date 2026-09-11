import { supabase } from "./supabaseClient.js";

// Real-company directory support -- closes the gap flagged 2026-09-09:
// pages/Companies.jsx and pages/CompanyPage.jsx only ever covered
// data/mockCompanies.js's original 8 hand-authored companies (Bain,
// McKinsey, Deloitte, Stripe, Goldman Sachs, BCG, EY-Parthenon, Accenture),
// even after the real job pipeline (and the same day's company-tier work,
// data/companyTiers.js) made 86 real companies first-class, classified
// entities with real live postings. A member could find a Palantir job in
// Global Search but never browse "Palantir" as a company. This file derives
// a lightweight, HONEST company profile for any real company from its own
// real job postings -- never a hand-authored characterization paragraph or
// a company-size figure (nothing traceable would back either), matching the
// "no invented specifics" principle pages/CompanyPage.jsx's own Opportunities
// tab already established for the exact same reason (see that file's header
// comment).

// Every distinct company name already in the mock roster is excluded from
// the real-company list -- Deloitte and Stripe are both mock-authored AND
// have real automated sources, so their real jobs already surface through
// the existing mock company card (data/companyLiveJobs.js), not a second,
// duplicate "real" card for the same company.
function mostCommon(values) {
  if (values.length === 0) return null;
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Shared by fetchRealCompanySummaries (below, for the Companies grid) and
// pages/CompanyPage.jsx (which already has one company's own liveJobs
// in hand from its existing fetchLiveJobsByCompany call -- no second fetch
// needed there). industry is the single most common relevant_industries[0]
// across a company's own real postings (a real, traceable signal, not
// invented); offices are up to 3 distinct real posting cities, most
// frequent first.
export function deriveCompanyProfile(name, jobs) {
  const industry = mostCommon(jobs.map((j) => j.relevant_industries?.[0]).filter(Boolean)) ?? "Not classified";
  const cityCounts = new Map();
  for (const j of jobs) {
    if (!j.city) continue;
    cityCounts.set(j.city, (cityCounts.get(j.city) ?? 0) + 1);
  }
  const offices = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).map(([city]) => city).slice(0, 3);
  return {
    name,
    logoInitials: name.slice(0, 3).toUpperCase(),
    industry,
    offices,
    openRoles: jobs.length,
  };
}

// Lightweight aggregate for pages/Companies.jsx's grid (and CompanyPage's
// "Similar companies" rail) -- deliberately NOT JOB_LIST_COLUMNS
// (data/realJobAdapter.js), which is sized for rendering full job cards.
// This only ever needs 3 columns to derive a directory-level profile, so it
// stays its own narrower select rather than over-fetching for a summary.
export async function fetchRealCompanySummaries(excludeNames = []) {
  const exclude = new Set(excludeNames);
  const { data, error } = await supabase.from("jobs").select("company, city, relevant_industries").eq("active", true);
  if (error) throw new Error(`Fetching real company summaries failed: ${error.message}`);
  const byCompany = new Map();
  for (const row of data ?? []) {
    if (exclude.has(row.company)) continue;
    if (!byCompany.has(row.company)) byCompany.set(row.company, []);
    byCompany.get(row.company).push(row);
  }
  return [...byCompany.entries()].map(([name, jobs]) => deriveCompanyProfile(name, jobs));
}

// Real company-wide recruiting stats -- the honest replacement for
// data/companyUtils.js's statsFor(), which computes entirely from
// data/mockJobs.js/mockPeople.js (fabricated numbers, currently shown as
// fact on the 8 mock company pages too -- a pre-existing issue, not
// introduced here, but one a real company's page must not repeat).
// job_track_record_report() (supabase/migrations/20260831230000 +
// .../20260902130100) already computes exactly this, security-definer, for
// the real odds model's "UC track record" factor -- reused here rather than
// duplicated. Passing an empty target_job_id guarantees the job-level
// branch (job_id = '') never matches a real uuid or mock slug, so this
// always resolves the company-level aggregate directly.
export async function fetchRealCompanyStats(companyName) {
  const { data, error } = await supabase.rpc("job_track_record_report", { target_job_id: "", target_company: companyName });
  if (error) throw new Error(`Fetching real company stats failed: ${error.message}`);
  const row = data?.[0];
  const applicants = row?.applicant_count ?? 0;
  const interviews = row?.interview_count ?? 0;
  const offers = row?.offer_count ?? 0;
  return {
    ucApplicants: applicants,
    interviewCount: interviews,
    offerCount: offers,
    offerRate: applicants > 0 ? Math.round((offers / applicants) * 100) : 0,
  };
}

// Replaces the 8 mock companies' old hand-authored `characterization`
// field (data/mockCompanies.js) -- direct follow-up once real stats
// replaced statsFor() (2026-09-11): several of those static strings made
// comparative claims ("Highest UC offer rate of any firm on the tracker,"
// "Broadest UC alumni presence of any firm") that read as directly
// contradicting the real 0s now sitting right next to them, since UC has
// almost no tracked data yet for most of these companies. A hand-authored
// sentence can always go stale the moment real data changes under it; a
// sentence generated FROM the same real numbers the stat strip shows
// cannot -- same "every number traceable" principle as everything else on
// this page, just applied to a sentence instead of a stat cell. Used for
// every company now, mock or real alike (pages/Companies.jsx's grid calls
// this with ucApplicants omitted -- see that file's own comment on why a
// real per-card applicant count isn't fetched at grid scale -- so only the
// ucAlumni-driven branches ever fire there).
export function liveCharacterization({ ucAlumni, ucApplicants }) {
  const alumniPhrase = ucAlumni === 1 ? "1 UC alumnus/alumna is" : `${ucAlumni} UC alumni are`;
  const applicantPhrase = ucApplicants === 1 ? "1 UC member has tracked an application" : `${ucApplicants} UC members have tracked an application`;
  if (ucAlumni > 0 && ucApplicants > 0) return `${alumniPhrase} on record here, and ${applicantPhrase}.`;
  if (ucAlumni > 0) return `${alumniPhrase} on record here.`;
  if (ucApplicants > 0) return `No UC alumni on record here yet, but ${applicantPhrase}.`;
  return "No UC alumni or tracked applications on record here yet — you'd be one of the first.";
}
