import type { RemoteType } from "../types.ts";

// US-11 -- location normalization. Rule-based (§3.2 step 1/2): a known-city
// lookup first (covers the markets UC members actually recruit in, same list
// as the existing frontend's data/careerOptions.js LOCATIONS), then a
// generic "City, ST" regex fallback for anything else.
// Ported unchanged from server/src/taxonomy/locations.ts.
const KNOWN_CITIES: Record<string, { city: string; state: string; country: string }> = {
  chicago: { city: "Chicago", state: "IL", country: "USA" },
  "new york": { city: "New York", state: "NY", country: "USA" },
  nyc: { city: "New York", state: "NY", country: "USA" },
  "los angeles": { city: "Los Angeles", state: "CA", country: "USA" },
  la: { city: "Los Angeles", state: "CA", country: "USA" },
  "san francisco": { city: "San Francisco", state: "CA", country: "USA" },
  sf: { city: "San Francisco", state: "CA", country: "USA" },
};

const US_STATE_ABBREVIATIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA",
  "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

export interface NormalizedLocation {
  city: string | null;
  state: string | null;
  country: string | null;
  remoteType: RemoteType | null;
}

export function normalizeLocation(text: string | undefined | null): NormalizedLocation {
  if (!text) return { city: null, state: null, country: null, remoteType: null };

  let remoteType: RemoteType | null = null;
  if (/remote/i.test(text)) remoteType = "remote";
  if (/hybrid/i.test(text)) remoteType = "hybrid";

  // Strip a parenthetical/slash remote-mode suffix before matching the place
  // itself, e.g. "San Francisco, CA (Hybrid)" -> "San Francisco, CA".
  const placeText = text.replace(/\(?(remote|hybrid|in[\s-]?person)\)?/gi, "").replace(/[/,]\s*$/, "").trim();

  const knownKey = placeText.toLowerCase().trim();
  if (KNOWN_CITIES[knownKey]) {
    const known = KNOWN_CITIES[knownKey];
    return { ...known, remoteType: remoteType ?? "in_person" };
  }

  const cityStateMatch = placeText.match(/^([A-Za-z .]+),\s*([A-Za-z]{2})$/);
  if (cityStateMatch) {
    const [, city, stateAbbrev] = cityStateMatch;
    const state = stateAbbrev.toUpperCase();
    if (US_STATE_ABBREVIATIONS.has(state)) {
      return { city: city.trim(), state, country: "USA", remoteType: remoteType ?? "in_person" };
    }
  }

  if (remoteType === "remote") {
    // A pure "Remote" posting with no place text at all is a valid, complete result.
    return { city: null, state: null, country: null, remoteType: "remote" };
  }

  // Couldn't confidently parse a place -- return what we know (remote/hybrid
  // signal, if any) rather than guessing at city/state.
  return { city: null, state: null, country: null, remoteType };
}
