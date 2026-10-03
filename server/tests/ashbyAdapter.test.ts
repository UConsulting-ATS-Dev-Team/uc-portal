import { describe, expect, it } from "vitest";
import {
  ashbyCompensationText,
  ashbyEmploymentTypeText,
  ashbyPostedDate,
  buildAshbyLocationText,
  isContractOrTemporary,
  jobUrlMatchesSlug,
  type AshbyPosting,
} from "../../supabase/functions/_shared/ashbyAdapter.js";
import { normalizeLocation } from "../src/taxonomy/locations.js";
import { normalizeCompensation } from "../src/taxonomy/compensation.js";
import { normalizeEmploymentType } from "../src/taxonomy/employmentTypes.js";

// Shapes below are taken from a real Ramp board response (2026-10-03).
function posting(overrides: Partial<AshbyPosting> = {}): AshbyPosting {
  return {
    id: "34413f8d-26bf-4bbc-8ade-eb309a0e2245",
    title: " Security Engineer, Cloud",
    employmentType: "FullTime",
    location: "New York, NY (HQ)",
    address: { postalAddress: { addressRegion: "NY", addressCountry: "USA", addressLocality: "New York City" } },
    secondaryLocations: [
      { location: "Remote (Canada)", address: { postalAddress: { addressCountry: "Canada" } } },
      { location: "Remote (US)", address: { postalAddress: { addressCountry: "United States" } } },
      { location: "Miami, FL", address: { postalAddress: { addressRegion: "Florida", addressCountry: "USA", addressLocality: "Miami" } } },
    ],
    workplaceType: "Hybrid",
    publishedAt: "2026-04-07T17:12:35.753+00:00",
    isListed: true,
    jobUrl: "https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245",
    ...overrides,
  };
}

describe("ashbyEmploymentTypeText", () => {
  it("maps Ashby's types onto wording the shared normalizer reads", () => {
    expect(normalizeEmploymentType(ashbyEmploymentTypeText("Intern"))).toBe("internship");
    expect(normalizeEmploymentType(ashbyEmploymentTypeText("FullTime"))).toBe("full_time");
    expect(normalizeEmploymentType(ashbyEmploymentTypeText("PartTime"))).toBe("part_time");
  });
  it("has no wording for contract or temporary, which callers skip", () => {
    expect(ashbyEmploymentTypeText("Contract")).toBeUndefined();
    expect(isContractOrTemporary(posting({ employmentType: "Contract" }))).toBe(true);
    expect(isContractOrTemporary(posting({ employmentType: "Temporary" }))).toBe(true);
    expect(isContractOrTemporary(posting({ employmentType: "Intern" }))).toBe(false);
  });
});

describe("buildAshbyLocationText", () => {
  it("lists every place from the structured addresses, with the workplace mode as a suffix", () => {
    expect(buildAshbyLocationText(posting())).toBe("New York City, NY | Canada | United States | Miami, Florida (Hybrid)");
  });

  it("resolves through the shared location normalizer to every real place", () => {
    const loc = normalizeLocation(buildAshbyLocationText(posting()));
    expect(loc.city).toBe("New York");
    expect(loc.remoteType).toBe("hybrid");
    expect(loc.locations).toEqual(["New York, NY", "Canada", "Miami, FL"]);
  });

  it("falls back to the free-text label, dropping parentheticals like (HQ)", () => {
    const text = buildAshbyLocationText(posting({ address: undefined, secondaryLocations: [], location: "New York, NY (HQ)", workplaceType: "OnSite" }));
    expect(text).toBe("New York, NY");
    expect(normalizeLocation(text).locations).toEqual(["New York, NY"]);
  });

  it("joins a non-US city with its region and country", () => {
    const text = buildAshbyLocationText(
      posting({
        address: { postalAddress: { addressLocality: "London", addressRegion: "England", addressCountry: "United Kingdom" } },
        secondaryLocations: [],
        workplaceType: "OnSite",
      }),
    );
    expect(normalizeLocation(text).locations).toEqual(["London, United Kingdom"]);
  });

  it("returns a bare Remote for a remote posting with no place, and undefined with nothing at all", () => {
    expect(buildAshbyLocationText(posting({ address: undefined, secondaryLocations: [], location: undefined, workplaceType: "Remote" }))).toBe("Remote");
    expect(buildAshbyLocationText(posting({ address: undefined, secondaryLocations: [], location: undefined, workplaceType: "OnSite" }))).toBeUndefined();
  });

  it("does not repeat a place listed twice", () => {
    const dup = { location: "Austin, TX", address: { postalAddress: { addressLocality: "Austin", addressRegion: "TX", addressCountry: "USA" } } };
    const text = buildAshbyLocationText(posting({ address: dup.address, secondaryLocations: [dup], workplaceType: "OnSite" }));
    expect(text).toBe("Austin, TX");
  });
});

describe("ashbyCompensationText", () => {
  const withSalary = (c: object) => posting({ compensation: { summaryComponents: [{ compensationType: "EquityPercentage", interval: "NONE" }, c] } });

  it("turns a USD salary range into text the shared parser reads", () => {
    const text = ashbyCompensationText(withSalary({ compensationType: "Salary", interval: "1 YEAR", currencyCode: "USD", minValue: 211400, maxValue: 290600 }));
    expect(text).toBe("$211400-$290600/year");
    expect(normalizeCompensation(text)).toEqual({ min: 211400, max: 290600, type: "salary" });
  });

  it("handles hourly pay and a single value", () => {
    const text = ashbyCompensationText(withSalary({ compensationType: "Salary", interval: "1 HOUR", currencyCode: "USD", minValue: 45, maxValue: null }));
    expect(text).toBe("$45/hour");
    expect(normalizeCompensation(text).type).toBe("hourly");
  });

  it("ignores other currencies, equity-only pay and unknown intervals", () => {
    expect(ashbyCompensationText(withSalary({ compensationType: "Salary", interval: "1 YEAR", currencyCode: "GBP", minValue: 60000, maxValue: 70000 }))).toBeUndefined();
    expect(ashbyCompensationText(withSalary({ compensationType: "Salary", interval: "1 MONTH", currencyCode: "USD", minValue: 5000, maxValue: 6000 }))).toBeUndefined();
    expect(ashbyCompensationText(posting({ compensation: { summaryComponents: [{ compensationType: "EquityPercentage", interval: "NONE" }] } }))).toBeUndefined();
    expect(ashbyCompensationText(posting())).toBeUndefined();
  });
});

describe("jobUrlMatchesSlug", () => {
  it("accepts a posting under the configured board, case-insensitively", () => {
    expect(jobUrlMatchesSlug("https://jobs.ashbyhq.com/ramp/abc", "ramp")).toBe(true);
    expect(jobUrlMatchesSlug("https://jobs.ashbyhq.com/Ramp/abc", "ramp")).toBe(true);
  });
  it("rejects another board, a prefix collision, and a missing url", () => {
    expect(jobUrlMatchesSlug("https://jobs.ashbyhq.com/rampart/abc", "ramp")).toBe(false);
    expect(jobUrlMatchesSlug("https://jobs.ashbyhq.com/other/abc", "ramp")).toBe(false);
    expect(jobUrlMatchesSlug(undefined, "ramp")).toBe(false);
  });
});

describe("ashbyPostedDate", () => {
  it("reads the date part of publishedAt", () => {
    expect(ashbyPostedDate("2026-04-07T17:12:35.753+00:00")).toBe("2026-04-07");
  });
  it("is undefined for a missing or invalid value", () => {
    expect(ashbyPostedDate(undefined)).toBeUndefined();
    expect(ashbyPostedDate("not a date")).toBeUndefined();
  });
});
