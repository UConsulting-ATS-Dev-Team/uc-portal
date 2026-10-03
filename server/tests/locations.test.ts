import { describe, it, expect } from "vitest";
import { normalizeLocation } from "../src/taxonomy/locations.js";

// Every string below was seen in a real Greenhouse/Lever feed (2026-10-03). The first
// version of the parser placed none of the multi-place, full-state-name or bare-city
// forms, which left ~76% of the live board with no city.
describe("normalizeLocation — real feed formats", () => {
  it("keeps the original 'City, ST' behaviour", () => {
    const loc = normalizeLocation("Chicago, IL");
    expect(loc).toMatchObject({ city: "Chicago", state: "IL", country: "USA", remoteType: "in_person" });
    expect(loc.locations).toEqual(["Chicago, IL"]);
  });

  it("reads full US state names", () => {
    expect(normalizeLocation("San Francisco, California").locations).toEqual(["San Francisco, CA"]);
    expect(normalizeLocation("Seattle, Washington, United States").locations).toEqual(["Seattle, WA"]);
  });

  it("corrects a misspelled San Francisco seen in a real Ashby feed", () => {
    expect(normalizeLocation("San Fransisco, CA").locations).toEqual(["San Francisco, CA"]);
    expect(normalizeLocation("San Fransisco").city).toBe("San Francisco");
  });

  it("canonicalises New York City", () => {
    expect(normalizeLocation("New York City, New York").locations).toEqual(["New York, NY"]);
    expect(normalizeLocation("New York City, NY").city).toBe("New York");
    expect(normalizeLocation("NYC").locations).toEqual(["New York, NY"]);
  });

  it("places a bare, unambiguous city", () => {
    expect(normalizeLocation("Chicago").locations).toEqual(["Chicago, IL"]);
    expect(normalizeLocation("London")).toMatchObject({ city: "London", state: null, country: "United Kingdom" });
    expect(normalizeLocation("London").locations).toEqual(["London, United Kingdom"]);
  });

  it("leaves an ambiguous or unknown place unplaced rather than guessing", () => {
    const loc = normalizeLocation("Springfield");
    expect(loc).toMatchObject({ city: null, country: null, remoteType: null });
    expect(loc.locations).toEqual([]);
  });

  it("splits a posting open in several places", () => {
    const semicolons = normalizeLocation("Chicago, IL; Denver, CO; Westlake, TX");
    expect(semicolons.city).toBe("Chicago");
    expect(semicolons.locations).toEqual(["Chicago, IL", "Denver, CO", "Westlake, TX"]);

    const pipes = normalizeLocation("San Francisco, CA | New York City, NY | Seattle, WA");
    expect(pipes.locations).toEqual(["San Francisco, CA", "New York, NY", "Seattle, WA"]);
  });

  it("places non-US cities with their country", () => {
    expect(normalizeLocation("Bengaluru, India").locations).toEqual(["Bengaluru, India"]);
    expect(normalizeLocation("Bangalore, India").city).toBe("Bengaluru");
    expect(normalizeLocation("Tokyo, Japan")).toMatchObject({ city: "Tokyo", country: "Japan" });
    expect(normalizeLocation("Singapore").locations).toEqual(["Singapore, Singapore"]);
  });

  it("records a country on its own, but not a bare United States", () => {
    expect(normalizeLocation("Canada").locations).toEqual(["Canada"]);
    const us = normalizeLocation("United States");
    expect(us.locations).toEqual([]);
    expect(us.country).toBe("USA");
  });

  it("drops a country that only repeats a listed city's country", () => {
    const loc = normalizeLocation("Japan; Tokyo");
    expect(loc.locations).toEqual(["Tokyo, Japan"]);
    expect(loc.city).toBe("Tokyo");
  });

  it("takes the city from 'City, United States' only when it is known", () => {
    expect(normalizeLocation("San Francisco, United States ").locations).toEqual(["San Francisco, CA"]);
    expect(normalizeLocation("Somewhere, United States").locations).toEqual([]);
  });

  it("strips 'Greater' and handles DC", () => {
    expect(normalizeLocation("Greater Phoenix, AZ").city).toBe("Phoenix");
    expect(normalizeLocation("Washington, DC").locations).toEqual(["Washington, DC"]);
    expect(normalizeLocation("Washington, D.C.").locations).toEqual(["Washington, DC"]);
  });

  it("separates remote and hybrid from the place", () => {
    expect(normalizeLocation("Remote - USA")).toMatchObject({ remoteType: "remote", city: null, country: "USA" });
    expect(normalizeLocation("US-Remote").remoteType).toBe("remote");
    const hybrid = normalizeLocation("Austin, TX (Hybrid)");
    expect(hybrid).toMatchObject({ remoteType: "hybrid", city: "Austin" });
    expect(hybrid.locations).toEqual(["Austin, TX"]);
  });

  it("does not read 'Remote-Friendly' as a remote role", () => {
    const loc = normalizeLocation("Remote-Friendly (Travel-Required) | San Francisco, CA | Seattle, WA");
    expect(loc.remoteType).toBe("in_person");
    expect(loc.locations).toEqual(["San Francisco, CA", "Seattle, WA"]);
  });

  it("returns an empty result for nothing", () => {
    expect(normalizeLocation(undefined)).toEqual({ city: null, state: null, country: null, remoteType: null, locations: [] });
    expect(normalizeLocation("N/A").locations).toEqual([]);
  });
});
