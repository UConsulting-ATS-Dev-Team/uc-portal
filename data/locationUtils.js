// How a member's location preferences are matched against a job's places.
//
// A job's places come from jobs.locations (every place its posting lists, written by the
// ingestion parser, server/src/taxonomy/locations.ts): "Austin, TX" for a US city,
// "London, United Kingdom" abroad, "Canada" for a bare non-US country. Jobs not yet
// re-derived have no `locations`, so the single `city`/`state` they carry stands in.
//
// A preference is a city ("Denver"), a metro ("San Francisco Bay Area", below), a country
// ("Canada"), or one of "Remote" / "Hybrid" / "International" (handled by callers and here).

// Metro -> its member places, as the parser writes them. Kept to places employers really list
// under the metro's name (Hawthorne is SpaceX's, Redmond and Woodinville are Seattle's).
export const METROS = {
  "San Francisco Bay Area": [
    "San Francisco, CA", "Oakland, CA", "San Jose, CA", "Palo Alto, CA", "Menlo Park, CA", "Mountain View, CA",
    "Sunnyvale, CA", "Santa Clara, CA", "Redwood City, CA", "Foster City, CA", "Newark, CA", "Fremont, CA",
    "Berkeley, CA", "San Mateo, CA", "South San Francisco, CA", "Cupertino, CA", "Los Gatos, CA", "Milpitas, CA",
    "Emeryville, CA", "San Carlos, CA", "Burlingame, CA", "Hayward, CA", "Campbell, CA", "Los Altos, CA",
  ],
  "New York Metro": [
    "New York, NY", "Brooklyn, NY", "Queens, NY", "Jersey City, NJ", "Hoboken, NJ", "Newark, NJ", "White Plains, NY",
    "Stamford, CT", "Greenwich, CT", "Long Island City, NY", "Rutherford, NJ", "West Caldwell, NJ", "Princeton, NJ",
  ],
  "Greater Los Angeles": [
    "Los Angeles, CA", "Santa Monica, CA", "El Segundo, CA", "Hawthorne, CA", "Long Beach, CA", "Irvine, CA",
    "Pasadena, CA", "Burbank, CA", "Culver City, CA", "Beverly Hills, CA", "Torrance, CA", "Costa Mesa, CA",
    "Newport Beach, CA", "Glendale, CA", "Venice, CA", "Playa Vista, CA",
  ],
  "Greater Boston": [
    "Boston, MA", "Cambridge, MA", "Somerville, MA", "Waltham, MA", "Natick, MA", "Burlington, MA", "Lexington, MA",
    "Needham, MA", "Quincy, MA", "Watertown, MA", "Framingham, MA", "Marlborough, MA",
  ],
  "Washington DC Area": [
    "Washington, DC", "Arlington, VA", "McLean, VA", "Reston, VA", "Tysons, VA", "Alexandria, VA", "Bethesda, MD",
    "Rockville, MD", "Herndon, VA", "Falls Church, VA", "Silver Spring, MD",
  ],
  "Seattle Area": [
    "Seattle, WA", "Bellevue, WA", "Redmond, WA", "Kirkland, WA", "Woodinville, WA", "Renton, WA", "Tacoma, WA",
    "Bothell, WA", "Issaquah, WA", "Everett, WA",
  ],
  "Dallas-Fort Worth": [
    "Dallas, TX", "Fort Worth, TX", "Plano, TX", "Frisco, TX", "Irving, TX", "Addison, TX", "Westlake, TX",
    "Richardson, TX", "Arlington, TX", "McKinney, TX", "Southlake, TX",
  ],
};

const METRO_SETS = Object.fromEntries(Object.entries(METROS).map(([name, places]) => [name, new Set(places)]));

// Preferences whose label isn't how the parser spells the place.
const PREF_ALIAS = { "Washington DC": "Washington, DC" };

// "Austin, TX" -> "Austin"; "London, United Kingdom" -> "London"; "Canada" -> "Canada".
function cityPart(place) {
  const i = place.indexOf(",");
  return i === -1 ? place : place.slice(0, i);
}

// A US place ends in a state code ("Austin, TX"); a country-only entry has no comma.
function isNonUs(place) {
  if (place === "United States") return false;
  return !/,\s*[A-Z]{2}$/.test(place);
}

// Every place a job is open in. Falls back to the single city for a job whose `locations`
// hasn't been derived yet.
export function placesForJob(job) {
  if (Array.isArray(job.locations) && job.locations.length > 0) return job.locations;
  if (job.city) {
    if (job.state) return [`${job.city}, ${job.state}`];
    if (job.country && job.country !== "USA") return [`${job.city}, ${job.country}`];
    return [job.city];
  }
  if (job.country && job.country !== "USA") return [job.country];
  return [];
}

// Does one location preference match a job? Work-mode preferences compare remote_type; the
// rest compare places.
export function locationPrefMatches(pref, job, places = placesForJob(job)) {
  if (pref === "Remote") return job.remote_type === "remote";
  if (pref === "Hybrid") return job.remote_type === "hybrid";
  if (pref === "International") return places.some(isNonUs);
  const metro = METRO_SETS[pref];
  if (metro) return places.some((p) => metro.has(p));
  const target = PREF_ALIAS[pref] ?? pref;
  // A country preference ("Canada") also matches that country's cities ("Toronto, Canada").
  return places.some((p) => p === target || cityPart(p) === target || p.endsWith(`, ${target}`));
}

// Does a job match ANY of the given location preferences? (Used by the Jobs page filters and
// the profile's match score.)
export function matchesAnyLocation(prefs, job) {
  if (!prefs?.length) return false;
  const places = placesForJob(job);
  return prefs.some((p) => locationPrefMatches(p, job, places));
}

// City names to look for inside a free-text directory location ("New York, NY", "Greater
// Boston Area"), for the alumni counts in onboarding. A metro stands for all of its cities.
export function locationSearchTerms(pref) {
  if (METROS[pref]) return [...new Set(METROS[pref].map(cityPart))];
  if (["Remote", "Hybrid", "International"].includes(pref)) return [];
  return [pref];
}

// What to show for a job's place on a card: the first place, "+N more" when it lists several.
export function placeLabel(job) {
  const places = placesForJob(job);
  if (places.length === 0) return job.remote_type === "remote" ? "Remote" : "";
  const first = places[0].replace(/, [A-Z]{2}$/, "");
  return places.length > 1 ? `${first} +${places.length - 1} more` : first;
}
