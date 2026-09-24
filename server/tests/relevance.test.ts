import { describe, expect, it } from "vitest";
import { isLikelyNonCorporateRole, isLikelySeniorRole } from "../src/relevance.js";

describe("isLikelySeniorRole", () => {
  it("flags an explicit senior title", () => {
    expect(isLikelySeniorRole("Senior Software Engineer")).toBe(true);
  });

  it("keeps an ambiguous title with no seniority marker", () => {
    expect(isLikelySeniorRole("Software Engineer")).toBe(false);
  });

  it("keeps Product Manager (manager is deliberately excluded)", () => {
    expect(isLikelySeniorRole("Product Manager")).toBe(false);
  });
});

describe("isLikelyNonCorporateRole - manual trade / hourly operations", () => {
  it.each([
    "Car Detailer",
    "Customer Delivery Driver",
    "CDL A Local Truck Driver",
    "Brake and Tire Technician",
    "Entry-Level Automotive Parts Associate",
    "Auto Body Repair Technician",
    "Auto Painter",
    "Auto Mechanic",
    "Security Guard II",
    "Data Entry Specialist",
    "Lube Tech - Sacramento",
    "PDR Technician - $8,000 Bonus",
    "Heavy Body Tech - $8000 Bonus",
    "Rim Repair Tech",
    "Auto Interior Restoration Specialist",
    "Customer Vehicle Delivery Ambassador",
    "Customer Service Delivery Advocate",
    "Fulfillment Associate - Romeoville, IL",
  ])("excludes %s", (title) => {
    expect(isLikelyNonCorporateRole(title)).toBe(true);
  });

  it("does not exclude Fulfillment Manager, Enterprise Ops (bare 'fulfillment' stays ungated)", () => {
    expect(isLikelyNonCorporateRole("Fulfillment Manager, Enterprise Ops")).toBe(false);
  });

  it("does not exclude Market Operations Manager (real Carvana corporate role)", () => {
    expect(isLikelyNonCorporateRole("Market Operations Manager")).toBe(false);
  });

  it("does not exclude Team Lead, Market Operations", () => {
    expect(isLikelyNonCorporateRole("Team Lead, Market Operations")).toBe(false);
  });

  it("does not exclude Coordinator, Human Resources Operations", () => {
    expect(isLikelyNonCorporateRole("Coordinator, Human Resources Operations")).toBe(false);
  });

  it("does not exclude Strategy Analyst", () => {
    expect(isLikelyNonCorporateRole("Strategy Analyst")).toBe(false);
  });

  it("does not exclude Product Manager, Inventory", () => {
    expect(isLikelyNonCorporateRole("Product Manager, Inventory")).toBe(false);
  });

  it("does not exclude a real Security Engineer title (bare 'security' is not denylisted)", () => {
    expect(isLikelyNonCorporateRole("Security Engineer")).toBe(false);
    expect(isLikelyNonCorporateRole("Manager, Security Operations")).toBe(false);
  });

  it("does not exclude Databricks' real Delivery Solutions Architect title", () => {
    expect(isLikelyNonCorporateRole("Delivery Solutions Architect")).toBe(false);
  });

  it("does not exclude a real Tech Lead / Tech Ops title", () => {
    expect(isLikelyNonCorporateRole("Tech Lead Manager, Oracle ERP")).toBe(false);
    expect(isLikelyNonCorporateRole("Tech Ops Team Lead")).toBe(false);
  });
});

describe("isLikelyNonCorporateRole - direct clinical / patient care", () => {
  it.each([
    "Licensed Mental Health Therapist",
    "Crisis Intervention Specialist",
    "Mental Health Group Facilitator - CA",
    "Clinical Admissions Therapist (California)",
    "Clinical Clearance Specialist (RN)",
    "Group Quality Supervisor - Oregon - LCSW Required",
    "SUD Group Facilitator",
    "Care Coach (Part-Time)",
    "Care Navigator",
    "Registered Nurse",
    "Fulfillment Pharmacist - Boynton Beach, FL",
  ])("excludes %s", (title) => {
    expect(isLikelyNonCorporateRole(title)).toBe(true);
  });

  it("does not exclude Commercial Strategy Associate", () => {
    expect(isLikelyNonCorporateRole("Commercial Strategy Associate")).toBe(false);
  });

  it("does not exclude Growth Strategy Analyst", () => {
    expect(isLikelyNonCorporateRole("Growth Strategy Analyst, GTM Data")).toBe(false);
  });

  it("does not exclude Territory Manager, SUD (a real field-sales title, not clinical)", () => {
    expect(isLikelyNonCorporateRole("Territory Manager, SUD (CA, Los Angeles)")).toBe(false);
  });

  it("does not exclude Patient Finance Specialist (billing, not direct patient care)", () => {
    expect(isLikelyNonCorporateRole("Patient Finance Specialist")).toBe(false);
  });

  it("does not exclude a real Legal Counsel title ('counsel' substring must not match 'counselor')", () => {
    expect(isLikelyNonCorporateRole("Assistant General Counsel, Regulatory")).toBe(false);
    expect(isLikelyNonCorporateRole("Commercial Counsel")).toBe(false);
  });
});
