// Pure Ashby-shape mapping helpers for fetch-ashby-companies. No imports on purpose: the Edge Function (Deno)
// and the vitest suite (server/tests/ashbyAdapter.test.ts) both import this one file, so there is a single copy
// to test, unlike Lever's hand-kept-in-sync port.
//
// Ashby's public Job Posting API -- GET https://api.ashbyhq.com/posting-api/job-board/{board}
// ?includeCompensation=true -- is Ashby's own documented, unauthenticated, third-party-facing job board API,
// the same legal category as Greenhouse's Job Board API and Lever's Postings API. Verified against real boards
// (Ramp and others, 2026-10-03). It returns `{ jobs: [...], apiVersion }`; every posting carries its full
// description inline (descriptionHtml/descriptionPlain), which the adapter deliberately never reads.
//
// What differs from Greenhouse/Lever and is handled here:
//  * Postings have no self-reported company name (like Lever), so identity is checked by the posting URL's board
//    segment -- see jobUrlMatchesSlug() and its stated limit.
//  * `employmentType` is one of FullTime / PartTime / Intern / Contract / Temporary. The jobs table has no
//    contract type, so contract and temporary postings are skipped, not mislabelled full-time.
//  * Location arrives as a free-text label ("New York, NY (HQ)", "Strava SF") plus a structured `address` and
//    `secondaryLocations[]`; the structured address is used when present.
//  * `isListed: false` postings are not on the public board and are ignored.

export interface AshbyPostalAddress {
  addressLocality?: string;
  addressRegion?: string;
  addressCountry?: string;
}

export interface AshbyLocation {
  location?: string;
  address?: { postalAddress?: AshbyPostalAddress };
}

export interface AshbyCompensationComponent {
  compensationType?: string; // "Salary" | "EquityPercentage" | "Bonus" ...
  interval?: string; // "1 YEAR" | "1 HOUR" | "NONE" ...
  currencyCode?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
}

export interface AshbyPosting {
  id: string;
  title: string;
  employmentType?: string;
  location?: string;
  address?: { postalAddress?: AshbyPostalAddress };
  secondaryLocations?: AshbyLocation[];
  workplaceType?: string; // "Remote" | "Hybrid" | "OnSite"
  publishedAt?: string;
  isListed?: boolean;
  jobUrl?: string;
  compensation?: { summaryComponents?: AshbyCompensationComponent[] };
}

// Employment-type wording the shared normalizer already understands. Contract and Temporary map to undefined
// (callers skip them via isContractOrTemporary()).
export function ashbyEmploymentTypeText(type: string | undefined): string | undefined {
  switch (type) {
    case "Intern":
      return "Internship";
    case "FullTime":
      return "Full-time";
    case "PartTime":
      return "Part-time";
    default:
      return undefined;
  }
}

export function isContractOrTemporary(posting: AshbyPosting): boolean {
  return posting.employmentType === "Contract" || posting.employmentType === "Temporary";
}

// "New York City, NY" / "Miami, Florida" / "London, England, United Kingdom" / "Canada" from a structured address.
function placeFromAddress(location: AshbyLocation | { address?: { postalAddress?: AshbyPostalAddress } }): string | undefined {
  const p = location.address?.postalAddress;
  if (!p) return undefined;
  const [locality, region, country] = [p.addressLocality, p.addressRegion, p.addressCountry].map((s) => s?.trim() || undefined);
  // A US city needs no country ("Miami, Florida" reads as well as "Miami, Florida, USA"); a bare country stays.
  const isUs = !!country && /^(usa|us|u\.s\.a?\.?|united states( of america)?)$/i.test(country);
  const parts = [locality, region, locality && isUs ? undefined : country].filter((s): s is string => !!s);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

// Free-text fallback: drop parentheticals ("(HQ)", "(Remote)", "(US)"), which the shared location normalizer
// cannot parse around, and the workplace mode is added back from `workplaceType` instead.
function cleanLabel(label: string | undefined): string | undefined {
  const cleaned = label?.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

// Location text for the shared normalizeLocation(): every place the posting lists, joined with " | " (which it
// splits on), then a (Remote)/(Hybrid) suffix from the structured workplace mode.
export function buildAshbyLocationText(posting: AshbyPosting): string | undefined {
  const places: string[] = [];
  const add = (place: string | undefined) => {
    if (place && !places.includes(place)) places.push(place);
  };
  add(placeFromAddress(posting) ?? cleanLabel(posting.location));
  for (const secondary of posting.secondaryLocations ?? []) add(placeFromAddress(secondary) ?? cleanLabel(secondary.location));

  const text = places.join(" | ");
  if (posting.workplaceType === "Remote") return text ? `${text} (Remote)` : "Remote";
  if (posting.workplaceType === "Hybrid" && text) return `${text} (Hybrid)`;
  return text || undefined;
}

// "$211400-$290600/year" from the posting's Salary component, in the shape normalizeCompensation() parses.
// Only USD salary or hourly pay is turned into text: equity, bonuses and other currencies are not what the
// compensation filter compares against.
export function ashbyCompensationText(posting: AshbyPosting): string | undefined {
  const salary = posting.compensation?.summaryComponents?.find(
    (c) => c.compensationType === "Salary" && c.currencyCode === "USD" && typeof c.minValue === "number",
  );
  if (!salary || salary.minValue == null) return undefined;
  const unit = salary.interval === "1 YEAR" ? "year" : salary.interval === "1 HOUR" ? "hour" : null;
  if (!unit) return undefined;
  const min = salary.minValue;
  const max = typeof salary.maxValue === "number" && salary.maxValue > min ? salary.maxValue : null;
  return max ? `$${min}-$${max}/${unit}` : `$${min}/${unit}`;
}

// Ashby postings carry no company name, so the only identity check available is that the posting's own URL sits
// under the board this source is configured for. That catches a config typo or a mixed-up response; like Lever's
// equivalent it cannot catch a board later reassigned to an unrelated organisation, which would produce matching
// URLs too. Every source is therefore identity-checked by a person when it is added.
export function jobUrlMatchesSlug(jobUrl: string | undefined, slug: string): boolean {
  if (!jobUrl || !slug) return false;
  return jobUrl.toLowerCase().startsWith(`https://jobs.ashbyhq.com/${slug}/`.toLowerCase());
}

export function ashbyPostedDate(publishedAt: string | undefined): string | undefined {
  if (!publishedAt) return undefined;
  const d = new Date(publishedAt);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}
