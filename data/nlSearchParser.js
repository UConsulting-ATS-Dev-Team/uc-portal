// Natural-language search for the Jobs board (US-continuation of §3.8's
// staged plan: "parse query -> extract known entities into the exact same
// filter object the UI already produces from clicking chips... start with
// keyword/pattern extraction; only reach for an LLM parse on queries the
// extractor can't confidently map"). This file is that deterministic first
// layer -- there's no LLM call in this prototype, so a query this can't
// confidently map just falls through to the existing free-text keyword
// filter (still a real, useful result) rather than silently doing nothing.
//
// Every extracted value maps onto pages/Jobs.jsx's own filter shape and
// option lists (industries from data/careerOptions.js, the same grad-year/
// deadline-bucket vocabulary Jobs.jsx already defines) -- this never
// invents a category the chip-based filter UI doesn't already have.

const INDUSTRY_SYNONYMS = [
  { name: "Management consulting", terms: ["management consulting", "consulting", "consultant", "mbb"] },
  { name: "Investment banking", terms: ["investment banking", "banking", "ib"] },
  { name: "Tech / product strategy", terms: ["tech", "technology", "product strategy", "product management"] },
  { name: "Private equity", terms: ["private equity", "pe"] },
  { name: "Marketing & brand strategy", terms: ["marketing", "brand strategy", "brand"] },
  { name: "Nonprofit / public sector", terms: ["nonprofit", "non-profit", "public sector", "government"] },
  { name: "Healthcare", terms: ["healthcare", "health care"] },
  { name: "Real estate", terms: ["real estate"] },
];

// Locations double as work-mode here since Jobs.jsx's own `locations`
// filter already checks both job.location and job.workMode against the
// same array (see matchesFilters in pages/Jobs.jsx).
const LOCATION_SYNONYMS = [
  { name: "Chicago", terms: ["chicago"] },
  { name: "New York", terms: ["new york", "nyc"] },
  { name: "Los Angeles", terms: ["los angeles", "la"] },
  { name: "San Francisco", terms: ["san francisco", "bay area", "sf"] },
  { name: "Remote", terms: ["remote", "work from home", "wfh"] },
  { name: "Hybrid", terms: ["hybrid"] },
];

const TYPE_SYNONYMS = [
  { name: "Internship", terms: ["internships", "internship", "interns", "intern", "co-op", "coop"] },
  { name: "Full-time", terms: ["full-time", "full time", "fulltime", "ft"] },
];

// Anchored to GRAD_YEARS in pages/Jobs.jsx (2026-2029, i.e. members
// currently enrolled as of the 2026-2027 school year) -- same static
// anchor DEFAULT_FILTERS there already uses ("2027"), not a moving
// today()-based calculation, so it won't drift out of sync with the rest
// of the filter UI on its own. "Freshman" is deliberately not mapped:
// that's Class of 2030, a grad year this prototype's data model (and the
// club's current roster, per CLAUDE.md's ~2026-2029 audience note) doesn't
// represent yet -- left as leftover free text rather than guessed.
const CLASS_YEAR_SYNONYMS = [
  { year: "2027", terms: ["seniors", "senior"] },
  { year: "2028", terms: ["juniors", "junior"] },
  { year: "2029", terms: ["sophomores", "sophomore"] },
];
const SUPPORTED_GRAD_YEARS = ["2026", "2027", "2028", "2029"];

// Longest phrase first within each group -- extractGroup takes the first
// term that matches, and a shorter phrase's word-boundary regex still
// matches when it's embedded in a longer one ("this week" inside "closing
// this week"), which would strip only the short phrase and leave its
// neighbor ("closing") behind as stray leftover text.
const DEADLINE_SYNONYMS = [
  { bucket: "This week", terms: ["closing this week", "due this week", "this week"] },
  { bucket: "This month", terms: ["closing this month", "due this month", "closing soon", "this month"] },
  { bucket: "Rolling", terms: ["rolling basis", "rolling", "no deadline"] },
];

const STOP_WORDS =
  /\b(for|in|at|near|jobs?|roles?|positions?|opportunities?|looking|find|show|me|and|or|the|a|an|any|anything|something|want|need|interested)\b/gi;

function escapeRegex(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches at most one synonym per group (so "consulting" doesn't also
// re-match under a second phrasing of the same industry), strips the
// matched phrase out of the working text so it can't also become leftover
// keyword noise, and is case-insensitive with real word boundaries (so
// "la" only matches the standalone word, never the "la" inside "large").
function extractGroup(text, groups, valueKey) {
  const matches = [];
  let remaining = text;
  for (const group of groups) {
    for (const term of group.terms) {
      const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
      if (re.test(remaining)) {
        matches.push(group[valueKey]);
        remaining = remaining.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, "gi"), " ");
        break;
      }
    }
  }
  return { matches: [...new Set(matches)], remaining };
}

// Parses free text into a patch for pages/Jobs.jsx's filter object, plus a
// human-readable list of what was understood (for the "Searched for:"
// confirmation chips) and whatever's left over as a free-text keyword.
export function parseJobQuery(rawText) {
  let text = ` ${(rawText || "").trim()} `;
  const patch = {};
  const matchedLabels = [];

  const industries = extractGroup(text, INDUSTRY_SYNONYMS, "name");
  text = industries.remaining;
  if (industries.matches.length) {
    patch.industries = industries.matches;
    matchedLabels.push(...industries.matches);
  }

  const locations = extractGroup(text, LOCATION_SYNONYMS, "name");
  text = locations.remaining;
  if (locations.matches.length) {
    patch.locations = locations.matches;
    matchedLabels.push(...locations.matches);
  }

  const types = extractGroup(text, TYPE_SYNONYMS, "name");
  text = types.remaining;
  if (types.matches.length) {
    patch.types = types.matches;
    matchedLabels.push(...types.matches);
  }

  const namedYears = extractGroup(text, CLASS_YEAR_SYNONYMS, "year");
  text = namedYears.remaining;

  // "class of 2028" / "co 2028" style explicit years, independent of the
  // named synonyms above -- a real regex capture, not a fixed synonym
  // list, so any year actually in this prototype's supported range works
  // without hardcoding four near-duplicate phrase entries.
  const explicitYears = [];
  text = text.replace(/\bclass of (\d{4})\b/gi, (match, year) => {
    if (SUPPORTED_GRAD_YEARS.includes(year)) explicitYears.push(year);
    return " ";
  });

  const gradYears = [...new Set([...namedYears.matches, ...explicitYears])];
  if (gradYears.length) {
    patch.gradYears = gradYears;
    matchedLabels.push(...gradYears.map((y) => `Class of ${y}`));
  }

  const deadlines = extractGroup(text, DEADLINE_SYNONYMS, "bucket");
  text = deadlines.remaining;
  if (deadlines.matches.length) {
    patch.deadlines = deadlines.matches;
    matchedLabels.push(...deadlines.matches);
  }

  // Whatever's left after stripping every recognized entity and common
  // filler words is genuine free text (a company name, a role title) --
  // it becomes the existing keyword filter's substring search rather than
  // being dropped, so an unrecognized term still does *something* instead
  // of vanishing silently.
  const leftover = text.replace(STOP_WORDS, " ").replace(/\s+/g, " ").trim();
  if (leftover) {
    patch.keyword = leftover;
    matchedLabels.push(`"${leftover}"`);
  }

  return { patch, matchedLabels, understood: matchedLabels.length > 0 };
}
