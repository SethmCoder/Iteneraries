import { describe, expect, it } from "vitest";
import { searchAirports } from "@/lib/flights/openflights-airports";
import { searchRoutes } from "@/lib/flights/openflights-routes";

describe("OpenFlights airports", () => {
  it("finds airports by code and city", () => {
    expect(searchAirports("SFO")[0]?.code).toBe("SFO");
    expect(searchAirports("tokyo").some((a) => a.code === "NRT" || a.code === "HND")).toBe(
      true,
    );
  });
});

describe("OpenFlights routes", () => {
  it("returns airlines for SFO–LAX with nonstops first", () => {
    const hits = searchRoutes("SFO", "LAX");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((r) => r.airline === "UA" || r.airline === "AA")).toBe(true);
    expect(hits[0]?.stops).toBe(0);
  });
});
