// Pure, testable Lever-shape mapping helpers for fetch-lever-companies (the
// Deno Edge Function is the actual production adapter; its own inline
// mapping is a hand-kept-in-sync port of this logic -- same pattern as
// supabase/functions/_shared/pipeline/normalize.ts's relationship to
// server/src/normalize.ts, see that file's header comment). Pulled out into
// its own tested module, unlike Greenhouse (whose adapter only does
// straightforward field renames inline, nothing worth a separate module),
// because Lever's real shape genuinely needed verification against the live
// API before writing this (see JOB_ENGINE_ARCHITECTURE.md's dated entry for
// what was confirmed against Wealthfront's and Belvedere Trading's real
// boards), and its identity-safeguard logic -- Lever postings carry no
// self-reported company name, unlike Greenhouse's `company_name` field -- is
// exactly the kind of thing a live-only integration check won't catch a
// regression in.

// Verified against real `https://api.lever.co/v0/postings/{slug}?mode=json`
// responses for both Wealthfront (23 postings) and Belvedere Trading (14
// postings) on 2026-08-31 -- the endpoint returns a JSON array directly (not
// `{ postings: [...] }` the way Greenhouse wraps its jobs in `{ jobs: [...] }`).
// Only the fields this adapter actually reads are typed here; the response
// also carries `description`/`descriptionPlain`/`lists`/`additional` (full
// posting body text) which this adapter deliberately never reads into a
// RawJob at all -- see fetch-lever-companies/index.ts's own comment for why
// that's a stronger guarantee than relying on enforceStorageRestrictions()
// alone.
export interface LeverPosting {
  id: string;
  text: string; // job title, e.g. "Android Engineer"
  categories?: {
    commitment?: string; // e.g. "Full-time", "Full-Time", "Intern" -- verified present on every posting in both real boards, unlike Greenhouse's ~90%-blank title-only signal
    location?: string; // e.g. "Palo Alto, CA", "Chicago, Illinois" -- verified present on every posting in both real boards
    allLocations?: string[];
  };
  workplaceType?: string; // "remote" | "hybrid" | "onsite" -- verified all three values occur across the two real boards
  country?: string; // e.g. "US", "SG" -- verified present
  createdAt?: number; // unix milliseconds -- verified via new Date(createdAt).toISOString(), e.g. 1694463796009 -> 2023-09-11
  hostedUrl?: string; // e.g. "https://jobs.lever.co/wealthfront/{id}" -- the public posting page; verified present on every posting
  applyUrl?: string; // hostedUrl + "/apply" -- an apply-form-specific deep link, not the canonical posting page; deliberately not used as applicationUrl (see index.ts)
}

// Lever's `categories.location` is bare place text with no remote/hybrid
// signal baked in ("Chicago, Illinois", "Palo Alto, CA") -- unlike
// Greenhouse, which sometimes bakes "(Remote)" directly into its own
// location field. Lever instead reports that as a *separate* structured
// `workplaceType` field. The shared normalizeLocation()
// (_shared/pipeline/taxonomy/locations.ts) only detects remote/hybrid from
// within the location text itself, so this folds workplaceType back in as a
// suffix it already knows how to parse, rather than teaching the shared
// normalizer a new Lever-specific field.
export function buildLeverLocationText(posting: LeverPosting): string | undefined {
  const place = posting.categories?.location?.trim();
  const mode = posting.workplaceType;
  if (mode === "remote") return place ? `${place} (Remote)` : "Remote";
  if (mode === "hybrid" && place) return `${place} (Hybrid)`;
  return place || undefined;
}

export function leverPostedDate(posting: LeverPosting): string | undefined {
  if (typeof posting.createdAt !== "number" || !Number.isFinite(posting.createdAt)) return undefined;
  return new Date(posting.createdAt).toISOString().slice(0, 10);
}

// Identity safeguard for a platform whose postings carry no self-reported
// company name -- Greenhouse's adapter compares each posting's own
// `company_name` field against the configured company (catching a squatted
// or reassigned slug, e.g. "bcg" resolving to an unrelated Oliver Wyman
// Labs board); Lever's postings have no equivalent field at all, confirmed
// by inspection of the real API response (see LeverPosting's own comment).
//
// This checks that a posting's own `hostedUrl` is actually scoped to the
// slug this source is configured for. Honest about what it does and doesn't
// catch: it *does* catch a posting appearing in the response under a
// different slug than the one requested (a config typo, or a Lever-side
// data-integrity anomaly), which would otherwise silently attribute an
// unrelated posting to the wrong company. It does *not* catch a genuine
// future slug reassignment to an unrelated org -- if "wealthfront" ever
// lapsed and a different company later registered that same slug, that
// company's own real postings would legitimately carry
// "https://jobs.lever.co/wealthfront/..." URLs too, so this check alone
// cannot distinguish "still the real Wealthfront" from "a new tenant of the
// same slug." Unlike Greenhouse, Lever gives this adapter no automated
// signal that could catch that case -- it's a real, permanent gap relative
// to the Greenhouse safeguard, not a bug in this function, and mitigating
// it fully would need periodic human re-verification (the same manual
// process scripts/check-company-source.mjs already documents for onboarding
// a new Lever source), which this repo has no automated recurring version
// of for either platform.
export function hostedUrlMatchesSlug(hostedUrl: string | undefined, slug: string): boolean {
  if (!hostedUrl || !slug) return false;
  const expectedPrefix = `https://jobs.lever.co/${slug}/`.toLowerCase();
  return hostedUrl.toLowerCase().startsWith(expectedPrefix);
}
