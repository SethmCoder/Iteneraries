import { describe, expect, it } from "vitest";
import { searchAirports } from "@/lib/flights/openflights-airports";
import { findFlights, searchRoutes } from "@/lib/flights/openflights-routes";

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

  it("findFlights returns nonstops for SFO–LAX before connections", () => {
    const hits = findFlights("SFO", "LAX");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.kind).toBe("nonstop");
    expect(hits.some((h) => h.airline === "UA" || h.airline === "AA")).toBe(true);
  });

  it("findFlights includes one-stop options when useful", () => {
    // BOI–HNL is typically one-stop in OpenFlights (no nonstop in many dumps)
    const hits = findFlights("BOI", "HNL", 40);
    expect(hits.length).toBeGreaterThan(0);
    const oneStops = hits.filter((h) => h.kind === "one_stop");
    expect(oneStops.length).toBeGreaterThan(0);
    expect(oneStops[0]?.via).toBeTruthy();
    expect(oneStops[0]?.legs).toHaveLength(2);
  });
});
