import { describe, it, expect } from "vitest";
// The member-facing matchers are plain JS in data/ (the live ones; server/src/match.ts is only a test mirror),
// so these import them untyped.
// @ts-expect-error -- untyped JS module
import { INDUSTRIES, LOCATIONS, SKILLS, ROLES, canonicalIndustry } from "../../data/careerOptions.js";
// @ts-expect-error -- untyped JS module
import { INDUSTRY_TITLE_PATTERNS, industriesFromTitle } from "../../data/industryPatterns.js";
// @ts-expect-error -- untyped JS module
import { skillsFromTitle, inferableSkills } from "../../data/skillInference.js";
// @ts-expect-error -- untyped JS module
import { METROS, placesForJob, locationPrefMatches, matchesAnyLocation, placeLabel, locationSearchTerms } from "../../data/locationUtils.js";

describe("option lists are all matchable", () => {
  it("every industry can be recognised from a job title", () => {
    const missing = (INDUSTRIES as Array<{ name: string }>)
      .map((i) => i.name)
      .filter((name) => name !== "Still figuring it out")
      .filter((name) => !INDUSTRY_TITLE_PATTERNS[canonicalIndustry(name)]);
    expect(missing).toEqual([]);
  });

  it("every pattern key is a real industry", () => {
    const names = new Set((INDUSTRIES as Array<{ name: string }>).map((i) => i.name));
    expect(Object.keys(INDUSTRY_TITLE_PATTERNS).filter((k) => !names.has(k))).toEqual([]);
  });

  it("every skill beyond the original 28 is implied by some title", () => {
    const inferable = inferableSkills() as Set<string>;
    const unmatchable = (SKILLS as string[]).slice(28).filter((s) => !inferable.has(s));
    expect(unmatchable).toEqual([]);
  });

  it("every skill a title implies is a skill a member can pick", () => {
    const offered = new Set(SKILLS as string[]);
    const unpickable = [...(inferableSkills() as Set<string>)].filter((s) => !offered.has(s));
    expect(unpickable).toEqual([]);
  });

  it("every metro is a location option, and its members are places the parser can write", () => {
    for (const name of Object.keys(METROS)) expect(LOCATIONS).toContain(name);
    for (const places of Object.values(METROS) as string[][]) {
      for (const p of places) expect(p).toMatch(/^[A-Za-z .'-]+, [A-Z]{2}$/);
    }
  });

  it("has no duplicate options", () => {
    for (const list of [LOCATIONS, SKILLS, ROLES, (INDUSTRIES as Array<{ name: string }>).map((i) => i.name)] as string[][]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});

describe("industry recognition from titles", () => {
  it("reads new industries from real title shapes", () => {
    expect(industriesFromTitle("Quantitative Trader, Summer Intern")).toContain("Quantitative trading");
    expect(industriesFromTitle("Propulsion Engineer, Starship")).toContain("Aerospace & defense");
    expect(industriesFromTitle("Machine Learning Engineer")).toContain("AI & machine learning");
    expect(industriesFromTitle("Senior Counsel, Commercial")).toContain("Legal & regulatory");
    expect(industriesFromTitle("Forward Deployed Engineer")).toEqual([]);
  });
  it("lets one title satisfy several industries", () => {
    const hits = industriesFromTitle("Business Development Manager") as string[];
    expect(hits).toContain("Corporate strategy & business development");
    expect(hits).toContain("Sales & business development");
  });
});

describe("skill inference from titles", () => {
  it("implies tools a role typically uses", () => {
    expect(skillsFromTitle("Data Analyst")).toEqual(expect.arrayContaining(["SQL", "Tableau", "Microsoft Excel"]));
    expect(skillsFromTitle("Account Executive, Enterprise")).toEqual(expect.arrayContaining(["Salesforce", "Negotiation"]));
    expect(skillsFromTitle("Frontend Engineer")).toEqual(expect.arrayContaining(["JavaScript", "React"]));
  });
  it("does not imply a language the title gives no hint of", () => {
    expect(skillsFromTitle("Software Engineer")).not.toContain("Java");
    expect(skillsFromTitle("Mechanical Engineer")).not.toContain("Programming");
  });
  it("returns nothing for an unrelated title", () => {
    expect(skillsFromTitle("Forklift Operator")).toEqual([]);
    expect(skillsFromTitle("")).toEqual([]);
  });
});

describe("location preferences", () => {
  const multi = { locations: ["San Francisco, CA", "New York, NY", "Seattle, WA"], city: "San Francisco", state: "CA", remote_type: "in_person" };

  it("matches any place a posting lists, not just the first", () => {
    expect(locationPrefMatches("Seattle", multi)).toBe(true);
    expect(locationPrefMatches("Boston", multi)).toBe(false);
    expect(matchesAnyLocation(["Boston", "New York"], multi)).toBe(true);
  });

  it("matches a metro to its member cities", () => {
    const paloAlto = { locations: ["Palo Alto, CA"], remote_type: "in_person" };
    expect(locationPrefMatches("San Francisco Bay Area", paloAlto)).toBe(true);
    expect(locationPrefMatches("San Francisco", paloAlto)).toBe(false);
    expect(locationPrefMatches("Greater Los Angeles", { locations: ["Hawthorne, CA"] })).toBe(true);
    expect(locationPrefMatches("Seattle Area", { locations: ["Redmond, WA"] })).toBe(true);
    expect(locationPrefMatches("Dallas-Fort Worth", { locations: ["Frisco, TX"] })).toBe(true);
  });

  it("does not confuse same-named cities in different states", () => {
    expect(locationPrefMatches("New York Metro", { locations: ["Newark, NJ"] })).toBe(true);
    expect(locationPrefMatches("San Francisco Bay Area", { locations: ["Newark, NJ"] })).toBe(false);
    expect(locationPrefMatches("San Francisco Bay Area", { locations: ["Newark, CA"] })).toBe(true);
  });

  it("handles Washington DC, countries, work modes and International", () => {
    expect(locationPrefMatches("Washington DC", { locations: ["Washington, DC"] })).toBe(true);
    expect(locationPrefMatches("Canada", { locations: ["Toronto, Canada"] })).toBe(true);
    expect(locationPrefMatches("Canada", { locations: ["Canada"] })).toBe(true);
    expect(locationPrefMatches("London", { locations: ["London, United Kingdom"] })).toBe(true);
    expect(locationPrefMatches("Remote", { locations: [], remote_type: "remote" })).toBe(true);
    expect(locationPrefMatches("Hybrid", { locations: [], remote_type: "remote" })).toBe(false);
    expect(locationPrefMatches("International", { locations: ["Singapore, Singapore"] })).toBe(true);
    expect(locationPrefMatches("International", { locations: ["Austin, TX"] })).toBe(false);
  });

  it("falls back to the single city for a job whose places are not derived yet", () => {
    expect(placesForJob({ city: "Austin", state: "TX" })).toEqual(["Austin, TX"]);
    expect(placesForJob({ city: "Chicago" })).toEqual(["Chicago"]);
    expect(placesForJob({ city: null })).toEqual([]);
    expect(locationPrefMatches("Austin", { city: "Austin", state: "TX" })).toBe(true);
  });

  it("labels a multi-place posting by its first place", () => {
    expect(placeLabel(multi)).toBe("San Francisco +2 more");
    expect(placeLabel({ locations: ["Austin, TX"] })).toBe("Austin");
    expect(placeLabel({ locations: [], remote_type: "remote" })).toBe("Remote");
  });

  it("turns a metro into city names for directory text search", () => {
    expect(locationSearchTerms("San Francisco Bay Area")).toContain("Palo Alto");
    expect(locationSearchTerms("Boston")).toEqual(["Boston"]);
    expect(locationSearchTerms("Remote")).toEqual([]);
  });
});
