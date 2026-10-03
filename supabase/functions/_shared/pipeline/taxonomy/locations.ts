import type { RemoteType } from "../types.ts";

// US-11 -- location normalization. Rule-based (§3.2 step 1/2): split a posting's
// location text into its individual places, then resolve each one against known
// cities, US state names/abbreviations and countries. Anything it can't place
// confidently stays unplaced rather than guessed.
//
// Rewritten 2026-10-03. The first version only understood "City, ST" and five
// hard-coded cities, so ~76% of the live board (3,579 of 4,710 active jobs) had no
// city at all: real feeds say "San Francisco, California", "New York City, New York",
// "Hawthorne, CA; Redmond, WA", "SF | NYC", a bare "Chicago" or "London", or just
// "United States". A job also only ever carried ONE place, so a role open in three
// cities could match a member in only the first.
//
// `locations` is the list every place in the posting resolves to, as strings the
// frontend matches member preferences against (data/locationUtils.js):
//   US place            "Austin, TX"
//   non-US place        "London, United Kingdom"
//   country only (non-US)  "Canada"
// A bare "United States" adds nothing (it names no place a member could pick).
//
// Ported unchanged from server/src/taxonomy/locations.ts: change both.

const US_STATE_ABBREVIATIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA",
  "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

// Canonical country name by every spelling a feed uses.
const COUNTRIES: Record<string, string> = {
  "united states": "USA", "united states of america": "USA", usa: "USA", us: "USA", "u.s.": "USA", "u.s.a.": "USA",
  "united kingdom": "United Kingdom", uk: "United Kingdom", "u.k.": "United Kingdom", england: "United Kingdom",
  scotland: "United Kingdom", "great britain": "United Kingdom",
  canada: "Canada", india: "India", germany: "Germany", france: "France", ireland: "Ireland", singapore: "Singapore",
  japan: "Japan", china: "China", "hong kong": "Hong Kong", australia: "Australia", "new zealand": "New Zealand",
  netherlands: "Netherlands", "the netherlands": "Netherlands", switzerland: "Switzerland", spain: "Spain",
  italy: "Italy", portugal: "Portugal", belgium: "Belgium", sweden: "Sweden", norway: "Norway", denmark: "Denmark",
  finland: "Finland", poland: "Poland", austria: "Austria", israel: "Israel", mexico: "Mexico", brazil: "Brazil",
  argentina: "Argentina", colombia: "Colombia", chile: "Chile", "south korea": "South Korea", korea: "South Korea",
  taiwan: "Taiwan", thailand: "Thailand", vietnam: "Vietnam", philippines: "Philippines", indonesia: "Indonesia",
  malaysia: "Malaysia", "united arab emirates": "United Arab Emirates", uae: "United Arab Emirates",
  "saudi arabia": "Saudi Arabia", "south africa": "South Africa", nigeria: "Nigeria", kenya: "Kenya", egypt: "Egypt",
  turkey: "Turkey", greece: "Greece", romania: "Romania", czechia: "Czechia", "czech republic": "Czechia",
  hungary: "Hungary", ukraine: "Ukraine", luxembourg: "Luxembourg", qatar: "Qatar",
};

interface Place {
  city: string;
  state: string | null; // US state abbreviation, null outside the US
  country: string;
}

const us = (city: string, state: string): Place => ({ city, state, country: "USA" });
const abroad = (city: string, country: string): Place => ({ city, state: null, country });

// Bare city names (no state/country in the text) and the abbreviations feeds use.
// Only unambiguous cities: "Springfield" or "Portland" alone is left unplaced.
const KNOWN_CITIES: Record<string, Place> = {
  // --- US ---
  "new york": us("New York", "NY"), "new york city": us("New York", "NY"), nyc: us("New York", "NY"),
  manhattan: us("New York", "NY"), brooklyn: us("Brooklyn", "NY"),
  "los angeles": us("Los Angeles", "CA"), la: us("Los Angeles", "CA"),
  "san francisco": us("San Francisco", "CA"), sf: us("San Francisco", "CA"), "sf bay area": us("San Francisco", "CA"),
  // Misspellings seen in real feeds (Ramp's Ashby addresses say "San Fransisco").
  "san fransisco": us("San Francisco", "CA"), "san franciso": us("San Francisco", "CA"),
  chicago: us("Chicago", "IL"), boston: us("Boston", "MA"), cambridge: us("Cambridge", "MA"),
  seattle: us("Seattle", "WA"), bellevue: us("Bellevue", "WA"), redmond: us("Redmond", "WA"),
  austin: us("Austin", "TX"), dallas: us("Dallas", "TX"), houston: us("Houston", "TX"),
  "san antonio": us("San Antonio", "TX"), plano: us("Plano", "TX"), frisco: us("Frisco", "TX"),
  atlanta: us("Atlanta", "GA"), miami: us("Miami", "FL"), tampa: us("Tampa", "FL"), orlando: us("Orlando", "FL"),
  jacksonville: us("Jacksonville", "FL"), denver: us("Denver", "CO"), boulder: us("Boulder", "CO"),
  philadelphia: us("Philadelphia", "PA"), pittsburgh: us("Pittsburgh", "PA"), "san diego": us("San Diego", "CA"),
  "san jose": us("San Jose", "CA"), oakland: us("Oakland", "CA"), "palo alto": us("Palo Alto", "CA"),
  "menlo park": us("Menlo Park", "CA"), "mountain view": us("Mountain View", "CA"), sunnyvale: us("Sunnyvale", "CA"),
  "santa clara": us("Santa Clara", "CA"), "redwood city": us("Redwood City", "CA"), irvine: us("Irvine", "CA"),
  "santa monica": us("Santa Monica", "CA"), sacramento: us("Sacramento", "CA"),
  charlotte: us("Charlotte", "NC"), raleigh: us("Raleigh", "NC"), durham: us("Durham", "NC"),
  minneapolis: us("Minneapolis", "MN"), phoenix: us("Phoenix", "AZ"), tempe: us("Tempe", "AZ"),
  scottsdale: us("Scottsdale", "AZ"), nashville: us("Nashville", "TN"), memphis: us("Memphis", "TN"),
  detroit: us("Detroit", "MI"), "ann arbor": us("Ann Arbor", "MI"), columbus: us("Columbus", "OH"),
  cleveland: us("Cleveland", "OH"), cincinnati: us("Cincinnati", "OH"), indianapolis: us("Indianapolis", "IN"),
  milwaukee: us("Milwaukee", "WI"), "st. louis": us("St. Louis", "MO"), "saint louis": us("St. Louis", "MO"),
  "kansas city": us("Kansas City", "MO"), "salt lake city": us("Salt Lake City", "UT"), "las vegas": us("Las Vegas", "NV"),
  "washington dc": us("Washington", "DC"), "washington d.c.": us("Washington", "DC"), "washington, dc": us("Washington", "DC"),
  dc: us("Washington", "DC"), baltimore: us("Baltimore", "MD"), richmond: us("Richmond", "VA"),
  arlington: us("Arlington", "VA"), mclean: us("McLean", "VA"), reston: us("Reston", "VA"),
  stamford: us("Stamford", "CT"), greenwich: us("Greenwich", "CT"), hartford: us("Hartford", "CT"),
  "new haven": us("New Haven", "CT"), "jersey city": us("Jersey City", "NJ"), hoboken: us("Hoboken", "NJ"),
  princeton: us("Princeton", "NJ"), providence: us("Providence", "RI"), honolulu: us("Honolulu", "HI"),
  "new orleans": us("New Orleans", "LA"), louisville: us("Louisville", "KY"), omaha: us("Omaha", "NE"),
  "oklahoma city": us("Oklahoma City", "OK"), "fort worth": us("Fort Worth", "TX"),

  // --- Canada ---
  toronto: abroad("Toronto", "Canada"), vancouver: abroad("Vancouver", "Canada"), montreal: abroad("Montreal", "Canada"),
  "montréal": abroad("Montreal", "Canada"), ottawa: abroad("Ottawa", "Canada"), calgary: abroad("Calgary", "Canada"),
  // --- UK / Ireland ---
  london: abroad("London", "United Kingdom"), manchester: abroad("Manchester", "United Kingdom"),
  edinburgh: abroad("Edinburgh", "United Kingdom"), dublin: abroad("Dublin", "Ireland"),
  // --- Europe ---
  paris: abroad("Paris", "France"), berlin: abroad("Berlin", "Germany"), munich: abroad("Munich", "Germany"),
  "münchen": abroad("Munich", "Germany"), frankfurt: abroad("Frankfurt", "Germany"), hamburg: abroad("Hamburg", "Germany"),
  dusseldorf: abroad("Düsseldorf", "Germany"), "düsseldorf": abroad("Düsseldorf", "Germany"),
  amsterdam: abroad("Amsterdam", "Netherlands"), zurich: abroad("Zurich", "Switzerland"), "zürich": abroad("Zurich", "Switzerland"),
  geneva: abroad("Geneva", "Switzerland"), madrid: abroad("Madrid", "Spain"), barcelona: abroad("Barcelona", "Spain"),
  milan: abroad("Milan", "Italy"), milano: abroad("Milan", "Italy"), rome: abroad("Rome", "Italy"),
  lisbon: abroad("Lisbon", "Portugal"), brussels: abroad("Brussels", "Belgium"), stockholm: abroad("Stockholm", "Sweden"),
  copenhagen: abroad("Copenhagen", "Denmark"), oslo: abroad("Oslo", "Norway"), helsinki: abroad("Helsinki", "Finland"),
  warsaw: abroad("Warsaw", "Poland"), vienna: abroad("Vienna", "Austria"), prague: abroad("Prague", "Czechia"),
  luxembourg: abroad("Luxembourg", "Luxembourg"),
  // --- Asia-Pacific / Middle East ---
  singapore: abroad("Singapore", "Singapore"), "hong kong": abroad("Hong Kong", "Hong Kong"),
  tokyo: abroad("Tokyo", "Japan"), osaka: abroad("Osaka", "Japan"), seoul: abroad("Seoul", "South Korea"),
  shanghai: abroad("Shanghai", "China"), beijing: abroad("Beijing", "China"), shenzhen: abroad("Shenzhen", "China"),
  taipei: abroad("Taipei", "Taiwan"), bengaluru: abroad("Bengaluru", "India"), bangalore: abroad("Bengaluru", "India"),
  mumbai: abroad("Mumbai", "India"), delhi: abroad("Delhi", "India"), "new delhi": abroad("Delhi", "India"),
  gurgaon: abroad("Gurugram", "India"), gurugram: abroad("Gurugram", "India"), hyderabad: abroad("Hyderabad", "India"),
  pune: abroad("Pune", "India"), chennai: abroad("Chennai", "India"), sydney: abroad("Sydney", "Australia"),
  melbourne: abroad("Melbourne", "Australia"), auckland: abroad("Auckland", "New Zealand"),
  "tel aviv": abroad("Tel Aviv", "Israel"), dubai: abroad("Dubai", "United Arab Emirates"),
  "abu dhabi": abroad("Abu Dhabi", "United Arab Emirates"), riyadh: abroad("Riyadh", "Saudi Arabia"),
  // --- Latin America / Africa ---
  "mexico city": abroad("Mexico City", "Mexico"), "ciudad de méxico": abroad("Mexico City", "Mexico"),
  "são paulo": abroad("São Paulo", "Brazil"), "sao paulo": abroad("São Paulo", "Brazil"),
  "buenos aires": abroad("Buenos Aires", "Argentina"), bogota: abroad("Bogotá", "Colombia"), "bogotá": abroad("Bogotá", "Colombia"),
  santiago: abroad("Santiago", "Chile"), johannesburg: abroad("Johannesburg", "South Africa"),
  "cape town": abroad("Cape Town", "South Africa"), lagos: abroad("Lagos", "Nigeria"), nairobi: abroad("Nairobi", "Kenya"),
};

export interface NormalizedPlace {
  city: string | null;
  state: string | null;
  country: string | null;
}

export interface NormalizedLocation {
  city: string | null;
  state: string | null;
  country: string | null;
  remoteType: RemoteType | null;
  // Every place the posting is open in, formatted for preference matching (see the header).
  locations: string[];
}

const NO_LOCATION: NormalizedLocation = { city: null, state: null, country: null, remoteType: null, locations: [] };

// "Austin, TX" / "London, United Kingdom" / "Canada" -- null for a bare United States.
export function formatPlace(place: NormalizedPlace): string | null {
  if (place.city) {
    if (place.state) return `${place.city}, ${place.state}`;
    return place.country ? `${place.city}, ${place.country}` : place.city;
  }
  if (place.country && place.country !== "USA") return place.country;
  return null;
}

function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// One place's text, with any remote/hybrid wording already stripped, to a place.
function resolvePlace(rawText: string): NormalizedPlace | null {
  const text = rawText.replace(/\s+/g, " ").replace(/^[-–—,\s]+|[-–—,\s]+$/g, "").trim();
  if (!text || /^(n\/a|na|tbd|various|multiple( locations)?|anywhere|global(ly)?|worldwide)$/i.test(text)) return null;

  const key = text.toLowerCase();
  if (KNOWN_CITIES[key]) {
    const k = KNOWN_CITIES[key];
    return { city: k.city, state: k.state, country: k.country };
  }
  if (COUNTRIES[key]) return { city: null, state: null, country: COUNTRIES[key] };

  // "City, X" or "City, State, Country": the first piece is the city, the rest narrows it.
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const cityText = parts[0].replace(/^greater\s+/i, "");
    const rest = parts.slice(1).map((p) => p.replace(/\./g, "").trim());
    const last = rest[rest.length - 1];
    const lastKey = last.toLowerCase();

    const stateAbbrev = US_STATE_ABBREVIATIONS.has(last.toUpperCase())
      ? last.toUpperCase()
      : US_STATE_NAMES[lastKey] ?? US_STATE_NAMES[rest[0].toLowerCase()] ?? null;
    const country = COUNTRIES[lastKey] ?? null;

    if (stateAbbrev && (!country || country === "USA")) {
      const known = KNOWN_CITIES[cityText.toLowerCase()];
      // Trust the text's own state, but take a known city's canonical spelling ("New York City" -> "New York").
      const city = known && known.state === stateAbbrev ? known.city : cityText;
      return { city, state: stateAbbrev, country: "USA" };
    }
    if (country === "USA") {
      // "San Francisco, United States": no state in the text, so only a known city can be placed.
      const known = KNOWN_CITIES[cityText.toLowerCase()];
      return known && known.country === "USA" ? { city: known.city, state: known.state, country: "USA" } : { city: null, state: null, country: "USA" };
    }
    if (country) {
      const known = KNOWN_CITIES[cityText.toLowerCase()];
      return { city: known && known.country === country ? known.city : titleCase(cityText), state: null, country };
    }
    // "Bengaluru, Karnataka": an unfamiliar region name -- fall back on the city alone if we know it.
    const known = KNOWN_CITIES[cityText.toLowerCase()];
    if (known) return { city: known.city, state: known.state, country: known.country };
  }
  return null;
}

// Pieces of one text that are really separate places ("A; B", "A | B", "A / B"
// when each side reads as a place). Remote/hybrid markers are handled by the caller.
function splitPlaces(text: string): string[] {
  return text
    .split(/\s*[;|]\s*|\s+\/\s+|\s+(?:or|and)\s+(?=[A-Z])/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function normalizeLocations(text: string | undefined | null): { places: NormalizedPlace[]; remoteType: RemoteType | null } {
  if (!text) return { places: [], remoteType: null };

  // "Remote-Friendly" is an office role that tolerates remote work, not a remote role, so it is not a signal.
  const withoutFriendly = text.replace(/remote[-\s]?friendly(\s*\([^)]*\))?/gi, " ");
  let remoteType: RemoteType | null = null;
  if (/remote/i.test(withoutFriendly)) remoteType = "remote";
  if (/hybrid/i.test(withoutFriendly)) remoteType = "hybrid";

  // Strip remote/hybrid/in-person wording.
  const cleaned = withoutFriendly
    .replace(/\(?\b(remote|hybrid|in[\s-]?person|on[\s-]?site)\b\)?/gi, " ")
    .replace(/\s+-\s+(?=[A-Z]{2,3}\b)/g, ", ") // "Remote - USA" leaves "- USA"
    .replace(/\s{2,}/g, " ");

  const places: NormalizedPlace[] = [];
  const seen = new Set<string>();
  for (const piece of splitPlaces(cleaned)) {
    // "Japan; Tokyo" style duplicates and re-listings collapse to one entry.
    const place = resolvePlace(piece);
    if (!place) continue;
    const id = `${place.city ?? ""}|${place.state ?? ""}|${place.country ?? ""}`;
    if (seen.has(id)) continue;
    seen.add(id);
    places.push(place);
  }
  return { places, remoteType };
}

export function normalizeLocation(text: string | undefined | null): NormalizedLocation {
  if (!text) return { ...NO_LOCATION };

  const { places, remoteType } = normalizeLocations(text);

  // A "Country" entry beside a city in that same country ("Japan; Tokyo") is redundant detail.
  const cityCountries = new Set(places.filter((p) => p.city).map((p) => p.country));
  const kept = places.filter((p) => p.city || !cityCountries.has(p.country));

  const locations = [...new Set(kept.map(formatPlace).filter((p): p is string => !!p))];
  const primary = kept.find((p) => p.city) ?? kept[0] ?? null;

  let mode: RemoteType | null = remoteType;
  if (!mode && primary?.city) mode = "in_person";

  return {
    city: primary?.city ?? null,
    state: primary?.state ?? null,
    country: primary?.country ?? null,
    remoteType: mode,
    locations,
  };
}
