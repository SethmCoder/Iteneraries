import { describe, expect, it } from "vitest";
import { searchAirports } from "@/lib/flights/airports";
import {
  applyPreferenceFilters,
  fingerprintAwardOption,
  type AwardOption,
  type AwardSearchQuery,
} from "@/lib/flights/provider";
import { awardSearchFormSchema } from "@/lib/flights/schema";
import { mapSeatsAeroRow } from "@/lib/flights/seats-aero";

const baseQuery: AwardSearchQuery = {
  origin: "SFO",
  destination: "NRT",
  tripType: "one_way",
  departDate: "2026-11-10",
  departDateEnd: "2026-11-14",
  returnDate: null,
  returnDateEnd: null,
  passengers: 1,
  cabin: "business",
  maxPointsPerPassenger: 90000,
  maxPointsTotal: 90000,
  maxCashFees: 250,
  preferredProgram: "united",
  programs: ["united"],
  preferences: {
    maxConnections: 1,
    preferredAirlines: ["UA"],
    departTimeStart: "08:00",
    departTimeEnd: "20:00",
  },
};

function option(partial: Partial<AwardOption> = {}): AwardOption {
  return {
    airline: "UA",
    flightNumbers: "UA837",
    originAirport: "SFO",
    destinationAirport: "NRT",
    departAt: "2026-11-11T10:00:00Z",
    arriveAt: "2026-11-12T14:00:00Z",
    timezone: "UTC",
    durationMinutes: 660,
    stops: 0,
    cabin: "business",
    pointsPerPassenger: 80000,
    pointsTotal: 80000,
    taxesFees: 120,
    currency: "USD",
    loyaltyProgram: "united",
    bookingUrl: "https://seats.aero/",
    availabilityStatus: "estimated",
    provider: "seats_aero",
    providerResultId: "abc",
    fingerprint: "fp",
    compromises: [],
    raw: {},
    ...partial,
  };
}

describe("awardSearchFormSchema", () => {
  it("requires origin, destination, and departure date", () => {
    const result = awardSearchFormSchema.safeParse({
      origin: "SF",
      destination: "NRT",
      tripType: "one_way",
      passengers: 1,
      cabin: "economy",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid one-way search", () => {
    const result = awardSearchFormSchema.safeParse({
      origin: "SFO",
      destination: "NRT",
      tripType: "one_way",
      departDate: "2026-11-10",
      passengers: 1,
      cabin: "business",
      programs: ["united"],
      notifyOnMatch: true,
      requireBookingApproval: true,
      pollIntervalMinutes: 360,
      preferences: {},
    });
    expect(result.success).toBe(true);
  });

  it("requires return date for round-trip", () => {
    const result = awardSearchFormSchema.safeParse({
      origin: "SFO",
      destination: "NRT",
      tripType: "round_trip",
      departDate: "2026-11-10",
      passengers: 1,
      cabin: "economy",
      programs: [],
      notifyOnMatch: true,
      requireBookingApproval: true,
      pollIntervalMinutes: 360,
      preferences: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("fingerprintAwardOption", () => {
  it("is stable for the same inputs", () => {
    const a = fingerprintAwardOption({
      provider: "seats_aero",
      providerResultId: "1",
      origin: "SFO",
      destination: "NRT",
      date: "2026-11-10",
      cabin: "business",
      program: "united",
      points: 80000,
    });
    const b = fingerprintAwardOption({
      provider: "seats_aero",
      providerResultId: "1",
      origin: "SFO",
      destination: "NRT",
      date: "2026-11-10",
      cabin: "business",
      program: "united",
      points: 80000,
    });
    expect(a).toBe(b);
  });
});

describe("applyPreferenceFilters", () => {
  it("drops options over the points budget", () => {
    const filtered = applyPreferenceFilters(
      [option({ pointsPerPassenger: 120000, pointsTotal: 120000 })],
      baseQuery,
    );
    expect(filtered).toHaveLength(0);
  });

  it("flags airline compromises without dropping", () => {
    const filtered = applyPreferenceFilters(
      [option({ airline: "NH", flightNumbers: "NH7" })],
      baseQuery,
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].compromises.join(" ")).toMatch(/Airline/i);
  });
});

describe("mapSeatsAeroRow", () => {
  it("maps a business cabin availability row", () => {
    const mapped = mapSeatsAeroRow(
      {
        ID: "row-1",
        Date: "2026-11-11",
        Source: "united",
        Route: { OriginAirport: "SFO", DestinationAirport: "NRT" },
        JAvailable: true,
        JMileageCost: "85000",
        JAirlines: "UA",
        JDirect: true,
        JTaxes: "150.5",
        ComputedLastSeen: "2026-10-27T00:00:00Z",
      },
      baseQuery,
    );
    expect(mapped).not.toBeNull();
    expect(mapped!.pointsPerPassenger).toBe(85000);
    expect(mapped!.cabin).toBe("business");
    expect(mapped!.availabilityStatus).toBe("estimated");
    expect(mapped!.provider).toBe("seats_aero");
    expect(mapped!.bookingUrl).toContain("seats.aero");
  });
});

describe("searchAirports", () => {
  it("finds airports by code and city", () => {
    expect(searchAirports("SFO")[0]?.code).toBe("SFO");
    expect(searchAirports("tokyo").some((a) => a.code === "NRT")).toBe(true);
  });
});
